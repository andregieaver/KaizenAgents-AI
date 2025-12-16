"""
Feature Gate Admin API Routes
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List, Dict, Any
import logging

from models.feature_gate import (
    FeatureGateRoute, 
    FeatureGateConfig, 
    FeatureGateUpdate,
    RouteLimit,
    SubscriptionPlan
)
from middleware import get_current_user, get_super_admin_user
from middleware.database import db

router = APIRouter(prefix="/feature-gates", tags=["feature-gates"])
logger = logging.getLogger(__name__)

# Default plans
DEFAULT_PLANS = ["free", "basic", "pro", "enterprise"]

# Default gated routes with their configurations
DEFAULT_GATED_ROUTES = [
    {
        "route_path": "/api/agents/",
        "route_method": "POST",
        "route_name": "Create Agent",
        "route_description": "Create a custom AI agent",
        "category": "agents",
        "plans": {
            "free": {"enabled": True, "quota_limit": 2},
            "basic": {"enabled": True, "quota_limit": 5},
            "pro": {"enabled": True, "quota_limit": 20},
            "enterprise": {"enabled": True, "quota_limit": None}
        }
    },
    {
        "route_path": "/api/agents/{agent_id}/publish",
        "route_method": "POST",
        "route_name": "Publish Agent to Marketplace",
        "route_description": "Publish an agent to the public marketplace",
        "category": "agents",
        "plans": {
            "free": {"enabled": False},
            "basic": {"enabled": True, "rate_limit_per_day": 3},
            "pro": {"enabled": True, "rate_limit_per_day": 10},
            "enterprise": {"enabled": True}
        }
    },
    {
        "route_path": "/api/pages/",
        "route_method": "POST",
        "route_name": "Create Page",
        "route_description": "Create a new CMS page",
        "category": "cms",
        "plans": {
            "free": {"enabled": True, "quota_limit": 5},
            "basic": {"enabled": True, "quota_limit": 20},
            "pro": {"enabled": True, "quota_limit": 100},
            "enterprise": {"enabled": True}
        }
    },
    {
        "route_path": "/api/widget/messages/{conversation_id}",
        "route_method": "POST",
        "route_name": "Send Chat Message",
        "route_description": "Send a message to an AI agent",
        "category": "conversations",
        "plans": {
            "free": {"enabled": True, "rate_limit_per_hour": 50, "rate_limit_per_day": 200},
            "basic": {"enabled": True, "rate_limit_per_hour": 200, "rate_limit_per_day": 1000},
            "pro": {"enabled": True, "rate_limit_per_hour": 1000, "rate_limit_per_day": 10000},
            "enterprise": {"enabled": True}
        }
    },
    {
        "route_path": "/api/agents/{agent_id}/upload-image",
        "route_method": "POST",
        "route_name": "Upload Agent Image",
        "route_description": "Upload a profile image for an agent",
        "category": "agents",
        "plans": {
            "free": {"enabled": False},
            "basic": {"enabled": True},
            "pro": {"enabled": True},
            "enterprise": {"enabled": True}
        }
    },
    {
        "route_path": "/api/settings/orchestration",
        "route_method": "PUT",
        "route_name": "Configure Orchestration",
        "route_description": "Enable and configure agent orchestration",
        "category": "orchestration",
        "plans": {
            "free": {"enabled": False},
            "basic": {"enabled": False},
            "pro": {"enabled": True},
            "enterprise": {"enabled": True}
        }
    },
    {
        "route_path": "/api/pages/{page_slug}/export",
        "route_method": "GET",
        "route_name": "Export Page",
        "route_description": "Export a page as HTML",
        "category": "cms",
        "plans": {
            "free": {"enabled": True, "rate_limit_per_day": 5},
            "basic": {"enabled": True, "rate_limit_per_day": 20},
            "pro": {"enabled": True, "rate_limit_per_day": 100},
            "enterprise": {"enabled": True}
        }
    }
]


@router.get("/config", response_model=FeatureGateConfig)
async def get_feature_gate_config(current_user: dict = Depends(get_super_admin_user)):
    """Get feature gate configuration (admin only)"""
    
    # Get existing config or create default
    config = await db.feature_gate_config.find_one({}, {"_id": 0})
    
    if not config:
        # Create default configuration
        config = await _create_default_config()
    
    return config


@router.put("/config")
async def update_feature_gate_config(
    update: FeatureGateUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update feature gate configuration (admin only)"""
    # Check if user is admin
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get existing config
    existing = await db.feature_gate_config.find_one({}, {"_id": 0})
    
    if existing:
        # Update existing
        await db.feature_gate_config.update_one(
            {"id": existing["id"]},
            {
                "$set": {
                    "routes": [route.model_dump() for route in update.routes],
                    "updated_at": now
                }
            }
        )
        config_id = existing["id"]
    else:
        # Create new
        import uuid
        config_id = str(uuid.uuid4())
        config_doc = {
            "id": config_id,
            "routes": [route.model_dump() for route in update.routes],
            "plans": DEFAULT_PLANS,
            "created_at": now,
            "updated_at": now
        }
        await db.feature_gate_config.insert_one(config_doc)
    
    logger.info(f"Feature gate config updated by {current_user.get('email')}")
    
    return {"message": "Feature gate configuration updated", "config_id": config_id}


@router.get("/plans")
async def get_available_plans(current_user: dict = Depends(get_current_user)):
    """Get list of available subscription plans"""
    return {
        "plans": [
            {"name": "free", "display_name": "Free", "description": "Basic features with limits"},
            {"name": "basic", "display_name": "Basic", "description": "More features and higher limits"},
            {"name": "pro", "display_name": "Pro", "description": "Advanced features and orchestration"},
            {"name": "enterprise", "display_name": "Enterprise", "description": "Unlimited access to all features"}
        ]
    }


@router.get("/user-plan")
async def get_user_plan(current_user: dict = Depends(get_current_user)):
    """Get current user's subscription plan"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get subscription from database
    subscription = await db.subscriptions.find_one({"tenant_id": tenant_id}, {"_id": 0})
    
    if not subscription:
        # Default to free plan
        return {
            "tenant_id": tenant_id,
            "plan_name": "free",
            "plan_display_name": "Free",
            "active": True,
            "started_at": datetime.now(timezone.utc).isoformat()
        }
    
    return subscription


@router.put("/user-plan")
async def update_user_plan(
    plan_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Update user's subscription plan (admin only for now)"""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    if plan_name not in DEFAULT_PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan name. Must be one of: {DEFAULT_PLANS}")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update or create subscription
    await db.subscriptions.update_one(
        {"tenant_id": tenant_id},
        {
            "$set": {
                "tenant_id": tenant_id,
                "plan_name": plan_name,
                "plan_display_name": plan_name.capitalize(),
                "active": True,
                "updated_at": now
            },
            "$setOnInsert": {
                "started_at": now
            }
        },
        upsert=True
    )
    
    return {"message": f"Plan updated to {plan_name}"}


async def _create_default_config():
    """Create and store default feature gate configuration"""
    import uuid
    
    config_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    config = {
        "id": config_id,
        "routes": DEFAULT_GATED_ROUTES,
        "plans": DEFAULT_PLANS,
        "created_at": now,
        "updated_at": now
    }
    
    await db.feature_gate_config.insert_one(config)
    
    return config


@router.get("/categories")
async def get_route_categories(current_user: dict = Depends(get_current_user)):
    """Get list of route categories for filtering"""
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    config = await db.feature_gate_config.find_one({}, {"_id": 0})
    
    if not config:
        categories = set(route["category"] for route in DEFAULT_GATED_ROUTES)
    else:
        categories = set(route["category"] for route in config.get("routes", []))
    
    return {"categories": sorted(list(categories))}
