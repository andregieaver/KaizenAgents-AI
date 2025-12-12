"""
Tenant settings routes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import datetime, timezone
import uuid

from models import SettingsResponse, SettingsUpdate
from middleware import get_current_user
from middleware.database import db

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("", response_model=SettingsResponse)
@router.get("/", response_model=SettingsResponse)
async def get_settings(current_user: dict = Depends(get_current_user)):
    """Get tenant settings"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    # Mask the API key for security
    if settings.get("openai_api_key"):
        key = settings["openai_api_key"]
        settings["openai_api_key"] = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "****"
    
    return settings

@router.put("", response_model=SettingsResponse)
@router.put("/", response_model=SettingsResponse)
async def update_settings(settings_data: SettingsUpdate, current_user: dict = Depends(get_current_user)):
    """Update tenant settings"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    update_data = {k: v for k, v in settings_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one({"tenant_id": tenant_id}, {"$set": update_data})
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    
    # Mask the API key for security
    if settings.get("openai_api_key"):
        key = settings["openai_api_key"]
        settings["openai_api_key"] = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "****"
    
    return settings

@router.post("/brand-logo")
async def upload_brand_logo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload brand logo image file"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
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
    filename = f"logo_{tenant_id}_{uuid.uuid4().hex[:8]}.{ext}"
    destination_path = f"logos/{filename}"
    
    # Upload to configured storage
    logo_url = await storage.upload_file(contents, destination_path, file.content_type)
    
    # Update settings
    await db.settings.update_one(
        {"tenant_id": tenant_id},
        {"$set": {"brand_logo": logo_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Brand logo uploaded", "brand_logo": logo_url}
