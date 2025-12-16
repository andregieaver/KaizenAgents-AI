"""
Feature Gate Middleware - Enforces subscription-based access control
"""
from fastapi import Request, HTTPException
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import logging
import re

from middleware.database import db

logger = logging.getLogger(__name__)


class FeatureGateMiddleware:
    """Middleware to enforce feature gates on API routes"""
    
    def __init__(self):
        self.config_cache = None
        self.cache_timestamp = None
        self.cache_ttl = 300  # Cache for 5 minutes
    
    async def check_access(
        self, 
        request: Request, 
        tenant_id: str,
        current_user: dict
    ) -> Optional[Dict[str, Any]]:
        """
        Check if user has access to the requested route based on their plan.
        Returns None if access is allowed, or error dict if denied.
        """
        # Skip check for super admins
        if current_user.get("is_super_admin"):
            return None
        
        # Get route path and method
        route_path = request.url.path
        route_method = request.method
        
        # Load feature gate config
        config = await self._get_config()
        if not config:
            # No config means all routes are open
            return None
        
        # Find matching route in config
        route_config = self._find_matching_route(route_path, route_method, config.get("routes", []))
        if not route_config:
            # Route not gated, allow access
            return None
        
        # Get user's subscription plan
        subscription = await self._get_user_subscription(tenant_id)
        plan_name = subscription.get("plan_name", "free")
        
        # Get limits for this plan on this route
        route_limits = route_config.get("plans", {}).get(plan_name)
        if not route_limits:
            # No configuration for this plan, deny by default
            return {
                "error": "access_denied",
                "message": f"This feature is not available on the {plan_name} plan",
                "upgrade_required": True
            }
        
        # Check if route is enabled for this plan
        if not route_limits.get("enabled", True):
            return {
                "error": "access_denied",
                "message": f"This feature is not available on the {plan_name} plan",
                "upgrade_required": True,
                "feature": route_config.get("route_name")
            }
        
        # Check rate limits
        rate_limit_error = await self._check_rate_limits(
            tenant_id, 
            route_path, 
            route_method, 
            route_limits
        )
        if rate_limit_error:
            return rate_limit_error
        
        # Check quota limits
        quota_error = await self._check_quota_limits(
            tenant_id,
            route_config,
            route_limits
        )
        if quota_error:
            return quota_error
        
        # Access granted, record usage
        await self._record_usage(tenant_id, route_path, route_method)
        
        return None
    
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
    
    def _find_matching_route(
        self, 
        path: str, 
        method: str, 
        routes: list
    ) -> Optional[Dict[str, Any]]:
        """Find a route configuration that matches the request"""
        for route in routes:
            route_pattern = route.get("route_path", "")
            route_method = route.get("route_method", "*")
            
            # Check method match
            if route_method != "*" and route_method.upper() != method.upper():
                continue
            
            # Convert route pattern to regex (handle path parameters)
            pattern = route_pattern.replace("{", "(?P<").replace("}", ">[^/]+)")
            pattern = f"^{pattern}$"
            
            if re.match(pattern, path):
                return route
        
        return None
    
    async def _get_user_subscription(self, tenant_id: str) -> Dict[str, Any]:
        """Get user's subscription plan"""
        subscription = await db.subscriptions.find_one(
            {"tenant_id": tenant_id},
            {"_id": 0}
        )
        
        if not subscription:
            # Default to free plan
            return {
                "tenant_id": tenant_id,
                "plan_name": "free",
                "active": True
            }
        
        return subscription
    
    async def _check_rate_limits(
        self, 
        tenant_id: str,
        route_path: str,
        route_method: str,
        limits: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Check if user has exceeded rate limits"""
        now = datetime.now(timezone.utc)
        hour_bucket = now.strftime("%Y-%m-%d-%H")
        day_bucket = now.strftime("%Y-%m-%d")
        
        # Check hourly limit
        rate_limit_per_hour = limits.get("rate_limit_per_hour")
        if rate_limit_per_hour:
            count = await db.usage_records.count_documents({
                "tenant_id": tenant_id,
                "route_path": route_path,
                "route_method": route_method,
                "hour_bucket": hour_bucket
            })
            
            if count >= rate_limit_per_hour:
                return {
                    "error": "rate_limit_exceeded",
                    "message": f"Rate limit exceeded: {rate_limit_per_hour} requests per hour",
                    "limit": rate_limit_per_hour,
                    "period": "hour",
                    "retry_after": self._seconds_until_next_hour()
                }
        
        # Check daily limit
        rate_limit_per_day = limits.get("rate_limit_per_day")
        if rate_limit_per_day:
            count = await db.usage_records.count_documents({
                "tenant_id": tenant_id,
                "route_path": route_path,
                "route_method": route_method,
                "day_bucket": day_bucket
            })
            
            if count >= rate_limit_per_day:
                return {
                    "error": "rate_limit_exceeded",
                    "message": f"Rate limit exceeded: {rate_limit_per_day} requests per day",
                    "limit": rate_limit_per_day,
                    "period": "day",
                    "retry_after": self._seconds_until_tomorrow()
                }
        
        return None
    
    async def _check_quota_limits(
        self,
        tenant_id: str,
        route_config: Dict[str, Any],
        limits: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Check if user has exceeded quota limits"""
        quota_limit = limits.get("quota_limit")
        if not quota_limit:
            return None
        
        # Determine what to count based on route category
        category = route_config.get("category")
        collection_name = None
        query = {"tenant_id": tenant_id}
        
        if category == "agents":
            collection_name = "user_agents"
        elif category == "cms":
            collection_name = "pages"
        elif category == "conversations":
            # For conversations, we might count total messages or conversations
            # This is more complex and might need different logic
            return None
        
        if collection_name:
            count = await db[collection_name].count_documents(query)
            
            if count >= quota_limit:
                return {
                    "error": "quota_exceeded",
                    "message": f"Quota limit exceeded: maximum {quota_limit} items allowed",
                    "limit": quota_limit,
                    "current": count,
                    "upgrade_required": True
                }
        
        return None
    
    async def _record_usage(
        self, 
        tenant_id: str, 
        route_path: str, 
        route_method: str
    ):
        """Record API usage for rate limiting"""
        now = datetime.now(timezone.utc)
        
        usage_record = {
            "tenant_id": tenant_id,
            "route_path": route_path,
            "route_method": route_method,
            "timestamp": now.isoformat(),
            "hour_bucket": now.strftime("%Y-%m-%d-%H"),
            "day_bucket": now.strftime("%Y-%m-%d")
        }
        
        await db.usage_records.insert_one(usage_record)
    
    def _seconds_until_next_hour(self) -> int:
        """Calculate seconds until the next hour"""
        now = datetime.now(timezone.utc)
        next_hour = now.replace(minute=0, second=0, microsecond=0)
        next_hour = next_hour.replace(hour=now.hour + 1)
        return int((next_hour - now).total_seconds())
    
    def _seconds_until_tomorrow(self) -> int:
        """Calculate seconds until tomorrow"""
        now = datetime.now(timezone.utc)
        tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0)
        from datetime import timedelta
        tomorrow = tomorrow + timedelta(days=1)
        return int((tomorrow - now).total_seconds())


# Global middleware instance
feature_gate_middleware = FeatureGateMiddleware()


async def check_feature_gate(request: Request, current_user: dict):
    """
    Dependency function to check feature gates.
    Raise HTTPException if access is denied.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        # No tenant means no restrictions (shouldn't happen in normal flow)
        return
    
    result = await feature_gate_middleware.check_access(request, tenant_id, current_user)
    
    if result:
        # Access denied
        error_type = result.get("error")
        status_code = 429 if error_type == "rate_limit_exceeded" else 403
        
        raise HTTPException(
            status_code=status_code,
            detail=result
        )
