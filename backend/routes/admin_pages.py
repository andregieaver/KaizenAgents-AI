"""
Admin Pages Management routes - Control SEO and visibility for public pages
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from pathlib import Path
import shutil

from middleware import get_current_user
from middleware.database import db

router = APIRouter(prefix="/admin/pages", tags=["admin-pages"])

# File upload directory
UPLOADS_DIR = Path("/app/backend/uploads")
UPLOADS_DIR.mkdir(exist_ok=True)

# Models
class OpenGraphData(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    url: Optional[str] = None

class TwitterCardData(BaseModel):
    card: Optional[str] = "summary_large_image"  # summary, summary_large_image, app, player
    site: Optional[str] = None
    creator: Optional[str] = None

class RobotsDirectives(BaseModel):
    index: bool = True  # index or noindex
    follow: bool = True  # follow or nofollow
    noarchive: bool = False
    nosnippet: bool = False
    noimageindex: bool = False

class PageSEO(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[str] = None
    canonical_url: Optional[str] = None
    og: Optional[OpenGraphData] = None
    twitter: Optional[TwitterCardData] = None
    robots: Optional[RobotsDirectives] = None

class ContentBlock(BaseModel):
    id: str
    type: str  # text, image, video, etc.
    content: dict  # type-specific content
    order: int

class PageSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    slug: str
    name: str
    path: str
    visible: bool = True
    is_system_page: bool = False
    content: Optional[str] = None  # Legacy field, kept for backward compatibility
    blocks: Optional[List[ContentBlock]] = []
    seo: Optional[PageSEO] = None
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None

class PageCreateRequest(BaseModel):
    name: str
    slug: str
    path: str
    content: Optional[str] = None  # Legacy
    blocks: Optional[List[dict]] = []
    visible: bool = True

class PageUpdateRequest(BaseModel):
    name: Optional[str] = None
    visible: Optional[bool] = None
    content: Optional[str] = None
    blocks: Optional[List[dict]] = None
    seo: Optional[PageSEO] = None

class OGImageUploadResponse(BaseModel):
    url: str
    path: str

class PageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    slug: str
    name: str
    path: str
    visible: bool
    is_system_page: bool
    content: Optional[str] = None
    blocks: Optional[List[dict]] = []
    seo: PageSEO
    updated_at: str
    updated_by: Optional[str] = None

class PublicPageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    path: str
    content: Optional[str] = None
    blocks: Optional[List[dict]] = []
    seo: PageSEO

class PageTemplateExport(BaseModel):
    blocks: List[dict]
    content: Optional[str] = None

class PageTemplateImport(BaseModel):
    blocks: List[dict]
    content: Optional[str] = None

# Default pages configuration
DEFAULT_PAGES = [
    {
        "slug": "homepage",
        "name": "Homepage",
        "path": "/",
        "visible": True,
        "is_system_page": True,
        "content": None,
        "seo": {
            "title": "Kaizen Life Support - AI-Powered Customer Support",
            "description": "Transform your customer support with AI-powered agents. Manage conversations, analytics, and team collaboration in one platform.",
            "keywords": "AI support, customer service, chatbot, automation, team collaboration",
            "canonical_url": "/",
            "og": {
                "title": "Kaizen Life Support - AI-Powered Customer Support",
                "description": "Transform your customer support with AI-powered agents.",
                "image": "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200",
                "url": "/"
            },
            "twitter": {
                "card": "summary_large_image",
                "site": None,
                "creator": None
            },
            "robots": {
                "index": True,
                "follow": True,
                "noarchive": False,
                "nosnippet": False,
                "noimageindex": False
            }
        }
    },
    {
        "slug": "pricing",
        "name": "Pricing",
        "path": "/pricing",
        "visible": True,
        "is_system_page": True,
        "content": None,
        "seo": {
            "title": "Pricing Plans - Kaizen Life Support",
            "description": "Choose the perfect plan for your business. Flexible pricing with powerful features to scale your customer support.",
            "keywords": "pricing, plans, subscription, AI support pricing, enterprise",
            "canonical_url": "/pricing",
            "og": {
                "title": "Pricing Plans - Kaizen Life Support",
                "description": "Flexible pricing plans to scale your customer support with AI.",
                "image": "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200",
                "url": "/pricing"
            },
            "twitter": {
                "card": "summary_large_image",
                "site": None,
                "creator": None
            },
            "robots": {
                "index": True,
                "follow": True,
                "noarchive": False,
                "nosnippet": False,
                "noimageindex": False
            }
        }
    }
]

async def ensure_default_pages():
    """Ensure default pages exist in database and migrate old pages"""
    for page in DEFAULT_PAGES:
        existing = await db.pages.find_one({"slug": page["slug"]})
        if not existing:
            page["updated_at"] = datetime.now(timezone.utc).isoformat()
            page["updated_by"] = None
            await db.pages.insert_one(page)
        else:
            # Migrate existing pages to add missing fields
            update_data = {}
            if "is_system_page" not in existing:
                update_data["is_system_page"] = page["is_system_page"]
            if "content" not in existing:
                update_data["content"] = None
            if update_data:
                await db.pages.update_one(
                    {"slug": page["slug"]},
                    {"$set": update_data}
                )

# Super-admin check
def is_super_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Super-admin access required")
    return current_user

@router.post("", response_model=PageResponse)
async def create_page(
    page_data: PageCreateRequest,
    current_user: dict = Depends(is_super_admin)
):
    """Create a new custom page"""
    # Check if slug already exists
    existing = await db.pages.find_one({"slug": page_data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="A page with this slug already exists")
    
    # Check if path already exists
    existing_path = await db.pages.find_one({"path": page_data.path})
    if existing_path:
        raise HTTPException(status_code=400, detail="A page with this path already exists")
    
    now = datetime.now(timezone.utc).isoformat()
    
    new_page = {
        "slug": page_data.slug,
        "name": page_data.name,
        "path": page_data.path,
        "visible": page_data.visible,
        "is_system_page": False,
        "content": page_data.content or "",
        "blocks": page_data.blocks or [],
        "seo": {
            "title": f"{page_data.name}",
            "description": "",
            "keywords": "",
            "canonical_url": page_data.path,
            "og": {
                "title": page_data.name,
                "description": "",
                "image": "",
                "url": page_data.path
            },
            "twitter": {
                "card": "summary_large_image",
                "site": None,
                "creator": None
            },
            "robots": {
                "index": True,
                "follow": True,
                "noarchive": False,
                "nosnippet": False,
                "noimageindex": False
            }
        },
        "created_at": now,
        "updated_at": now,
        "updated_by": current_user.get("name", current_user.get("email"))
    }
    
    await db.pages.insert_one(new_page)
    return new_page

@router.get("", response_model=List[PageResponse])
async def get_all_pages(current_user: dict = Depends(is_super_admin)):
    """Get all public pages with their settings"""
    await ensure_default_pages()
    
    pages = await db.pages.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return pages

@router.get("/{slug}", response_model=PageResponse)
async def get_page(slug: str, current_user: dict = Depends(is_super_admin)):
    """Get specific page settings"""
    page = await db.pages.find_one({"slug": slug}, {"_id": 0})
    
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    return page

@router.put("/{slug}", response_model=PageResponse)
async def update_page(
    slug: str,
    page_data: PageUpdateRequest,
    current_user: dict = Depends(is_super_admin)
):
    """Update page settings (SEO, visibility, and content)"""
    page = await db.pages.find_one({"slug": slug})
    
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    update_data = {}
    
    if page_data.name is not None:
        update_data["name"] = page_data.name
    
    if page_data.visible is not None:
        update_data["visible"] = page_data.visible
    
    if page_data.content is not None:
        update_data["content"] = page_data.content
    
    if page_data.blocks is not None:
        update_data["blocks"] = page_data.blocks
    
    if page_data.seo is not None:
        update_data["seo"] = page_data.seo.model_dump()
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("name", current_user.get("email"))
    
    await db.pages.update_one(
        {"slug": slug},
        {"$set": update_data}
    )
    
    updated_page = await db.pages.find_one({"slug": slug}, {"_id": 0})
    return updated_page

@router.delete("/{slug}")
async def delete_page(slug: str, current_user: dict = Depends(is_super_admin)):
    """Delete a custom page (system pages cannot be deleted)"""
    page = await db.pages.find_one({"slug": slug})
    
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    if page.get("is_system_page", False):
        raise HTTPException(status_code=400, detail="Cannot delete system pages")
    
    await db.pages.delete_one({"slug": slug})
    
    return {"message": "Page deleted successfully"}

@router.post("/reset/{slug}", response_model=PageResponse)
async def reset_page(slug: str, current_user: dict = Depends(is_super_admin)):
    """Reset page to default settings"""
    default_page = next((p for p in DEFAULT_PAGES if p["slug"] == slug), None)
    
    if not default_page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    reset_data = {
        **default_page,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.get("name", current_user.get("email"))
    }
    
    await db.pages.update_one(
        {"slug": slug},
        {"$set": reset_data},
        upsert=True
    )
    
    updated_page = await db.pages.find_one({"slug": slug}, {"_id": 0})
    return updated_page

@router.post("/upload-og-image/{slug}", response_model=OGImageUploadResponse)
async def upload_og_image(
    slug: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(is_super_admin)
):
    """Upload OG image for a page"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Validate file size (max 5MB)
    file_size = 0
    chunk_size = 1024 * 1024  # 1MB chunks
    temp_file = await file.read()
    file_size = len(temp_file)
    
    if file_size > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")
    
    # Generate unique filename
    file_ext = Path(file.filename).suffix
    unique_filename = f"og_{slug}_{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = UPLOADS_DIR / unique_filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(temp_file)
    
    # Return URL
    file_url = f"/api/uploads/{unique_filename}"
    
    return OGImageUploadResponse(url=file_url, path=str(file_path))

# Public endpoint to fetch page by slug
@router.get("/public/{slug}", response_model=PublicPageResponse)
async def get_public_page(slug: str):
    """Get public page content by slug (no authentication required)"""
    page = await db.pages.find_one(
        {"slug": slug, "visible": True},
        {"_id": 0}
    )
    
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    return {
        "name": page.get("name"),
        "path": page.get("path"),
        "content": page.get("content", ""),
        "blocks": page.get("blocks", []),
        "seo": page.get("seo", {})
    }

@router.get("/{slug}/export", response_model=PageTemplateExport)
async def export_page_template(slug: str, current_user: dict = Depends(is_super_admin)):
    """Export page blocks and content as a template (excludes metadata)"""
    page = await db.pages.find_one({"slug": slug}, {"_id": 0})
    
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    return {
        "blocks": page.get("blocks", []),
        "content": page.get("content", "")
    }

@router.post("/{slug}/import")
async def import_page_template(
    slug: str,
    template: PageTemplateImport,
    current_user: dict = Depends(is_super_admin)
):
    """Import page template and override existing page content"""
    page = await db.pages.find_one({"slug": slug})
    
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Update only blocks and content, preserving all metadata
    update_data = {
        "blocks": template.blocks,
        "content": template.content or "",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.get("name", current_user.get("email"))
    }
    
    await db.pages.update_one(
        {"slug": slug},
        {"$set": update_data}
    )
    
    updated_page = await db.pages.find_one({"slug": slug}, {"_id": 0})
    return updated_page
