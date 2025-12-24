"""
Quota Alert Service - Sends email alerts when quotas approach or exceed limits
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from middleware.database import db
from services.email_service import EmailService
from services.quota_service import quota_service

logger = logging.getLogger(__name__)


class QuotaAlertService:
    """Service for managing quota limit email alerts"""
    
    # Alert thresholds
    WARNING_THRESHOLD = 80  # 80% usage
    CRITICAL_THRESHOLD = 100  # 100% usage (exceeded)
    
    # Cooldown period - don't send same alert type more than once per period
    ALERT_COOLDOWN_HOURS = 24
    
    @staticmethod
    async def get_platform_info() -> Dict[str, Any]:
        """Get platform name and settings"""
        platform_info = await db.platform_info.find_one({}, {"_id": 0})
        return {
            "platform_name": platform_info.get("name", "AI Support Hub") if platform_info else "AI Support Hub"
        }
    
    @staticmethod
    async def get_tenant_owner(tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get the owner user for a tenant"""
        owner = await db.users.find_one(
            {"tenant_id": tenant_id, "role": "owner"},
            {"_id": 0, "id": 1, "email": 1, "name": 1}
        )
        if not owner:
            # Fall back to any user in the tenant
            owner = await db.users.find_one(
                {"tenant_id": tenant_id},
                {"_id": 0, "id": 1, "email": 1, "name": 1}
            )
        return owner
    
    @staticmethod
    async def has_recent_alert(tenant_id: str, feature_key: str, alert_type: str) -> bool:
        """Check if a similar alert was sent recently"""
        cooldown_cutoff = datetime.now(timezone.utc) - timedelta(hours=QuotaAlertService.ALERT_COOLDOWN_HOURS)
        
        recent_alert = await db.quota_alerts.find_one({
            "tenant_id": tenant_id,
            "feature_key": feature_key,
            "alert_type": alert_type,
            "sent_at": {"$gte": cooldown_cutoff.isoformat()}
        }, {"_id": 0})
        
        return recent_alert is not None
    
    @staticmethod
    async def record_alert(tenant_id: str, feature_key: str, alert_type: str, user_email: str):
        """Record that an alert was sent"""
        await db.quota_alerts.insert_one({
            "tenant_id": tenant_id,
            "feature_key": feature_key,
            "alert_type": alert_type,
            "user_email": user_email,
            "sent_at": datetime.now(timezone.utc).isoformat()
        })
    
    @staticmethod
    async def check_and_send_alerts(tenant_id: str) -> Dict[str, Any]:
        """
        Check all quotas for a tenant and send alerts if thresholds are reached
        
        Returns:
            Dict with results of alert checks
        """
        import os
        
        results = {
            "tenant_id": tenant_id,
            "alerts_sent": [],
            "alerts_skipped": [],
            "errors": []
        }
        
        try:
            # Get tenant owner for sending alerts
            owner = await QuotaAlertService.get_tenant_owner(tenant_id)
            if not owner:
                results["errors"].append("No owner found for tenant")
                return results
            
            # Get subscription info
            subscription = await quota_service._get_subscription(tenant_id)
            plan_name = subscription.get("plan_name", "Free")
            
            # Get feature gate config
            config = await quota_service._get_config()
            if not config:
                results["errors"].append("No feature gate configuration found")
                return results
            
            # Get platform info
            platform_info = await QuotaAlertService.get_platform_info()
            frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
            
            # Check each feature's quota
            for feature in config.get("features", []):
                feature_key = feature.get("feature_key")
                if not feature_key:
                    continue
                    
                feature_name = feature.get("feature_name", feature_key)
                
                # Get plan limits
                plan_limits = feature.get("plans", {}).get(plan_name.lower())
                if not plan_limits or not plan_limits.get("enabled"):
                    continue
                
                limit_value = plan_limits.get("limit_value") or plan_limits.get("limit")
                if not limit_value or limit_value <= 0:
                    continue
                
                # Get current usage
                limit_type = feature.get("limit_type", "quota")
                if limit_type == "quota":
                    current_usage = await quota_service._get_quota_usage(tenant_id, feature)
                else:
                    current_usage = await quota_service._get_monthly_usage(tenant_id, feature_key)
                
                # Calculate percentage
                percentage = (current_usage / limit_value * 100) if limit_value > 0 else 0
                
                # Determine alert type
                alert_type = None
                template_key = None
                
                if percentage >= QuotaAlertService.CRITICAL_THRESHOLD:
                    alert_type = "exceeded"
                    template_key = "quota_exceeded"
                elif percentage >= QuotaAlertService.WARNING_THRESHOLD:
                    alert_type = "warning"
                    template_key = "quota_warning"
                
                if not alert_type:
                    continue
                
                # Check if already sent recently
                if await QuotaAlertService.has_recent_alert(tenant_id, feature_key, alert_type):
                    results["alerts_skipped"].append({
                        "feature": feature_name,
                        "reason": "Recent alert already sent"
                    })
                    continue
                
                # Prepare email variables
                variables = {
                    "platform_name": platform_info["platform_name"],
                    "user_name": owner.get("name", "there"),
                    "resource_name": feature_name,
                    "plan_name": plan_name.capitalize(),
                    "current_usage": str(current_usage),
                    "usage_limit": str(limit_value),
                    "usage_percentage": f"{percentage:.0f}",
                    "upgrade_url": f"{frontend_url}/dashboard/pricing",
                    "year": str(datetime.now().year)
                }
                
                # Send alert email
                success = await EmailService.send_email(
                    to_email=owner["email"],
                    template_key=template_key,
                    variables=variables,
                    fallback_subject=f"Quota Alert: {feature_name} at {percentage:.0f}%",
                    fallback_content=f"<p>Your {feature_name} usage is at {percentage:.0f}% ({current_usage}/{limit_value}).</p>"
                )
                
                if success:
                    # Record the alert
                    await QuotaAlertService.record_alert(tenant_id, feature_key, alert_type, owner["email"])
                    results["alerts_sent"].append({
                        "feature": feature_name,
                        "type": alert_type,
                        "percentage": round(percentage, 1),
                        "email": owner["email"]
                    })
                    logger.info(f"Quota alert sent: {feature_name} {alert_type} for tenant {tenant_id}")
                else:
                    results["errors"].append(f"Failed to send {alert_type} alert for {feature_name}")
                    logger.warning(f"Failed to send quota alert for {feature_name} to {owner['email']}")
        
        except Exception as e:
            logger.error(f"Error checking quota alerts for tenant {tenant_id}: {e}")
            results["errors"].append(str(e))
        
        return results
    
    @staticmethod
    async def check_all_tenants() -> Dict[str, Any]:
        """
        Check quotas for all active tenants and send alerts
        This can be called by a scheduled job
        """
        results = {
            "tenants_checked": 0,
            "total_alerts_sent": 0,
            "tenant_results": []
        }
        
        try:
            # Get all active subscriptions (excluding free plans)
            subscriptions = await db.subscriptions.find(
                {"status": "active"},
                {"_id": 0, "tenant_id": 1}
            ).to_list(1000)
            
            for sub in subscriptions:
                tenant_id = sub.get("tenant_id")
                if tenant_id:
                    tenant_result = await QuotaAlertService.check_and_send_alerts(tenant_id)
                    results["tenants_checked"] += 1
                    results["total_alerts_sent"] += len(tenant_result.get("alerts_sent", []))
                    
                    if tenant_result.get("alerts_sent") or tenant_result.get("errors"):
                        results["tenant_results"].append(tenant_result)
        
        except Exception as e:
            logger.error(f"Error in check_all_tenants: {e}")
            results["error"] = str(e)
        
        return results
    
    @staticmethod
    async def get_alert_history(tenant_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get alert history for a tenant"""
        alerts = await db.quota_alerts.find(
            {"tenant_id": tenant_id},
            {"_id": 0}
        ).sort("sent_at", -1).to_list(limit)
        
        return alerts
    
    @staticmethod
    async def clear_alert_history(tenant_id: str, feature_key: Optional[str] = None):
        """Clear alert history (useful for testing or resetting)"""
        query = {"tenant_id": tenant_id}
        if feature_key:
            query["feature_key"] = feature_key
        
        result = await db.quota_alerts.delete_many(query)
        return {"deleted_count": result.deleted_count}


# Create singleton instance
quota_alert_service = QuotaAlertService()
