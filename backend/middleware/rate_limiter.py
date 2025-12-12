"""
Rate limiting middleware for API endpoints
Uses sliding window algorithm with in-memory storage
"""
from fastapi import Request, HTTPException, status
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Tuple
import asyncio
from collections import defaultdict

class RateLimiter:
    def __init__(self):
        # Store: {tenant_id: [(timestamp, count)]}
        self.requests: Dict[str, List[Tuple[datetime, int]]] = defaultdict(list)
        self.lock = asyncio.Lock()
        
        # Default limits (can be overridden per tenant)
        self.default_limits = {
            "minute": 100,
            "hour": 1000,
            "day": 10000
        }
        
        # Custom limits per tenant: {tenant_id: {minute: X, hour: Y, day: Z}}
        self.tenant_limits: Dict[str, Dict[str, int]] = {}
    
    async def set_tenant_limit(self, tenant_id: str, limits: Dict[str, int]):
        """Set custom rate limits for a tenant"""
        async with self.lock:
            self.tenant_limits[tenant_id] = limits
    
    async def get_tenant_limit(self, tenant_id: str) -> Dict[str, int]:
        """Get rate limits for a tenant"""
        return self.tenant_limits.get(tenant_id, self.default_limits)
    
    async def get_all_tenant_limits(self) -> Dict[str, Dict[str, int]]:
        """Get all tenant limits"""
        return self.tenant_limits.copy()
    
    async def remove_old_requests(self, tenant_id: str, cutoff: datetime):
        """Remove requests older than cutoff time"""
        if tenant_id in self.requests:
            self.requests[tenant_id] = [
                (ts, count) for ts, count in self.requests[tenant_id]
                if ts > cutoff
            ]
    
    async def count_requests(self, tenant_id: str, since: datetime) -> int:
        """Count requests since a given time"""
        if tenant_id not in self.requests:
            return 0
        return sum(
            count for ts, count in self.requests[tenant_id]
            if ts > since
        )
    
    async def check_rate_limit(self, tenant_id: str) -> Tuple[bool, Dict[str, 'Any']]:
        """
        Check if request is within rate limits
        Returns: (is_allowed, info_dict)
        """
        async with self.lock:
            now = datetime.now(timezone.utc)
            
            # Get limits for this tenant
            limits = await self.get_tenant_limit(tenant_id)
            
            # Clean up old requests (older than 1 day)
            await self.remove_old_requests(tenant_id, now - timedelta(days=1))
            
            # Check each time window
            checks = {
                "minute": (timedelta(minutes=1), limits.get("minute", self.default_limits["minute"])),
                "hour": (timedelta(hours=1), limits.get("hour", self.default_limits["hour"])),
                "day": (timedelta(days=1), limits.get("day", self.default_limits["day"]))
            }
            
            usage = {}
            for window, (delta, limit) in checks.items():
                count = await self.count_requests(tenant_id, now - delta)
                usage[window] = {
                    "count": count,
                    "limit": limit,
                    "remaining": max(0, limit - count)
                }
                
                # If any limit is exceeded, deny request
                if count >= limit:
                    return False, {
                        "allowed": False,
                        "exceeded_window": window,
                        "usage": usage
                    }
            
            # Record this request
            self.requests[tenant_id].append((now, 1))
            
            return True, {
                "allowed": True,
                "usage": usage
            }
    
    async def get_usage_stats(self, tenant_id: str) -> Dict[str, 'Any']:
        """Get current usage statistics for a tenant"""
        async with self.lock:
            now = datetime.now(timezone.utc)
            limits = await self.get_tenant_limit(tenant_id)
            
            stats = {}
            checks = {
                "minute": timedelta(minutes=1),
                "hour": timedelta(hours=1),
                "day": timedelta(days=1)
            }
            
            for window, delta in checks.items():
                count = await self.count_requests(tenant_id, now - delta)
                limit = limits.get(window, self.default_limits[window])
                stats[window] = {
                    "count": count,
                    "limit": limit,
                    "remaining": max(0, limit - count),
                    "percentage": round((count / limit * 100) if limit > 0 else 0, 2)
                }
            
            return stats

# Global rate limiter instance
rate_limiter = RateLimiter()

async def rate_limit_middleware(request: Request, call_next):
    """
    Middleware to enforce rate limits on API requests
    """
    # Skip rate limiting for certain paths
    skip_paths = ["/api/auth/login", "/api/auth/register", "/docs", "/openapi.json", "/api/media"]
    
    if any(request.url.path.startswith(path) for path in skip_paths):
        response = await call_next(request)
        return response
    
    # Get tenant_id from request state (set by auth middleware)
    tenant_id = getattr(request.state, "tenant_id", None)
    
    if not tenant_id:
        # If no tenant_id, allow request (e.g., public endpoints)
        response = await call_next(request)
        return response
    
    # Check rate limit
    allowed, info = await rate_limiter.check_rate_limit(tenant_id)
    
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": f"Rate limit exceeded for {info['exceeded_window']}",
                "usage": info["usage"]
            }
        )
    
    # Add rate limit info to response headers
    response = await call_next(request)
    usage = info["usage"]
    
    # Add headers for minute window
    if "minute" in usage:
        response.headers["X-RateLimit-Limit-Minute"] = str(usage["minute"]["limit"])
        response.headers["X-RateLimit-Remaining-Minute"] = str(usage["minute"]["remaining"])
    
    return response
