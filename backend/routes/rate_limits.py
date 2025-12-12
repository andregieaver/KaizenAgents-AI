"""
Rate Limiting Management routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, ConfigDict
from typing import Dict, Optional, Any
from datetime import datetime, timezone

from middleware import get_super_admin_user
from middleware.database import db
from middleware.rate_limiter import rate_limiter

router = APIRouter(prefix="/rate-limits", tags=["rate-limiting"])

class RateLimitConfig(BaseModel):
    tenant_id: str
    limits: Dict[str, int]  # {minute: X, hour: Y, day: Z}

class RateLimitResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tenant_id: str
    limits: Dict[str, int]
    usage: Optional[Dict[str, Any]] = None

@router.get("/")
async def get_all_rate_limits(current_user: dict = Depends(get_super_admin_user)):
    """Get all rate limit configurations (Super Admin only)"""
    # Get all tenants
    tenants = await db.tenants.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
    
    # Get all custom limits
    all_limits = await rate_limiter.get_all_tenant_limits()
    
    # Build response with usage stats
    result = []
    for tenant in tenants:
        tenant_id = tenant["id"]
        limits = all_limits.get(tenant_id, rate_limiter.default_limits)
        usage = await rate_limiter.get_usage_stats(tenant_id)
        
        result.append({
            "tenant_id": tenant_id,
            "tenant_name": tenant.get("name", "Unknown"),
            "limits": limits,
            "usage": usage
        })
    
    return {"rate_limits": result}

@router.get("/{tenant_id}")
async def get_tenant_rate_limit(
    tenant_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Get rate limit configuration for a specific tenant (Super Admin only)"""
    # Verify tenant exists
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    limits = await rate_limiter.get_tenant_limit(tenant_id)
    usage = await rate_limiter.get_usage_stats(tenant_id)
    
    return {
        "tenant_id": tenant_id,
        "tenant_name": tenant.get("name"),
        "limits": limits,
        "usage": usage
    }

@router.put("/{tenant_id}")
async def update_tenant_rate_limit(
    tenant_id: str,
    config: RateLimitConfig,
    current_user: dict = Depends(get_super_admin_user)
):
    """Update rate limit configuration for a tenant (Super Admin only)"""
    # Verify tenant exists
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Validate limits
    if not all(k in ["minute", "hour", "day"] for k in config.limits.keys()):
        raise HTTPException(
            status_code=400,
            detail="Invalid limit keys. Use 'minute', 'hour', 'day'"
        )
    
    if not all(v > 0 for v in config.limits.values()):
        raise HTTPException(status_code=400, detail="Limits must be positive")
    
    # Update limits
    await rate_limiter.set_tenant_limit(tenant_id, config.limits)
    
    # Store in database for persistence
    await db.rate_limits.update_one(
        {"tenant_id": tenant_id},
        {"$set": {"tenant_id": tenant_id, "limits": config.limits, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {
        "message": "Rate limits updated successfully",
        "tenant_id": tenant_id,
        "limits": config.limits
    }

@router.delete("/{tenant_id}")
async def reset_tenant_rate_limit(
    tenant_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Reset tenant to default rate limits (Super Admin only)"""
    # Remove custom limits (will use defaults)
    if tenant_id in rate_limiter.tenant_limits:
        del rate_limiter.tenant_limits[tenant_id]
    
    # Remove from database
    await db.rate_limits.delete_one({"tenant_id": tenant_id})
    
    return {
        "message": "Rate limits reset to defaults",
        "tenant_id": tenant_id,
        "limits": rate_limiter.default_limits
    }

@router.get("/{tenant_id}/usage")
async def get_tenant_usage(
    tenant_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Get current usage statistics for a tenant (Super Admin only)"""
    usage = await rate_limiter.get_usage_stats(tenant_id)
    limits = await rate_limiter.get_tenant_limit(tenant_id)
    
    return {
        "tenant_id": tenant_id,
        "usage": usage,
        "limits": limits
    }
