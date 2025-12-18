"""
Users routes
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, BackgroundTasks
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import jwt

from models import *
from middleware import get_current_user, get_super_admin_user, get_admin_or_owner_user
from middleware.database import db
from middleware.auth import create_token, hash_password, verify_password, is_super_admin, JWT_SECRET, JWT_ALGORITHM

# User management models
class UserInvite(BaseModel):
    email: EmailStr
    name: str
    role: Literal["admin", "agent", "viewer"] = "agent"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["owner", "admin", "agent", "viewer"]] = None

class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    avatar_url: Optional[str] = None
    created_at: str
    last_login: Optional[str] = None

router = APIRouter(prefix="/users", tags=["users"])

@router.get("", response_model=List[TeamMemberResponse])
@router.get("/", response_model=List[TeamMemberResponse])
async def list_team_members(current_user: dict = Depends(get_current_user)):
    """List all users in the current tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    users = await db.users.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", 1).to_list(100)
    
    return users

@router.post("/invite", response_model=TeamMemberResponse)
async def invite_user(
    user_data: UserInvite,
    admin_user: dict = Depends(get_admin_or_owner_user),
    background_tasks: BackgroundTasks = None
):
    """Invite a new user to the tenant (admin only)"""
    tenant_id = admin_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check quota limit for max seats
    from services.quota_service import check_quota_limit
    await check_quota_limit(tenant_id, "max_seats", increment=1)
    
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    now = datetime.now(timezone.utc).isoformat()
    user_id = str(uuid.uuid4())
    
    # Generate a temporary password (user should reset)
    temp_password = str(uuid.uuid4())[:12]
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(temp_password),
        "name": user_data.name,
        "role": user_data.role,
        "tenant_id": tenant_id,
        "avatar_url": None,
        "created_at": now,
        "last_login": None,
        "invited_by": admin_user["id"],
        "requires_password_reset": True
    }
    await db.users.insert_one(user_doc)
    
    # Get company/team name for email
    company = await db.companies.find_one({"id": tenant_id}, {"_id": 0, "name": 1})
    team_name = company.get("name", "the team") if company else "the team"
    
    # Send invitation email (non-blocking)
    import os
    import asyncio
    from services.email_service import EmailService
    
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    login_url = f"{frontend_url}/login"
    
    # Send email asynchronously
    asyncio.create_task(
        EmailService.send_team_invite_email(
            to_email=user_data.email,
            user_name=user_data.name,
            inviter_name=admin_user.get("name", "Admin"),
            team_name=team_name,
            user_role=user_data.role.capitalize(),
            invite_url=login_url,
            temp_password=temp_password
        )
    )
    
    # Return user without sensitive data
    return {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "avatar_url": None,
        "created_at": now,
        "last_login": None,
        "temp_password": temp_password  # Return this once so admin can share with user
    }

@router.get("/{user_id}", response_model=TeamMemberResponse)
async def get_team_member(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific team member"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    user = await db.users.find_one(
        {"id": user_id, "tenant_id": tenant_id},
        {"_id": 0, "password_hash": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@router.patch("/{user_id}", response_model=TeamMemberResponse)
async def update_team_member(
    user_id: str,
    user_data: UserUpdate,
    admin_user: dict = Depends(get_admin_or_owner_user)
):
    """Update a team member (admin only)"""
    tenant_id = admin_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Find the user
    user = await db.users.find_one({"id": user_id, "tenant_id": tenant_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot change owner's role if you're not owner
    if user.get("role") == "owner" and admin_user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Cannot modify owner")
    
    # Cannot make yourself non-admin
    if user_id == admin_user["id"] and user_data.role and user_data.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Cannot demote yourself")
    
    update_data = {k: v for k, v in user_data.model_dump().items() if v is not None}
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0}
    )
    return updated_user

@router.delete("/{user_id}")
async def remove_team_member(
    user_id: str,
    admin_user: dict = Depends(get_admin_or_owner_user)
):
    """Remove a user from the tenant (admin only)"""
    tenant_id = admin_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Find the user
    user = await db.users.find_one({"id": user_id, "tenant_id": tenant_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot remove yourself
    if user_id == admin_user["id"]:
        raise HTTPException(status_code=403, detail="Cannot remove yourself")
    
    # Cannot remove owner
    if user.get("role") == "owner":
        raise HTTPException(status_code=403, detail="Cannot remove tenant owner")
    
    await db.users.delete_one({"id": user_id})
    return {"message": f"User {user['email']} removed from team"}