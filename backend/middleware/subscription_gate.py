"""
Subscription-based feature gating middleware
"""
from fastapi import HTTPException, Request
from typing import Optional, Dict, Any
from datetime import datetime, timezone

from middleware.database import db

class SubscriptionGate:
    """Check subscription limits and features"""
    
    @staticmethod
    async def check_feature_access(tenant_id: str, feature: str) -> bool:
        """Check if tenant has access to a specific feature"""
        subscription = await db.subscriptions.find_one({"tenant_id": tenant_id}, {"_id": 0})
        if not subscription or subscription.get("status") != "active":
            return False
        
        plan = await db.subscription_plans.find_one({"id": subscription["plan_id"]}, {"_id": 0})
        if not plan:
            return False
        
        features = plan.get("features", {})
        return features.get(feature, False)
    
    @staticmethod
    async def check_usage_limit(tenant_id: str, resource: str) -> Dict[str, Any]:
        """
        Check if tenant has exceeded usage limits
        Returns: {
            "allowed": bool,
            "limit": int,
            "current": int,
            "percentage": float,
            "is_soft_limit": bool  # Warning threshold reached
        }
        """
        subscription = await db.subscriptions.find_one({"tenant_id": tenant_id}, {"_id": 0})
        if not subscription:
            return {"allowed": False, "error": "No subscription found"}
        
        plan = await db.subscription_plans.find_one({"id": subscription["plan_id"]}, {"_id": 0})
        if not plan:
            return {"allowed": False, "error": "Plan not found"}
        
        features = plan.get("features", {})
        
        # Get current period
        period_start = datetime.fromisoformat(subscription["current_period_start"])
        
        # Check resource type
        if resource == "conversations":
            limit = features.get("max_conversations")
            if limit is None:  # Unlimited
                return {
                    "allowed": True,
                    "limit": None,
                    "current": 0,
                    "percentage": 0,
                    "is_soft_limit": False
                }
            
            # Count conversations in current period
            current = await db.conversations.count_documents({
                "tenant_id": tenant_id,
                "created_at": {"$gte": period_start.isoformat()}
            })
            
            percentage = (current / limit * 100) if limit > 0 else 0
            
            # Get soft limit threshold from settings
            platform_settings = await db.platform_settings.find_one({"key": "subscription_settings"}, {"_id": 0})
            soft_threshold = platform_settings.get("value", {}).get("soft_limit_threshold", 90) if platform_settings else 90
            
            return {
                "allowed": current < limit,
                "limit": limit,
                "current": current,
                "percentage": percentage,
                "is_soft_limit": percentage >= soft_threshold
            }
        
        elif resource == "agents":
            limit = features.get("max_agents")
            if limit is None:  # Unlimited
                return {
                    "allowed": True,
                    "limit": None,
                    "current": 0,
                    "percentage": 0,
                    "is_soft_limit": False
                }
            
            # Count active agents
            current = await db.user_agents.count_documents({"tenant_id": tenant_id})
            
            percentage = (current / limit * 100) if limit > 0 else 0
            
            # Get soft limit threshold
            platform_settings = await db.platform_settings.find_one({"key": "subscription_settings"}, {"_id": 0})
            soft_threshold = platform_settings.get("value", {}).get("soft_limit_threshold", 90) if platform_settings else 90
            
            return {
                "allowed": current < limit,
                "limit": limit,
                "current": current,
                "percentage": percentage,
                "is_soft_limit": percentage >= soft_threshold
            }
        
        return {"allowed": True, "error": "Unknown resource type"}

def require_feature(feature: str):
    """Decorator to require a specific feature"""
    async def check_feature(request: Request):
        tenant_id = getattr(request.state, "tenant_id", None)
        if not tenant_id:
            raise HTTPException(status_code=403, detail="No tenant associated")
        
        has_access = await SubscriptionGate.check_feature_access(tenant_id, feature)
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail=f"This feature requires a premium subscription. Please upgrade your plan."
            )
    
    return check_feature

async def check_conversation_limit(tenant_id: str) -> Dict[str, Any]:
    """Check if tenant can create more conversations"""
    return await SubscriptionGate.check_usage_limit(tenant_id, "conversations")

async def check_agent_limit(tenant_id: str) -> Dict[str, Any]:
    """Check if tenant can create more agents"""
    return await SubscriptionGate.check_usage_limit(tenant_id, "agents")
