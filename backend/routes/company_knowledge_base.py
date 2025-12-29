"""
Company Knowledge Base Routes
Multi-tenant support pages with company isolation
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from uuid import uuid4
import re

# Import from server.py
import sys
sys.path.append('/app/backend')
from server import db, get_current_user

router = APIRouter(prefix="/company-kb", tags=["company-knowledge-base"])


# Pydantic Models
class KBArticleCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    content: Optional[str] = ""
    blocks: List[Dict[str, Any]] = []
    category: Optional[str] = ""
    tags: List[str] = []
    folder_path: Optional[str] = "/"  # For hierarchy: "/getting-started/basics"
    available_for_agents: bool = False
    visible: bool = True
    seo: Optional[Dict[str, Any]] = None


class KBArticleUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    blocks: Optional[List[Dict[str, Any]]] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    folder_path: Optional[str] = None
    available_for_agents: Optional[bool] = None
    visible: Optional[bool] = None
    seo: Optional[Dict[str, Any]] = None


class KBFolderCreate(BaseModel):
    name: str
    parent_path: str = "/"
    description: Optional[str] = ""
    icon: Optional[str] = "Folder"


def generate_slug(name: str) -> str:
    """Generate URL-friendly slug from name"""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def check_kb_permission(user: dict, required_role: str = "admin") -> bool:
    """Check if user has permission to manage KB articles"""
    user_role = user.get("role", "")
    # Super admins and company admins can manage
    if user_role in ["super_admin", "admin"]:
        return True
    # Check for specific KB permission
    permissions = user.get("permissions", [])
    if "manage_knowledge_base" in permissions:
        return True
    return False


# ==================== ARTICLES ====================

@router.get("/articles")
async def get_company_kb_articles(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    folder: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all KB articles for the current company"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    query = {"tenant_id": tenant_id, "visible": True}
    
    if category:
        query["category"] = category
    if tag:
        query["tags"] = tag
    if folder:
        query["folder_path"] = {"$regex": f"^{folder}"}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}}
        ]
    
    articles = await db.company_knowledge_base.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    return articles


@router.get("/articles/for-agents")
async def get_kb_articles_for_agents(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get KB articles available for agent search"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    query = {
        "tenant_id": tenant_id,
        "visible": True,
        "available_for_agents": True
    }
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}}
        ]
    
    articles = await db.company_knowledge_base.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "slug": 1, "content": 1, "blocks": 1, "category": 1, "tags": 1}
    ).to_list(100)
    
    return articles


@router.get("/article/{slug}")
async def get_company_kb_article(
    slug: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single KB article by slug"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    article = await db.company_knowledge_base.find_one(
        {"tenant_id": tenant_id, "slug": slug},
        {"_id": 0}
    )
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    return article


@router.post("/articles")
async def create_company_kb_article(
    article: KBArticleCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new KB article"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    if not check_kb_permission(current_user):
        raise HTTPException(status_code=403, detail="You don't have permission to create KB articles")
    
    # Generate slug if not provided
    slug = article.slug or generate_slug(article.name)
    
    # Check for duplicate slug
    existing = await db.company_knowledge_base.find_one({
        "tenant_id": tenant_id,
        "slug": slug
    })
    if existing:
        slug = f"{slug}-{uuid4().hex[:6]}"
    
    now = datetime.now(timezone.utc)
    
    new_article = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "name": article.name,
        "slug": slug,
        "content": article.content or "",
        "blocks": article.blocks,
        "category": article.category or "",
        "tags": article.tags or [],
        "folder_path": article.folder_path or "/",
        "available_for_agents": article.available_for_agents,
        "visible": article.visible,
        "seo": article.seo or {
            "title": article.name,
            "description": ""
        },
        "created_by": current_user.get("id"),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.company_knowledge_base.insert_one(new_article)
    
    # Remove MongoDB _id before returning
    new_article.pop("_id", None)
    
    return new_article


@router.put("/articles/{slug}")
async def update_company_kb_article(
    slug: str,
    article: KBArticleUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a KB article"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    if not check_kb_permission(current_user):
        raise HTTPException(status_code=403, detail="You don't have permission to update KB articles")
    
    existing = await db.company_knowledge_base.find_one({
        "tenant_id": tenant_id,
        "slug": slug
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Article not found")
    
    update_data = article.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Handle slug change
    if article.slug and article.slug != slug:
        slug_exists = await db.company_knowledge_base.find_one({
            "tenant_id": tenant_id,
            "slug": article.slug,
            "id": {"$ne": existing["id"]}
        })
        if slug_exists:
            raise HTTPException(status_code=400, detail="Slug already exists")
    
    await db.company_knowledge_base.update_one(
        {"tenant_id": tenant_id, "slug": slug},
        {"$set": update_data}
    )
    
    updated = await db.company_knowledge_base.find_one(
        {"tenant_id": tenant_id, "slug": article.slug or slug},
        {"_id": 0}
    )
    
    return updated


@router.delete("/articles/{slug}")
async def delete_company_kb_article(
    slug: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a KB article"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    if not check_kb_permission(current_user):
        raise HTTPException(status_code=403, detail="You don't have permission to delete KB articles")
    
    result = await db.company_knowledge_base.delete_one({
        "tenant_id": tenant_id,
        "slug": slug
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Article not found")
    
    return {"message": "Article deleted successfully"}


# ==================== FOLDERS ====================

@router.get("/folders")
async def get_company_kb_folders(
    current_user: dict = Depends(get_current_user)
):
    """Get all KB folders for the current company"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    folders = await db.company_kb_folders.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).sort("path", 1).to_list(100)
    
    return folders


@router.post("/folders")
async def create_company_kb_folder(
    folder: KBFolderCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new KB folder"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    if not check_kb_permission(current_user):
        raise HTTPException(status_code=403, detail="You don't have permission to create folders")
    
    # Build full path
    parent = folder.parent_path.rstrip("/")
    folder_slug = generate_slug(folder.name)
    full_path = f"{parent}/{folder_slug}" if parent else f"/{folder_slug}"
    
    # Check for duplicate
    existing = await db.company_kb_folders.find_one({
        "tenant_id": tenant_id,
        "path": full_path
    })
    if existing:
        raise HTTPException(status_code=400, detail="Folder already exists")
    
    now = datetime.now(timezone.utc)
    
    new_folder = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "name": folder.name,
        "path": full_path,
        "parent_path": folder.parent_path,
        "description": folder.description or "",
        "icon": folder.icon or "Folder",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.company_kb_folders.insert_one(new_folder)
    new_folder.pop("_id", None)
    
    return new_folder


@router.delete("/folders/{folder_id}")
async def delete_company_kb_folder(
    folder_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a KB folder and optionally move its articles"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    if not check_kb_permission(current_user):
        raise HTTPException(status_code=403, detail="You don't have permission to delete folders")
    
    folder = await db.company_kb_folders.find_one({
        "tenant_id": tenant_id,
        "id": folder_id
    })
    
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Move articles to root
    await db.company_knowledge_base.update_many(
        {"tenant_id": tenant_id, "folder_path": {"$regex": f"^{folder['path']}"}},
        {"$set": {"folder_path": "/"}}
    )
    
    # Delete folder and subfolders
    await db.company_kb_folders.delete_many({
        "tenant_id": tenant_id,
        "path": {"$regex": f"^{folder['path']}"}
    })
    
    return {"message": "Folder deleted successfully"}


# ==================== CATEGORIES ====================

@router.get("/categories")
async def get_company_kb_categories(
    current_user: dict = Depends(get_current_user)
):
    """Get all categories with article counts"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    pipeline = [
        {"$match": {"tenant_id": tenant_id, "visible": True}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$match": {"_id": {"$ne": ""}}},
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.company_knowledge_base.aggregate(pipeline).to_list(100)
    
    categories = [
        {"name": r["_id"], "count": r["count"]}
        for r in results if r["_id"]
    ]
    
    return categories


# ==================== STATS ====================

@router.get("/stats")
async def get_company_kb_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get KB statistics for the company"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    total_articles = await db.company_knowledge_base.count_documents({
        "tenant_id": tenant_id
    })
    
    visible_articles = await db.company_knowledge_base.count_documents({
        "tenant_id": tenant_id,
        "visible": True
    })
    
    agent_available = await db.company_knowledge_base.count_documents({
        "tenant_id": tenant_id,
        "available_for_agents": True
    })
    
    total_folders = await db.company_kb_folders.count_documents({
        "tenant_id": tenant_id
    })
    
    categories = await db.company_knowledge_base.distinct(
        "category",
        {"tenant_id": tenant_id, "category": {"$ne": ""}}
    )
    
    return {
        "total_articles": total_articles,
        "visible_articles": visible_articles,
        "agent_available_articles": agent_available,
        "total_folders": total_folders,
        "total_categories": len(categories)
    }
