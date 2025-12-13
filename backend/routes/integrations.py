"""
Integrations management routes (Super Admin only)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import os

from middleware import get_super_admin_user
from middleware.database import db

router = APIRouter(prefix="/admin/integrations", tags=["integrations"])

# Models
class StripeSettingsUpdate(BaseModel):
    use_live_mode: Optional[bool] = None
    test_publishable_key: Optional[str] = None
    test_secret_key: Optional[str] = None
    test_webhook_secret: Optional[str] = None
    live_publishable_key: Optional[str] = None
    live_secret_key: Optional[str] = None
    live_webhook_secret: Optional[str] = None

class CodeInjectionUpdate(BaseModel):
    head_code: Optional[str] = None
    body_start_code: Optional[str] = None
    body_end_code: Optional[str] = None

# Helper to mask sensitive keys
def mask_key(key: str) -> str:
    if not key or len(key) < 8:
        return "••••••••"
    return f"{key[:4]}••••{key[-4:]}"

@router.get("")
async def get_integration_settings(admin_user: dict = Depends(get_super_admin_user)):
    """Get all integration settings (Super Admin only)"""
    
    # Get Stripe settings
    stripe_settings = await db.platform_settings.find_one(
        {"key": "stripe_integration"}, 
        {"_id": 0}
    )
    
    stripe_data = {
        "use_live_mode": False,
        "test_publishable_key": "",
        "test_secret_key_set": False,
        "test_webhook_secret_set": False,
        "live_publishable_key": "",
        "live_secret_key_set": False,
        "live_webhook_secret_set": False
    }
    
    if stripe_settings and stripe_settings.get("value"):
        value = stripe_settings["value"]
        stripe_data = {
            "use_live_mode": value.get("use_live_mode", False),
            "test_publishable_key": value.get("test_publishable_key", ""),
            "test_secret_key_set": bool(value.get("test_secret_key")),
            "test_webhook_secret_set": bool(value.get("test_webhook_secret")),
            "live_publishable_key": value.get("live_publishable_key", ""),
            "live_secret_key_set": bool(value.get("live_secret_key")),
            "live_webhook_secret_set": bool(value.get("live_webhook_secret"))
        }
    
    # Get code injection settings
    code_settings = await db.platform_settings.find_one(
        {"key": "code_injection"},
        {"_id": 0}
    )
    
    code_data = {
        "head_code": "",
        "body_start_code": "",
        "body_end_code": ""
    }
    
    if code_settings and code_settings.get("value"):
        code_data = code_settings["value"]
    
    return {
        "stripe": stripe_data,
        "code_injection": code_data
    }

@router.put("/stripe")
async def update_stripe_settings(
    settings: StripeSettingsUpdate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Update Stripe integration settings (Super Admin only)"""
    
    # Get existing settings
    existing = await db.platform_settings.find_one(
        {"key": "stripe_integration"},
        {"_id": 0}
    )
    
    current_value = existing.get("value", {}) if existing else {}
    
    # Update only provided fields
    update_data = {}
    
    if settings.use_live_mode is not None:
        update_data["use_live_mode"] = settings.use_live_mode
    
    if settings.test_publishable_key is not None:
        update_data["test_publishable_key"] = settings.test_publishable_key
    
    if settings.test_secret_key is not None and settings.test_secret_key:
        update_data["test_secret_key"] = settings.test_secret_key
    
    if settings.test_webhook_secret is not None and settings.test_webhook_secret:
        update_data["test_webhook_secret"] = settings.test_webhook_secret
    
    if settings.live_publishable_key is not None:
        update_data["live_publishable_key"] = settings.live_publishable_key
    
    if settings.live_secret_key is not None and settings.live_secret_key:
        update_data["live_secret_key"] = settings.live_secret_key
    
    if settings.live_webhook_secret is not None and settings.live_webhook_secret:
        update_data["live_webhook_secret"] = settings.live_webhook_secret
    
    # Merge with existing
    merged = {**current_value, **update_data}
    merged["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.platform_settings.update_one(
        {"key": "stripe_integration"},
        {"$set": {"key": "stripe_integration", "value": merged}},
        upsert=True
    )
    
    # Also update the environment variables dynamically (for current session)
    # Note: This doesn't persist across restarts - use .env for that
    if settings.use_live_mode:
        if merged.get("live_secret_key"):
            os.environ["STRIPE_SECRET_KEY"] = merged["live_secret_key"]
        if merged.get("live_webhook_secret"):
            os.environ["STRIPE_WEBHOOK_SECRET"] = merged["live_webhook_secret"]
    else:
        if merged.get("test_secret_key"):
            os.environ["STRIPE_SECRET_KEY"] = merged["test_secret_key"]
        if merged.get("test_webhook_secret"):
            os.environ["STRIPE_WEBHOOK_SECRET"] = merged["test_webhook_secret"]
    
    return {"message": "Stripe settings updated successfully"}

@router.put("/code-injection")
async def update_code_injection(
    settings: CodeInjectionUpdate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Update code injection settings (Super Admin only)"""
    
    # Get existing settings
    existing = await db.platform_settings.find_one(
        {"key": "code_injection"},
        {"_id": 0}
    )
    
    current_value = existing.get("value", {}) if existing else {}
    
    # Update only provided fields
    update_data = {}
    
    if settings.head_code is not None:
        update_data["head_code"] = settings.head_code
    
    if settings.body_start_code is not None:
        update_data["body_start_code"] = settings.body_start_code
    
    if settings.body_end_code is not None:
        update_data["body_end_code"] = settings.body_end_code
    
    # Merge with existing
    merged = {**current_value, **update_data}
    merged["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.platform_settings.update_one(
        {"key": "code_injection"},
        {"$set": {"key": "code_injection", "value": merged}},
        upsert=True
    )
    
    return {"message": "Code injection settings updated successfully"}

@router.get("/code-injection/public")
async def get_public_code_injection():
    """Get code injection for public pages (no auth required)"""
    
    code_settings = await db.platform_settings.find_one(
        {"key": "code_injection"},
        {"_id": 0}
    )
    
    if not code_settings or not code_settings.get("value"):
        return {
            "head_code": "",
            "body_start_code": "",
            "body_end_code": ""
        }
    
    return code_settings["value"]
