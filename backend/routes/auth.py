"""
Authentication routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone, timedelta
import uuid
import secrets
import logging

from models import UserCreate, UserLogin
from middleware import get_current_user
from middleware.database import db
from middleware.auth import create_token, hash_password, verify_password, is_super_admin
from utils.password_validator import validate_password

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/register", response_model=dict)
async def register(user_data: UserCreate):
    """Register a new user and create their workspace"""
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Create tenant for new user
    tenant_id = str(uuid.uuid4())
    tenant_doc = {
        "id": tenant_id,
        "name": f"{user_data.name}'s Workspace",
        "domain": None,
        "created_at": now
    }
    await db.tenants.insert_one(tenant_doc)
    
    # Create default settings for tenant
    settings_id = str(uuid.uuid4())
    settings_doc = {
        "id": settings_id,
        "tenant_id": tenant_id,
        "brand_name": f"{user_data.name}'s Support",
        "brand_logo": None,
        "primary_color": "#0047AB",
        "widget_position": "bottom-right",
        "widget_theme": "light",
        "welcome_message": "Hi! How can we help you today?",
        "ai_persona": "You are a helpful and friendly customer support assistant.",
        "ai_tone": "friendly",
        "openai_api_key": None,
        "ai_model": "gpt-4o-mini",
        "date_format": "MM/DD/YYYY",
        "time_format": "12h",
        "timezone": "UTC",
        "updated_at": now
    }
    await db.settings.insert_one(settings_doc)
    
    # Create user
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": "owner",
        "tenant_id": tenant_id,
        "created_at": now
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, tenant_id)
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user_data.email,
            "name": user_data.name,
            "role": "owner",
            "tenant_id": tenant_id,
            "created_at": now
        }
    }

@router.post("/login", response_model=dict)
async def login(credentials: UserLogin):
    """Authenticate user and return JWT token"""
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user.get("tenant_id"))
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "tenant_id": user.get("tenant_id"),
            "created_at": user["created_at"],
            "is_super_admin": is_super_admin(user)
        }
    }

@router.get("/me", response_model=dict)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info"""
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "role": current_user["role"],
        "tenant_id": current_user.get("tenant_id"),
        "created_at": current_user["created_at"],
        "is_super_admin": is_super_admin(current_user)
    }


# ============== PASSWORD RESET ==============

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Request a password reset email"""
    email = request.email.lower().strip()
    
    # Check if user exists
    user = await db.users.find_one({"email": email}, {"_id": 0})
    
    # Always return success to prevent email enumeration
    if not user:
        logger.info(f"Password reset requested for non-existent email: {email}")
        return {"message": "If an account exists with this email, you will receive a password reset link."}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    expiry = datetime.now(timezone.utc) + timedelta(hours=1)  # Token valid for 1 hour
    
    # Store reset token in database
    await db.password_resets.delete_many({"email": email})  # Remove any existing tokens
    await db.password_resets.insert_one({
        "id": str(uuid.uuid4()),
        "email": email,
        "token": reset_token,
        "expires_at": expiry.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "used": False
    })
    
    # Try to send email via SendGrid
    email_sent = await send_password_reset_email(email, user.get("name", "User"), reset_token)
    
    if email_sent:
        logger.info(f"Password reset email sent to: {email}")
    else:
        logger.warning(f"Failed to send password reset email to: {email}")
    
    return {"message": "If an account exists with this email, you will receive a password reset link."}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password using token"""
    # Find the reset token
    reset_record = await db.password_resets.find_one({
        "token": request.token,
        "used": False
    }, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check if token has expired
    expiry = datetime.fromisoformat(reset_record["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    # Validate password
    is_valid, error_message = validate_password(request.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_message)
    
    # Update user password
    email = reset_record["email"]
    new_hash = hash_password(request.new_password)
    
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Mark token as used
    await db.password_resets.update_one(
        {"token": request.token},
        {"$set": {"used": True}}
    )
    
    logger.info(f"Password reset successful for: {email}")
    
    return {"message": "Password has been reset successfully. You can now log in with your new password."}


@router.get("/verify-reset-token/{token}")
async def verify_reset_token(token: str):
    """Verify if a password reset token is valid"""
    reset_record = await db.password_resets.find_one({
        "token": token,
        "used": False
    }, {"_id": 0})
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check if token has expired
    expiry = datetime.fromisoformat(reset_record["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    return {"valid": True, "email": reset_record["email"]}


async def send_password_reset_email(email: str, name: str, token: str) -> bool:
    """Send password reset email using email service"""
    try:
        from services.email_service import EmailService
        import os
        
        # Build reset URL - use frontend URL
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        reset_url = f"{frontend_url}/reset-password?token={token}"
        
        return await EmailService.send_password_reset_email(
            to_email=email,
            user_name=name,
            reset_url=reset_url,
            expiry_hours=1
        )
        
    except Exception as e:
        logger.error(f"Failed to send password reset email: {str(e)}")
        return False
