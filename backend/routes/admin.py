"""
Admin routes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import jwt

from models import SettingsUpdate
from middleware import get_current_user, get_super_admin_user, get_admin_or_owner_user
from middleware.database import db
from middleware.auth import create_token, hash_password, verify_password, is_super_admin, JWT_SECRET, JWT_ALGORITHM, SUPER_ADMIN_EMAIL

# Admin-specific models
class PlatformSettingsUpdate(BaseModel):
    platform_name: Optional[str] = None
    platform_logo: Optional[str] = None
    maintenance_mode: Optional[bool] = None
    max_tenants: Optional[int] = None
    default_ai_model: Optional[str] = None
    announcement: Optional[str] = None

class TenantAdminUpdate(BaseModel):
    is_active: Optional[bool] = None
    max_conversations: Optional[int] = None
    features: Optional[List[str]] = None

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/check")
async def check_super_admin(current_user: dict = Depends(get_current_user)):
    """Check if current user is super admin"""
    return {"is_super_admin": is_super_admin(current_user)}

@router.get("/platform-stats")
async def get_platform_stats(admin_user: dict = Depends(get_super_admin_user)):
    """Get platform-wide statistics (super admin only)"""
    total_tenants = await db.tenants.count_documents({})
    total_users = await db.users.count_documents({})
    total_conversations = await db.conversations.count_documents({})
    total_messages = await db.messages.count_documents({})
    
    # Get active tenants (with conversations in last 7 days)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    active_conversations = await db.conversations.count_documents({"updated_at": {"$gte": week_ago}})
    
    # Get tenant breakdown
    tenants = await db.tenants.find({}, {"_id": 0}).to_list(100)
    tenant_stats = []
    for tenant in tenants:
        conv_count = await db.conversations.count_documents({"tenant_id": tenant["id"]})
        user_count = await db.users.count_documents({"tenant_id": tenant["id"]})
        tenant_stats.append({
            "id": tenant["id"],
            "name": tenant["name"],
            "conversations": conv_count,
            "users": user_count,
            "created_at": tenant["created_at"]
        })
    
    return {
        "total_tenants": total_tenants,
        "total_users": total_users,
        "total_conversations": total_conversations,
        "total_messages": total_messages,
        "active_conversations_7d": active_conversations,
        "tenants": tenant_stats
    }

@router.get("/platform-settings")
async def get_platform_settings(admin_user: dict = Depends(get_super_admin_user)):
    """Get platform settings (super admin only)"""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    if not settings:
        # Return default settings
        settings = {
            "id": "platform",
            "platform_name": "AI Support Hub",
            "maintenance_mode": False,
            "max_tenants": 1000,
            "default_ai_model": "gpt-4o-mini",
            "announcement": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.platform_settings.insert_one(settings)
    return settings

@router.put("/platform-settings")
async def update_platform_settings(
    settings_data: PlatformSettingsUpdate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Update platform settings (super admin only)"""
    update_data = {k: v for k, v in settings_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.platform_settings.update_one(
        {"id": "platform"},
        {"$set": update_data},
        upsert=True
    )
    
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    return settings

@router.post("/platform-logo")
async def upload_platform_logo(
    file: UploadFile = File(...),
    admin_user: dict = Depends(get_super_admin_user)
):
    """Upload platform logo image file (super admin only)"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG")
    
    # Validate file size (max 5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size: 5MB")
    
    # Get storage service
    from storage_service import get_storage_service
    storage = await get_storage_service(db)
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"platform_logo_{uuid.uuid4().hex[:8]}.{ext}"
    destination_path = f"platform/{filename}"
    
    # Upload to configured storage
    logo_url = await storage.upload_file(contents, destination_path, file.content_type)
    
    # Update platform settings
    await db.platform_settings.update_one(
        {"id": "platform"},
        {"$set": {"platform_logo": logo_url, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"message": "Platform logo uploaded", "platform_logo": logo_url}

@router.get("/tenants")
async def list_all_tenants(admin_user: dict = Depends(get_super_admin_user)):
    """List all tenants (super admin only)"""
    tenants = await db.tenants.find({}, {"_id": 0}).to_list(1000)
    
    # Enrich with stats
    enriched_tenants = []
    for tenant in tenants:
        settings = await db.settings.find_one({"tenant_id": tenant["id"]}, {"_id": 0})
        conv_count = await db.conversations.count_documents({"tenant_id": tenant["id"]})
        user_count = await db.users.count_documents({"tenant_id": tenant["id"]})
        
        enriched_tenants.append({
            **tenant,
            "conversation_count": conv_count,
            "user_count": user_count,
            "has_api_key": bool(settings and settings.get("openai_api_key")),
            "brand_name": settings.get("brand_name") if settings else None,
            "brand_logo": settings.get("brand_logo") if settings else None
        })
    
    return enriched_tenants

@router.get("/tenants/{tenant_id}")
async def get_tenant_details(tenant_id: str, admin_user: dict = Depends(get_super_admin_user)):
    """Get detailed tenant info (super admin only)"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    users = await db.users.find({"tenant_id": tenant_id}, {"_id": 0, "password_hash": 0}).to_list(100)
    conversations = await db.conversations.find({"tenant_id": tenant_id}, {"_id": 0}).sort("updated_at", -1).to_list(50)
    
    return {
        "tenant": tenant,
        "settings": settings,
        "users": users,
        "recent_conversations": conversations,
        "stats": {
            "total_users": len(users),
            "total_conversations": await db.conversations.count_documents({"tenant_id": tenant_id}),
            "open_conversations": await db.conversations.count_documents({"tenant_id": tenant_id, "status": "open"}),
            "total_messages": await db.messages.count_documents({"conversation_id": {"$in": [c["id"] for c in conversations]}})
        }
    }

@router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, admin_user: dict = Depends(get_super_admin_user)):
    """Delete a tenant and all associated data (super admin only)"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Delete all associated data
    conversations = await db.conversations.find({"tenant_id": tenant_id}, {"id": 1}).to_list(10000)
    conv_ids = [c["id"] for c in conversations]
    
    await db.messages.delete_many({"conversation_id": {"$in": conv_ids}})
    await db.conversations.delete_many({"tenant_id": tenant_id})
    await db.settings.delete_many({"tenant_id": tenant_id})
    await db.users.delete_many({"tenant_id": tenant_id})
    await db.tenants.delete_one({"id": tenant_id})
    
    return {"message": f"Tenant {tenant_id} and all associated data deleted"}

@router.get("/users")
async def list_all_users(admin_user: dict = Depends(get_super_admin_user)):
    """List all users across all tenants (super admin only)"""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    # Enrich with tenant names
    enriched_users = []
    for user in users:
        tenant = await db.tenants.find_one({"id": user.get("tenant_id")}, {"_id": 0, "name": 1})
        enriched_users.append({
            **user,
            "tenant_name": tenant.get("name") if tenant else "No tenant",
            "is_super_admin": is_super_admin(user)
        })
    
    return enriched_users

@router.post("/users/{user_id}/make-super-admin")
async def make_super_admin(user_id: str, admin_user: dict = Depends(get_super_admin_user)):
    """Grant super admin role to a user (super admin only)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one({"id": user_id}, {"$set": {"role": "super_admin"}})
    return {"message": f"User {user['email']} is now a super admin"}

@router.post("/users/{user_id}/revoke-super-admin")
async def revoke_super_admin(user_id: str, admin_user: dict = Depends(get_super_admin_user)):
    """Revoke super admin role from a user (super admin only)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot revoke from the primary super admin
    if user.get("email") == SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Cannot revoke super admin from primary admin")
    
    await db.users.update_one({"id": user_id}, {"$set": {"role": "owner"}})
    return {"message": f"Super admin revoked from {user['email']}"}