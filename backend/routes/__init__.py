"""
API Routes
"""
from fastapi import APIRouter

# Create routers
auth_router = APIRouter(prefix="/auth", tags=["auth"])
tenants_router = APIRouter(prefix="/tenants", tags=["tenants"])
conversations_router = APIRouter(prefix="/conversations", tags=["conversations"])
settings_router = APIRouter(prefix="/settings", tags=["settings"])
widget_router = APIRouter(prefix="/widget", tags=["widget"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])
users_router = APIRouter(prefix="/users", tags=["users"])
profile_router = APIRouter(prefix="/profile", tags=["profile"])
api_stats_router = APIRouter(tags=["api"])

__all__ = [
    "auth_router",
    "tenants_router",
    "conversations_router",
    "settings_router",
    "widget_router",
    "admin_router",
    "users_router",
    "profile_router",
    "api_stats_router"
]
