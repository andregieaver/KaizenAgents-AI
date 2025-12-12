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

router = APIRouter(prefix="/profile", tags=["profile"])

api_router.include_router(transfer_router)


@admin_router.get("/storage-config", response_model=StorageConfigResponse)
async def get_storage_config(admin_user: dict = Depends(get_super_admin_user)):
    """Get storage configuration (Super Admin only)"""
    config = await db.storage_config.find_one({}, {"_id": 0})
    
    if not config:
        return {
            "storage_type": "local",
            "gcs_bucket_name": None,
            "gcs_region": None,
            "gcs_configured": False,
            "updated_at": None
        }
    
    return {
        "storage_type": config.get("storage_type", "local"),
        "gcs_bucket_name": config.get("gcs_bucket_name"),
        "gcs_region": config.get("gcs_region"),
        "gcs_configured": bool(config.get("gcs_service_account_json")),
        "updated_at": config.get("updated_at")
    }

@admin_router.post("/storage-config")
async def update_storage_config(
    config: StorageConfigCreate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Update storage configuration (Super Admin only)"""
    
    # Validate GCS configuration
    if config.storage_type == "gcs":
        if not config.gcs_service_account_json or not config.gcs_bucket_name:
            raise HTTPException(
                status_code=400,
                detail="GCS requires service account JSON and bucket name"
            )
        
        # Validate JSON format
        try:
            import json
            json.loads(config.gcs_service_account_json)
        except:
            raise HTTPException(status_code=400, detail="Invalid service account JSON")
    
    # Prepare config document
    config_doc = {
        "storage_type": config.storage_type,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin_user["id"]
    }
    
    if config.storage_type == "gcs":
        config_doc.update({
            "gcs_service_account_json": config.gcs_service_account_json,
            "gcs_bucket_name": config.gcs_bucket_name,
            "gcs_region": config.gcs_region or "us-central1"
        })
    
    # Upsert configuration (only one config document)
    await db.storage_config.update_one(
        {},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"status": "success", "message": "Storage configuration updated"}

@admin_router.post("/storage-config/test-gcs")
async def test_gcs_connection(admin_user: dict = Depends(get_super_admin_user)):
    """Test GCS connection with current configuration"""
    config = await db.storage_config.find_one({}, {"_id": 0})
    
    if not config or config.get("storage_type") != "gcs":
        raise HTTPException(status_code=400, detail="GCS not configured")
    
    try:
        from google.cloud import storage
        import json
        import tempfile
        
        # Create credentials from JSON
        service_account_info = json.loads(config["gcs_service_account_json"])
        
        # Test connection
        client = storage.Client.from_service_account_info(service_account_info)
        bucket = client.bucket(config["gcs_bucket_name"])
        
        # Check if bucket exists and is accessible
        exists = bucket.exists()
        
        if exists:
            return {
                "status": "success",
                "message": f"Successfully connected to bucket: {config['gcs_bucket_name']}",
                "bucket_exists": True
            }
        else:
            return {
                "status": "warning",
                "message": f"Bucket '{config['gcs_bucket_name']}' does not exist. You may need to create it.",
                "bucket_exists": False
            }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"GCS connection failed: {str(e)}"
        )


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


@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}