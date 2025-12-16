"""
Quota Usage and Management API
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import logging

from middleware import get_current_user
from middleware.database import db
from services.quota_service import quota_service

router = APIRouter(prefix="/quotas", tags=["quotas"])
logger = logging.getLogger(__name__)


class QuotaUsageItem(BaseModel):
    """Single quota usage item"""
    feature_key: str
    feature_name: str
    feature_description: str
    limit_type: str
    unit: str
    current: int
    limit: Optional[int]
    remaining: Optional[int]
    percentage: float
    warning_level: Optional[str] = None  # "warning" (80%), "critical" (90%)
    extra_info: Optional[str] = None


class QuotaUsageResponse(BaseModel):
    """Complete quota usage response"""
    tenant_id: str
    plan_name: str
    plan_display_name: str
    quotas: List[QuotaUsageItem]
    extra_seats: int = 0  # Additional purchased seats


class ExtraSeatPurchase(BaseModel):
    """Request to purchase extra seats"""
    quantity: int
    payment_method: Optional[str] = None


@router.get("/usage", response_model=QuotaUsageResponse)
async def get_quota_usage(current_user: dict = Depends(get_current_user)):
    """Get current quota usage for the user's tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get subscription
    subscription = await quota_service._get_subscription(tenant_id)
    plan_name = subscription.get("plan_name", "free")
    
    # Get feature gate config
    config = await quota_service._get_config()
    if not config:
        raise HTTPException(status_code=404, detail="No feature gate configuration found")
    
    # Calculate usage for each feature
    quotas = []
    
    for feature in config.get("features", []):
        feature_key = feature["feature_key"]
        plan_limits = feature.get("plans", {}).get(plan_name)
        
        if not plan_limits or not plan_limits.get("enabled"):
            continue
        
        limit_value = plan_limits.get("limit_value")
        limit_type = feature.get("limit_type", "quota")
        
        # Get current usage
        if limit_type == "quota":
            current = await quota_service._get_quota_usage(tenant_id, feature)
        else:
            current = await quota_service._get_monthly_usage(tenant_id, feature_key)
        
        # Calculate percentage and warning level
        if limit_value is not None:
            percentage = (current / limit_value * 100) if limit_value > 0 else 0
            remaining = max(0, limit_value - current)
            
            warning_level = None
            if percentage >= 100:
                warning_level = "critical"
            elif percentage >= 80:
                warning_level = "warning"
        else:
            percentage = 0
            remaining = None
            warning_level = None
        
        # Extra info for specific features
        extra_info = None
        if feature_key == "max_seats":
            # Check for extra seats
            extra_seats_doc = await db.extra_seats.find_one({"tenant_id": tenant_id}, {"_id": 0})
            if extra_seats_doc:
                extra_seats = extra_seats_doc.get("quantity", 0)
                if extra_seats > 0:
                    extra_info = f"+{extra_seats} extra seats purchased"
                    if limit_value is not None:
                        limit_value += extra_seats
                        remaining = max(0, limit_value - current)
                        percentage = (current / limit_value * 100) if limit_value > 0 else 0
        
        quotas.append({
            "feature_key": feature_key,
            "feature_name": feature["feature_name"],
            "feature_description": feature["feature_description"],
            "limit_type": limit_type,
            "unit": feature["unit"],
            "current": current,
            "limit": limit_value,
            "remaining": remaining,
            "percentage": round(percentage, 1),
            "warning_level": warning_level,
            "extra_info": extra_info
        })
    
    # Get extra seats count
    extra_seats_doc = await db.extra_seats.find_one({"tenant_id": tenant_id}, {"_id": 0})
    extra_seats = extra_seats_doc.get("quantity", 0) if extra_seats_doc else 0
    
    # Get plan display name
    plan_doc = await db.subscription_plans.find_one(
        {"name": plan_name.capitalize()},
        {"_id": 0, "name": 1}
    )
    plan_display_name = plan_doc["name"] if plan_doc else plan_name.capitalize()
    
    return {
        "tenant_id": tenant_id,
        "plan_name": plan_name,
        "plan_display_name": plan_display_name,
        "quotas": quotas,
        "extra_seats": extra_seats
    }


@router.post("/extra-seats/purchase")
async def purchase_extra_seats(
    purchase: ExtraSeatPurchase,
    current_user: dict = Depends(get_current_user)
):
    """Purchase additional seats beyond plan quota (paid plans only)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check if on a paid plan
    subscription = await quota_service._get_subscription(tenant_id)
    plan_name = subscription.get("plan_name", "free")
    
    if plan_name == "free":
        raise HTTPException(
            status_code=403,
            detail="Extra seats are only available for paid subscription plans"
        )
    
    if purchase.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")
    
    # Calculate price (e.g., $5 per seat per month)
    price_per_seat = 5.0
    total_price = purchase.quantity * price_per_seat
    
    # Here you would integrate with Stripe or payment processor
    # For now, we'll just record the purchase
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update or create extra seats record
    await db.extra_seats.update_one(
        {"tenant_id": tenant_id},
        {
            "$inc": {"quantity": purchase.quantity},
            "$set": {
                "updated_at": now,
                "last_purchase": {
                    "quantity": purchase.quantity,
                    "amount": total_price,
                    "date": now
                }
            },
            "$setOnInsert": {
                "created_at": now
            }
        },
        upsert=True
    )
    
    # Record transaction
    await db.seat_transactions.insert_one({
        "tenant_id": tenant_id,
        "type": "purchase",
        "quantity": purchase.quantity,
        "price_per_seat": price_per_seat,
        "total_amount": total_price,
        "payment_method": purchase.payment_method,
        "status": "completed",
        "created_at": now
    })
    
    logger.info(f"Purchased {purchase.quantity} extra seats for tenant {tenant_id}")
    
    return {
        "message": f"Successfully purchased {purchase.quantity} extra seat(s)",
        "quantity": purchase.quantity,
        "total_amount": total_price,
        "price_per_seat": price_per_seat
    }


@router.get("/extra-seats")
async def get_extra_seats(current_user: dict = Depends(get_current_user)):
    """Get extra seats information"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    extra_seats_doc = await db.extra_seats.find_one({"tenant_id": tenant_id}, {"_id": 0})
    
    if not extra_seats_doc:
        return {
            "tenant_id": tenant_id,
            "quantity": 0,
            "available": True,
            "price_per_seat": 5.0
        }
    
    return {
        "tenant_id": tenant_id,
        "quantity": extra_seats_doc.get("quantity", 0),
        "last_purchase": extra_seats_doc.get("last_purchase"),
        "available": True,
        "price_per_seat": 5.0
    }


@router.get("/alerts")
async def get_quota_alerts(current_user: dict = Depends(get_current_user)):
    """Get quota alerts for features approaching limits"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get quota usage
    usage_response = await get_quota_usage(current_user)
    
    # Filter for quotas with warnings
    alerts = []
    for quota in usage_response.quotas:
        if quota.warning_level in ["warning", "critical"]:
            alerts.append({
                "feature_name": quota.feature_name,
                "current": quota.current,
                "limit": quota.limit,
                "percentage": quota.percentage,
                "level": quota.warning_level,
                "message": f"{quota.feature_name}: {quota.current}/{quota.limit} used ({quota.percentage:.0f}%)"
            })
    
    return {
        "tenant_id": tenant_id,
        "alert_count": len(alerts),
        "alerts": alerts
    }
