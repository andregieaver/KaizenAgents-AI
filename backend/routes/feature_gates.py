"""
Feature Gate Admin API Routes
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List, Dict, Any
import logging

from models.feature_gate import (
    FeatureQuota, 
    FeatureGateConfig, 
    FeatureGateUpdate,
    PlanLimit,
    SubscriptionPlan
)
from middleware import get_current_user, get_super_admin_user
from middleware.database import db

router = APIRouter(prefix="/feature-gates", tags=["feature-gates"])
logger = logging.getLogger(__name__)

# Default plans
DEFAULT_PLANS = ["free", "basic", "pro", "enterprise"]

# Default company quota features
DEFAULT_QUOTA_FEATURES = [
    {
        "feature_key": "max_agents",
        "feature_name": "Maximum Active Agents",
        "feature_description": "Maximum number of AI agents that can be active simultaneously",
        "category": "agents",
        "limit_type": "quota",
        "unit": "agents",
        "plans": {
            "free": {"enabled": True, "limit_value": 2, "limit_type": "quota", "unit": "agents"},
            "basic": {"enabled": True, "limit_value": 5, "limit_type": "quota", "unit": "agents"},
            "pro": {"enabled": True, "limit_value": 20, "limit_type": "quota", "unit": "agents"},
            "enterprise": {"enabled": True, "limit_value": None, "limit_type": "quota", "unit": "agents"}
        }
    },
    {
        "feature_key": "max_seats",
        "feature_name": "Maximum Company Seats",
        "feature_description": "Maximum number of team members/users allowed in the company",
        "category": "team",
        "limit_type": "quota",
        "unit": "seats",
        "plans": {
            "free": {"enabled": True, "limit_value": 1, "limit_type": "quota", "unit": "seats"},
            "basic": {"enabled": True, "limit_value": 5, "limit_type": "quota", "unit": "seats"},
            "pro": {"enabled": True, "limit_value": 25, "limit_type": "quota", "unit": "seats"},
            "enterprise": {"enabled": True, "limit_value": None, "limit_type": "quota", "unit": "seats"}
        }
    },
    {
        "feature_key": "monthly_token_limit",
        "feature_name": "Monthly Token Usage",
        "feature_description": "Maximum LLM tokens (API calls) allowed per month",
        "category": "usage",
        "limit_type": "usage",
        "unit": "tokens",
        "plans": {
            "free": {"enabled": True, "limit_value": 100000, "limit_type": "usage", "unit": "tokens"},
            "basic": {"enabled": True, "limit_value": 500000, "limit_type": "usage", "unit": "tokens"},
            "pro": {"enabled": True, "limit_value": 5000000, "limit_type": "usage", "unit": "tokens"},
            "enterprise": {"enabled": True, "limit_value": None, "limit_type": "usage", "unit": "tokens"}
        }
    },
    {
        "feature_key": "monthly_messages",
        "feature_name": "Monthly Message Limit",
        "feature_description": "Maximum chat messages users can send per month",
        "category": "usage",
        "limit_type": "usage",
        "unit": "messages",
        "plans": {
            "free": {"enabled": True, "limit_value": 1000, "limit_type": "usage", "unit": "messages"},
            "basic": {"enabled": True, "limit_value": 10000, "limit_type": "usage", "unit": "messages"},
            "pro": {"enabled": True, "limit_value": 100000, "limit_type": "usage", "unit": "messages"},
            "enterprise": {"enabled": True, "limit_value": None, "limit_type": "usage", "unit": "messages"}
        }
    },
    {
        "feature_key": "max_pages",
        "feature_name": "Maximum CMS Pages",
        "feature_description": "Maximum number of CMS pages that can be created",
        "category": "content",
        "limit_type": "quota",
        "unit": "pages",
        "plans": {
            "free": {"enabled": True, "limit_value": 5, "limit_type": "quota", "unit": "pages"},
            "basic": {"enabled": True, "limit_value": 25, "limit_type": "quota", "unit": "pages"},
            "pro": {"enabled": True, "limit_value": 100, "limit_type": "quota", "unit": "pages"},
            "enterprise": {"enabled": True, "limit_value": None, "limit_type": "quota", "unit": "pages"}
        }
    },
    {
        "feature_key": "marketplace_publishing",
        "feature_name": "Marketplace Publishing",
        "feature_description": "Ability to publish agents to the public marketplace",
        "category": "agents",
        "limit_type": "quota",
        "unit": "feature",
        "plans": {
            "free": {"enabled": False, "limit_value": 0, "limit_type": "quota", "unit": "feature"},
            "basic": {"enabled": True, "limit_value": 3, "limit_type": "quota", "unit": "publishes/month"},
            "pro": {"enabled": True, "limit_value": 10, "limit_type": "quota", "unit": "publishes/month"},
            "enterprise": {"enabled": True, "limit_value": None, "limit_type": "quota", "unit": "publishes/month"}
        }
    },
    {
        "feature_key": "orchestration",
        "feature_name": "Agent Orchestration",
        "feature_description": "Advanced multi-agent orchestration (Mother/Child architecture)",
        "category": "agents",
        "limit_type": "quota",
        "unit": "feature",
        "plans": {
            "free": {"enabled": False, "limit_value": 0, "limit_type": "quota", "unit": "feature"},
            "basic": {"enabled": False, "limit_value": 0, "limit_type": "quota", "unit": "feature"},
            "pro": {"enabled": True, "limit_value": 1, "limit_type": "quota", "unit": "feature"},
            "enterprise": {"enabled": True, "limit_value": 1, "limit_type": "quota", "unit": "feature"}
        }
    },
    {
        "feature_key": "custom_branding",
        "feature_name": "Custom Branding",
        "feature_description": "Custom logos, colors, and white-label branding",
        "category": "branding",
        "limit_type": "quota",
        "unit": "feature",
        "plans": {
            "free": {"enabled": False, "limit_value": 0, "limit_type": "quota", "unit": "feature"},
            "basic": {"enabled": True, "limit_value": 1, "limit_type": "quota", "unit": "feature"},
            "pro": {"enabled": True, "limit_value": 1, "limit_type": "quota", "unit": "feature"},
            "enterprise": {"enabled": True, "limit_value": 1, "limit_type": "quota", "unit": "feature"}
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
    current_user: dict = Depends(get_super_admin_user)
):
    """Update feature gate configuration (admin only)"""
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get existing config
    existing = await db.feature_gate_config.find_one({}, {"_id": 0})
    
    if existing:
        # Update existing
        await db.feature_gate_config.update_one(
            {"id": existing["id"]},
            {
                "$set": {
                    "features": [feature.model_dump() for feature in update.features],
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
            "features": [feature.model_dump() for feature in update.features],
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
    current_user: dict = Depends(get_super_admin_user)
):
    """Update user's subscription plan (admin only for now)"""
    
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
        "features": DEFAULT_QUOTA_FEATURES,
        "plans": DEFAULT_PLANS,
        "created_at": now,
        "updated_at": now
    }
    
    await db.feature_gate_config.insert_one(config)
    
    return config


@router.get("/categories")
async def get_route_categories(current_user: dict = Depends(get_super_admin_user)):
    """Get list of route categories for filtering"""
    
    config = await db.feature_gate_config.find_one({}, {"_id": 0})
    
    if not config:
        categories = set(feature["category"] for feature in DEFAULT_QUOTA_FEATURES)
    else:
        categories = set(feature["category"] for feature in config.get("features", []))
    
    return {"categories": sorted(list(categories))}
