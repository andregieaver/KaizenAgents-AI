"""
Quota Checking Service - Enforces subscription plan limits
"""
from typing import Optional, Dict, Any
import logging
import asyncio
import os
from datetime import datetime, timezone

from middleware.database import db

logger = logging.getLogger(__name__)

# Thresholds for sending quota warning emails
QUOTA_WARNING_THRESHOLD = 80  # Send warning at 80% usage
QUOTA_CRITICAL_THRESHOLD = 100  # Send critical alert at 100%


class QuotaService:
    """Service for checking and enforcing subscription quotas"""
    
    def __init__(self):
        self.config_cache = None
        self.cache_timestamp = None
        self.cache_ttl = 300  # Cache for 5 minutes
    
    async def check_quota(
        self,
        tenant_id: str,
        feature_key: str,
        increment: int = 1
    ) -> Dict[str, Any]:
        """
        Check if tenant is within quota for a specific feature.
        
        Returns:
            {
                "allowed": bool,
                "current": int,
                "limit": int,
                "remaining": int,
                "message": str
            }
        """
        # Get user's subscription plan
        subscription = await self._get_subscription(tenant_id)
        plan_name = subscription.get("plan_name", "free")
        
        # Get feature gate config
        config = await self._get_config()
        if not config:
            # No config means no limits
            return {"allowed": True, "current": 0, "limit": None, "remaining": None, "message": "No limits configured"}
        
        # Find the feature
        feature = self._find_feature(config, feature_key)
        if not feature:
            # Feature not gated
            return {"allowed": True, "current": 0, "limit": None, "remaining": None, "message": "Feature not gated"}
        
        # Get limits for this plan
        plan_limits = feature.get("plans", {}).get(plan_name)
        if not plan_limits or not plan_limits.get("enabled"):
            return {
                "allowed": False,
                "current": 0,
                "limit": 0,
                "remaining": 0,
                "message": f"Feature '{feature['feature_name']}' is not available on the {plan_name} plan"
            }
        
        limit_value = plan_limits.get("limit_value")
        
        # If limit is None, unlimited
        if limit_value is None:
            return {"allowed": True, "current": 0, "limit": None, "remaining": None, "message": "Unlimited"}
        
        # Check current usage based on limit type
        limit_type = feature.get("limit_type", "quota")
        
        if limit_type == "quota":
            current = await self._get_quota_usage(tenant_id, feature)
        else:  # usage type (monthly consumption)
            current = await self._get_monthly_usage(tenant_id, feature_key)
        
        # Calculate usage percentage
        usage_after = current + increment
        usage_percentage = (usage_after / limit_value * 100) if limit_value > 0 else 0
        
        # Check if within limit
        if current + increment > limit_value:
            # Quota exceeded - trigger email asynchronously
            asyncio.create_task(
                self._send_quota_email(
                    tenant_id=tenant_id,
                    feature_name=feature["feature_name"],
                    plan_name=plan_name,
                    current_usage=str(current),
                    usage_limit=str(limit_value),
                    usage_percentage=str(int(usage_percentage)),
                    is_exceeded=True
                )
            )
            
            return {
                "allowed": False,
                "current": current,
                "limit": limit_value,
                "remaining": max(0, limit_value - current),
                "message": f"Quota exceeded: {current}/{limit_value} {feature['unit']} used",
                "feature_name": feature["feature_name"],
                "upgrade_required": True
            }
        
        # Check if approaching limit (warning threshold)
        if usage_percentage >= QUOTA_WARNING_THRESHOLD and usage_percentage < QUOTA_CRITICAL_THRESHOLD:
            # Send warning email asynchronously
            asyncio.create_task(
                self._send_quota_email(
                    tenant_id=tenant_id,
                    feature_name=feature["feature_name"],
                    plan_name=plan_name,
                    current_usage=str(usage_after),
                    usage_limit=str(limit_value),
                    usage_percentage=str(int(usage_percentage)),
                    is_exceeded=False
                )
            )
        
        return {
            "allowed": True,
            "current": current,
            "limit": limit_value,
            "remaining": limit_value - current - increment,
            "message": f"Within quota: {current + increment}/{limit_value} {feature['unit']}"
        }
    
    async def record_usage(
        self,
        tenant_id: str,
        feature_key: str,
        amount: int = 1,
        metadata: Dict[str, Any] = None
    ):
        """Record usage for a feature (for monthly consumption tracking)"""
        now = datetime.now(timezone.utc)
        month_bucket = now.strftime("%Y-%m")
        
        usage_record = {
            "tenant_id": tenant_id,
            "feature_key": feature_key,
            "usage_amount": amount,
            "timestamp": now.isoformat(),
            "month_bucket": month_bucket,
            "metadata": metadata or {}
        }
        
        await db.usage_records.insert_one(usage_record)
    
    async def _get_subscription(self, tenant_id: str) -> Dict[str, Any]:
        """Get tenant's subscription plan"""
        subscription = await db.subscriptions.find_one(
            {"tenant_id": tenant_id},
            {"_id": 0}
        )
        
        if not subscription:
            # Check if tenant has a plan name directly
            tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
            if tenant and tenant.get("plan_name"):
                return {"tenant_id": tenant_id, "plan_name": tenant["plan_name"]}
            
            # Default to free
            return {"tenant_id": tenant_id, "plan_name": "free"}
        
        return subscription
    
    async def _get_config(self) -> Optional[Dict[str, Any]]:
        """Get feature gate config with caching"""
        now = datetime.now(timezone.utc).timestamp()
        
        # Check cache
        if self.config_cache and self.cache_timestamp:
            if now - self.cache_timestamp < self.cache_ttl:
                return self.config_cache
        
        # Fetch from database
        config = await db.feature_gate_config.find_one({}, {"_id": 0})
        
        # Update cache
        self.config_cache = config
        self.cache_timestamp = now
        
        return config
    
    def _find_feature(self, config: Dict[str, Any], feature_key: str) -> Optional[Dict[str, Any]]:
        """Find a feature in the config by key"""
        for feature in config.get("features", []):
            if feature.get("feature_key") == feature_key:
                return feature
        return None
    
    async def _get_quota_usage(self, tenant_id: str, feature: Dict[str, Any]) -> int:
        """Get current quota usage (count of items)"""
        feature_key = feature["feature_key"]
        
        # Map feature keys to collections
        if feature_key == "max_agents":
            # Count user agents for this tenant
            return await db.user_agents.count_documents({"tenant_id": tenant_id})
        
        elif feature_key == "max_seats":
            # Count users/team members for this tenant
            return await db.users.count_documents({"tenant_id": tenant_id})
        
        elif feature_key == "max_pages":
            # Count CMS pages for this tenant
            return await db.pages.count_documents({"tenant_id": tenant_id})
        
        elif feature_key == "marketplace_publishing":
            # Count publishes this month
            now = datetime.now(timezone.utc)
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            return await db.agent_templates.count_documents({
                "source_tenant_id": tenant_id,
                "published_at": {"$gte": month_start.isoformat()}
            })
        
        return 0
    
    async def _get_monthly_usage(self, tenant_id: str, feature_key: str) -> int:
        """Get monthly usage consumption"""
        now = datetime.now(timezone.utc)
        month_bucket = now.strftime("%Y-%m")
        
        # Sum up usage for this month
        pipeline = [
            {
                "$match": {
                    "tenant_id": tenant_id,
                    "feature_key": feature_key,
                    "month_bucket": month_bucket
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": "$usage_amount"}
                }
            }
        ]
        
        result = await db.usage_records.aggregate(pipeline).to_list(1)
        
        if result:
            return result[0]["total"]
        return 0


    async def _send_quota_email(
        self,
        tenant_id: str,
        feature_name: str,
        plan_name: str,
        current_usage: str,
        usage_limit: str,
        usage_percentage: str,
        is_exceeded: bool
    ):
        """Send quota warning or exceeded email to tenant owner"""
        try:
            from services.email_service import EmailService
            
            # Check if we've already sent an email for this quota threshold today
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            alert_key = f"{tenant_id}_{feature_name}_{usage_percentage}_{today}"
            
            existing_alert = await db.quota_alerts.find_one({"alert_key": alert_key})
            if existing_alert:
                # Already sent this alert today
                return
            
            # Record that we're sending this alert
            await db.quota_alerts.insert_one({
                "alert_key": alert_key,
                "tenant_id": tenant_id,
                "feature_name": feature_name,
                "is_exceeded": is_exceeded,
                "sent_at": datetime.now(timezone.utc).isoformat()
            })
            
            # Get tenant owner email
            company = await db.companies.find_one({"id": tenant_id}, {"_id": 0, "owner_id": 1})
            if not company:
                return
            
            owner = await db.users.find_one({"id": company.get("owner_id")}, {"_id": 0, "email": 1, "name": 1})
            if not owner:
                return
            
            frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
            upgrade_url = f"{frontend_url}/dashboard/pricing"
            
            if is_exceeded:
                await EmailService.send_quota_exceeded_email(
                    to_email=owner["email"],
                    user_name=owner.get("name", "User"),
                    resource_name=feature_name,
                    plan_name=plan_name.capitalize(),
                    usage_percentage=usage_percentage,
                    upgrade_url=upgrade_url
                )
            else:
                await EmailService.send_quota_warning_email(
                    to_email=owner["email"],
                    user_name=owner.get("name", "User"),
                    resource_name=feature_name,
                    plan_name=plan_name.capitalize(),
                    current_usage=current_usage,
                    usage_limit=usage_limit,
                    usage_percentage=usage_percentage,
                    upgrade_url=upgrade_url
                )
            
            logger.info(f"Quota {'exceeded' if is_exceeded else 'warning'} email sent to {owner['email']} for {feature_name}")
            
        except Exception as e:
            logger.error(f"Failed to send quota email: {str(e)}")


# Global instance
quota_service = QuotaService()


async def check_quota_limit(tenant_id: str, feature_key: str, increment: int = 1) -> Dict[str, Any]:
    """
    Convenience function to check quota limit.
    Raises HTTPException if quota exceeded.
    """
    from fastapi import HTTPException
    
    result = await quota_service.check_quota(tenant_id, feature_key, increment)
    
    if not result["allowed"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "quota_exceeded",
                "message": result["message"],
                "current": result["current"],
                "limit": result["limit"],
                "feature_name": result.get("feature_name"),
                "upgrade_required": result.get("upgrade_required", False)
            }
        )
    
    return result
