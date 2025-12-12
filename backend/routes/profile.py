"""
Profile routes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid

from models import *
from middleware import get_current_user, get_super_admin_user
from middleware.database import db

# Profile models
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class ProfileResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    avatar_url: Optional[str] = None
    tenant_id: Optional[str] = None
    tenant_name: Optional[str] = None
    created_at: str
    is_super_admin: bool

router = APIRouter(prefix="/profile", tags=["profile"])



@router.get("", response_model=ProfileResponse)
@router.get("/", response_model=ProfileResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's profile"""
    tenant = None
    if current_user.get("tenant_id"):
        tenant = await db.tenants.find_one({"id": current_user["tenant_id"]}, {"_id": 0})
    
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "role": current_user["role"],
        "avatar_url": current_user.get("avatar_url"),
        "tenant_id": current_user.get("tenant_id"),
        "tenant_name": tenant.get("name") if tenant else None,
        "created_at": current_user["created_at"],
        "is_super_admin": is_super_admin(current_user)
    }

@router.put("", response_model=ProfileResponse)
@router.put("/", response_model=ProfileResponse)
async def update_profile(
    profile_data: ProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update current user's profile"""
    update_data = {k: v for k, v in profile_data.model_dump().items() if v is not None}
    
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    # Fetch updated user
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    tenant = None
    if updated_user.get("tenant_id"):
        tenant = await db.tenants.find_one({"id": updated_user["tenant_id"]}, {"_id": 0})
    
    return {
        "id": updated_user["id"],
        "email": updated_user["email"],
        "name": updated_user["name"],
        "role": updated_user["role"],
        "avatar_url": updated_user.get("avatar_url"),
        "tenant_id": updated_user.get("tenant_id"),
        "tenant_name": tenant.get("name") if tenant else None,
        "created_at": updated_user["created_at"],
        "is_super_admin": is_super_admin(updated_user)
    }

@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_user)
):
    """Change current user's password"""
    # Verify current password
    user_with_hash = await db.users.find_one({"id": current_user["id"]})
    if not verify_password(password_data.current_password, user_with_hash["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    new_hash = hash_password(password_data.new_password)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password_hash": new_hash, "requires_password_reset": False}}
    )
    
    return {"message": "Password changed successfully"}

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload avatar image file"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP")
    
    # Validate file size (max 5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size: 5MB")
    
    # Get storage service
    from storage_service import get_storage_service
    storage = await get_storage_service(db)
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    destination_path = f"avatars/{filename}"
    
    # Upload to configured storage
    storage_url = await storage.upload_file(contents, destination_path, file.content_type)
    
    # For GCS storage, store a proxy path instead of the direct GCS URL
    # This allows us to serve images through our backend for proper access control
    if storage_url.startswith('https://storage.googleapis.com/'):
        avatar_url = f"/api/media/avatars/{filename}"
    else:
        avatar_url = storage_url
    
    # Update user
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"avatar_url": avatar_url}}
    )
    
    return {"message": "Avatar uploaded", "avatar_url": avatar_url}

@router.post("/avatar-url")
async def update_avatar_url(
    avatar_url: str,
    current_user: dict = Depends(get_current_user)
):
    """Update avatar via URL"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"avatar_url": avatar_url}}
    )
    
    return {"message": "Avatar updated", "avatar_url": avatar_url}



# Agent availability endpoints
@router.get("/availability")
async def get_availability(current_user: dict = Depends(get_current_user)):
    """Get current user's availability status"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return {"available": user.get("is_available", False)}

@router.post("/availability")
async def set_availability(
    available: bool,
    current_user: dict = Depends(get_current_user)
):
    """Set current user's availability status"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"is_available": available, "availability_updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"available": available}
