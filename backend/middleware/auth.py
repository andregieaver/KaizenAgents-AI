import os
import jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from datetime import datetime, timezone, timedelta
from .database import get_db

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-super-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

__all__ = ['hash_password', 'verify_password', 'create_token', 'decode_token', 
           'get_current_user', 'is_super_admin', 'get_super_admin_user', 
           'can_manage_users', 'get_admin_or_owner_user', 'JWT_SECRET', 'JWT_ALGORITHM']

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, tenant_id: Optional[str] = None) -> str:
    payload = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db = Depends(get_db)
):
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    payload = decode_token(token)
    
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user

SUPER_ADMIN_EMAIL = "andre@humanweb.no"

def is_super_admin(user: dict) -> bool:
    """Check if user is a super admin"""
    return user.get("email") == SUPER_ADMIN_EMAIL or user.get("role") == "super_admin" or user.get("is_super_admin", False)

async def get_super_admin_user(current_user: dict = Depends(get_current_user)):
    """Dependency for super admin-only routes"""
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required"
        )
    return current_user

def can_manage_users(user: dict) -> bool:
    """Check if user can manage other users (owner or admin)"""
    return user.get("role") in ["owner", "admin"]

async def get_admin_or_owner_user(current_user: dict = Depends(get_current_user)):
    """Dependency for admin/owner routes"""
    if not can_manage_users(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or owner access required"
        )
    return current_user
