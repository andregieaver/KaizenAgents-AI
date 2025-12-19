"""
Quota Usage and Management API
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import logging
import uuid
import os

from middleware import get_current_user, get_super_admin_user
from middleware.database import db
from services.quota_service import quota_service
from services.stripe_service import StripeService

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


class SeatAdjustment(BaseModel):
    """Request to adjust total seat count"""
    total_seats: int  # Total seats including base plan seats


class SeatAllocationResponse(BaseModel):
    """Response with current seat allocation details"""
    base_plan_seats: int
    current_seats: int
    committed_seats: int
    max_seats: int = 100
    last_increase_at: Optional[str] = None
    grace_period_ends_at: Optional[str] = None
    is_in_grace_period: bool = False
    price_per_seat: float = 0
    additional_seats_cost: float = 0  # Cost for extra seats at renewal
    plan_monthly_price: float = 0  # Base plan monthly price
    total_monthly_cost: float = 0  # Plan price + additional seats cost


@router.get("/usage", response_model=QuotaUsageResponse)
async def get_quota_usage(current_user: dict = Depends(get_current_user)):
    """Get current quota usage for the user's tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get subscription
    subscription = await quota_service._get_subscription(tenant_id)
    plan_name = subscription.get("plan_name", "free")
    # Normalize plan name to lowercase for feature gate lookup
    plan_name_lower = plan_name.lower() if plan_name else "free"
    
    # Get feature gate config
    config = await quota_service._get_config()
    if not config:
        raise HTTPException(status_code=404, detail="No feature gate configuration found")
    
    # Calculate usage for each feature
    quotas = []
    
    for feature in config.get("features", []):
        feature_key = feature["feature_key"]
        plan_limits = feature.get("plans", {}).get(plan_name_lower)
        
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


# ============== SEAT ALLOCATION MANAGEMENT ==============

@router.get("/seats/allocation", response_model=SeatAllocationResponse)
async def get_seat_allocation(current_user: dict = Depends(get_current_user)):
    """Get current seat allocation details including grace period status"""
    from datetime import timedelta
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get subscription
    subscription = await quota_service._get_subscription(tenant_id)
    plan_name = subscription.get("plan_name", "free")
    plan_name_lower = plan_name.lower() if plan_name else "free"
    
    # Get base plan seats from feature gate config
    config = await quota_service._get_config()
    base_plan_seats = 1  # Default
    
    if config:
        for feature in config.get("features", []):
            if feature.get("feature_key") == "max_seats":
                plan_limits = feature.get("plans", {}).get(plan_name_lower)
                if plan_limits:
                    base_plan_seats = plan_limits.get("limit", 1) or 1
                break
    
    # Get seat allocation document
    seat_alloc = await db.seat_allocations.find_one({"tenant_id": tenant_id}, {"_id": 0})
    
    now = datetime.now(timezone.utc)
    
    if not seat_alloc:
        # Initialize with base plan seats
        seat_alloc = {
            "tenant_id": tenant_id,
            "current_seats": base_plan_seats,
            "committed_seats": base_plan_seats,
            "last_increase_at": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        await db.seat_allocations.insert_one(seat_alloc)
    
    current_seats = seat_alloc.get("current_seats", base_plan_seats)
    committed_seats = seat_alloc.get("committed_seats", base_plan_seats)
    last_increase_at = seat_alloc.get("last_increase_at")
    
    # Calculate grace period
    is_in_grace_period = False
    grace_period_ends_at = None
    
    if last_increase_at:
        last_increase_dt = datetime.fromisoformat(last_increase_at.replace('Z', '+00:00'))
        grace_end = last_increase_dt + timedelta(hours=24)
        
        if now < grace_end:
            is_in_grace_period = True
            grace_period_ends_at = grace_end.isoformat()
    
    # Get price per seat for this plan
    seat_pricing = await db.seat_pricing.find_one(
        {"plan_name": {"$regex": f"^{plan_name}$", "$options": "i"}},
        {"_id": 0}
    )
    price_per_seat = seat_pricing.get("price_per_seat_monthly", 5.0) if seat_pricing else 5.0
    
    # Calculate additional seats cost (committed - base)
    additional_seats = max(0, committed_seats - base_plan_seats)
    additional_seats_cost = additional_seats * price_per_seat
    
    return {
        "base_plan_seats": base_plan_seats,
        "current_seats": current_seats,
        "committed_seats": committed_seats,
        "max_seats": 100,
        "last_increase_at": last_increase_at,
        "grace_period_ends_at": grace_period_ends_at,
        "is_in_grace_period": is_in_grace_period,
        "price_per_seat": price_per_seat,
        "additional_seats_cost": additional_seats_cost
    }


@router.put("/seats/allocation")
async def update_seat_allocation(
    adjustment: SeatAdjustment,
    current_user: dict = Depends(get_current_user)
):
    """
    Adjust total seat count.
    
    Rules:
    - Increase: Sets new committed value, starts 24hr grace period
    - Decrease: Updates current seats, but committed stays at high-water mark
    - During grace period: Can decrease back without affecting committed
    - Multiple increases reset the grace period
    """
    from datetime import timedelta
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Validate range
    if adjustment.total_seats < 1 or adjustment.total_seats > 100:
        raise HTTPException(status_code=400, detail="Total seats must be between 1 and 100")
    
    # Get subscription
    subscription = await quota_service._get_subscription(tenant_id)
    plan_name = subscription.get("plan_name", "free")
    plan_name_lower = plan_name.lower() if plan_name else "free"
    
    if plan_name_lower == "free":
        raise HTTPException(status_code=403, detail="Seat adjustment is only available for paid plans")
    
    # Get base plan seats
    config = await quota_service._get_config()
    base_plan_seats = 1
    
    if config:
        for feature in config.get("features", []):
            if feature.get("feature_key") == "max_seats":
                plan_limits = feature.get("plans", {}).get(plan_name_lower)
                if plan_limits:
                    base_plan_seats = plan_limits.get("limit", 1) or 1
                break
    
    if adjustment.total_seats < base_plan_seats:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot reduce below base plan seats ({base_plan_seats})"
        )
    
    # Get current allocation
    seat_alloc = await db.seat_allocations.find_one({"tenant_id": tenant_id}, {"_id": 0})
    
    now = datetime.now(timezone.utc)
    
    if not seat_alloc:
        seat_alloc = {
            "tenant_id": tenant_id,
            "current_seats": base_plan_seats,
            "committed_seats": base_plan_seats,
            "last_increase_at": None,
            "created_at": now.isoformat()
        }
    
    current_seats = seat_alloc.get("current_seats", base_plan_seats)
    committed_seats = seat_alloc.get("committed_seats", base_plan_seats)
    last_increase_at = seat_alloc.get("last_increase_at")
    
    # Check if in grace period
    is_in_grace_period = False
    if last_increase_at:
        last_increase_dt = datetime.fromisoformat(last_increase_at.replace('Z', '+00:00'))
        grace_end = last_increase_dt + timedelta(hours=24)
        is_in_grace_period = now < grace_end
    
    new_total = adjustment.total_seats
    update_fields = {"updated_at": now.isoformat()}
    
    if new_total > current_seats:
        # INCREASE: Update both current and committed, reset grace period
        update_fields["current_seats"] = new_total
        update_fields["committed_seats"] = max(committed_seats, new_total)
        update_fields["last_increase_at"] = now.isoformat()
        action = "increased"
        
    elif new_total < current_seats:
        # DECREASE
        update_fields["current_seats"] = new_total
        
        if is_in_grace_period:
            # Within grace period: can also reduce committed
            update_fields["committed_seats"] = max(new_total, base_plan_seats)
            update_fields["last_increase_at"] = None  # Clear grace period
            action = "decreased_within_grace"
        else:
            # Outside grace period: committed stays at high-water mark
            # But if they decrease, the committed becomes the new baseline for next period
            # committed_seats stays as is (high-water mark)
            action = "decreased"
    else:
        # No change
        return {"message": "No change in seat allocation", "current_seats": current_seats, "committed_seats": committed_seats}
    
    # Update database
    await db.seat_allocations.update_one(
        {"tenant_id": tenant_id},
        {"$set": update_fields},
        upsert=True
    )
    
    # Get updated allocation
    updated_alloc = await db.seat_allocations.find_one({"tenant_id": tenant_id}, {"_id": 0})
    
    # Get price per seat
    seat_pricing = await db.seat_pricing.find_one(
        {"plan_name": {"$regex": f"^{plan_name}$", "$options": "i"}},
        {"_id": 0}
    )
    price_per_seat = seat_pricing.get("price_per_seat_monthly", 5.0) if seat_pricing else 5.0
    
    additional_seats = max(0, updated_alloc.get("committed_seats", base_plan_seats) - base_plan_seats)
    additional_seats_cost = additional_seats * price_per_seat
    
    logger.info(f"Seat allocation updated for tenant {tenant_id}: {action}, current={updated_alloc.get('current_seats')}, committed={updated_alloc.get('committed_seats')}")
    
    return {
        "message": f"Seat allocation {action.replace('_', ' ')}",
        "action": action,
        "current_seats": updated_alloc.get("current_seats"),
        "committed_seats": updated_alloc.get("committed_seats"),
        "base_plan_seats": base_plan_seats,
        "additional_seats_cost": additional_seats_cost,
        "is_in_grace_period": action == "increased",
        "grace_period_ends_at": (now + timedelta(hours=24)).isoformat() if action == "increased" else None
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


# ============== SEAT PRICING MANAGEMENT (Super Admin) ==============

class SeatPricingConfig(BaseModel):
    """Seat pricing configuration for a plan tier"""
    plan_id: str  # ID of the subscription plan
    plan_name: str  # Display name of the plan
    price_per_seat_monthly: float  # Monthly price per additional seat
    price_per_seat_yearly: Optional[float] = None  # Yearly price per seat (optional)
    currency: str = "usd"
    billing_type: str = "subscription"  # "subscription" for recurring billing
    is_enabled: bool = True


class SeatPricingUpdate(BaseModel):
    """Update seat pricing for a plan"""
    price_per_seat_monthly: Optional[float] = None
    price_per_seat_yearly: Optional[float] = None
    currency: Optional[str] = None
    is_enabled: Optional[bool] = None


class SeatPricingResponse(BaseModel):
    """Seat pricing response"""
    model_config = ConfigDict(extra="ignore")
    id: str
    plan_id: str
    plan_name: str
    price_per_seat_monthly: float
    price_per_seat_yearly: Optional[float] = None
    currency: str
    billing_type: str
    is_enabled: bool
    stripe_product_id: Optional[str] = None
    stripe_price_monthly_id: Optional[str] = None
    stripe_price_yearly_id: Optional[str] = None
    created_at: str
    updated_at: str


@router.get("/seat-pricing", response_model=List[SeatPricingResponse])
async def get_all_seat_pricing(current_user: dict = Depends(get_super_admin_user)):
    """Get all seat pricing configurations synced with subscription plans (Super Admin only)"""
    # First, sync seat pricing with subscription plans
    await sync_seat_pricing_with_plans()
    
    pricing = await db.seat_pricing.find({}, {"_id": 0}).sort("plan_name", 1).to_list(100)
    return pricing


@router.get("/seat-pricing/{plan_id}")
async def get_seat_pricing_for_plan(plan_id: str):
    """Get seat pricing for a specific plan by ID or name (public endpoint)"""
    # Try to find by plan_id first, then by plan_name
    pricing = await db.seat_pricing.find_one(
        {"$or": [{"plan_id": plan_id}, {"plan_name": {"$regex": f"^{plan_id}$", "$options": "i"}}]}, 
        {"_id": 0}
    )
    
    if not pricing:
        # Return default pricing
        return {
            "plan_id": plan_id,
            "plan_name": plan_id,
            "price_per_seat_monthly": 5.0,
            "price_per_seat_yearly": 50.0,
            "currency": "usd",
            "billing_type": "subscription",
            "is_enabled": plan_id.lower() != "free"
        }
    
    return pricing


@router.post("/seat-pricing", response_model=SeatPricingResponse)
async def create_seat_pricing(
    config: SeatPricingConfig,
    current_user: dict = Depends(get_super_admin_user)
):
    """Create seat pricing configuration for a plan tier (Super Admin only)"""
    # Check if pricing already exists for this plan
    existing = await db.seat_pricing.find_one({"plan_id": config.plan_id})
    if existing:
        raise HTTPException(status_code=400, detail=f"Seat pricing for plan '{config.plan_name}' already exists")
    
    now = datetime.now(timezone.utc).isoformat()
    pricing_id = str(uuid.uuid4())
    
    # Calculate yearly price if not provided (20% discount)
    yearly_price = config.price_per_seat_yearly
    if yearly_price is None and config.price_per_seat_monthly > 0:
        yearly_price = config.price_per_seat_monthly * 12 * 0.8  # 20% yearly discount
    
    # Create Stripe product and recurring prices for seats
    stripe_product_id = None
    stripe_price_monthly_id = None
    stripe_price_yearly_id = None
    
    await StripeService.initialize_from_db()
    
    if StripeService.is_configured() and config.price_per_seat_monthly > 0:
        # Create seat subscription product in Stripe
        stripe_product_id = await StripeService.create_product(
            pricing_id,
            f"Additional Seats - {config.plan_name} Plan",
            f"Additional user seats subscription for {config.plan_name} plan"
        )
        
        if stripe_product_id:
            # Create monthly recurring price
            stripe_price_monthly_id = await StripeService.create_price(
                stripe_product_id,
                config.price_per_seat_monthly,
                "month",
                config.currency
            )
            
            # Create yearly recurring price
            if yearly_price and yearly_price > 0:
                stripe_price_yearly_id = await StripeService.create_price(
                    stripe_product_id,
                    yearly_price,
                    "year",
                    config.currency
                )
    
    pricing_doc = {
        "id": pricing_id,
        "plan_id": config.plan_id,
        "plan_name": config.plan_name,
        "price_per_seat_monthly": config.price_per_seat_monthly,
        "price_per_seat_yearly": yearly_price,
        "currency": config.currency,
        "billing_type": "subscription",
        "is_enabled": config.is_enabled,
        "stripe_product_id": stripe_product_id,
        "stripe_price_monthly_id": stripe_price_monthly_id,
        "stripe_price_yearly_id": stripe_price_yearly_id,
        "created_at": now,
        "updated_at": now
    }
    
    await db.seat_pricing.insert_one(pricing_doc)
    
    logger.info(f"Created seat pricing for plan: {config.plan_name}")
    
    return pricing_doc


@router.patch("/seat-pricing/{plan_id}", response_model=SeatPricingResponse)
async def update_seat_pricing(
    plan_id: str,
    update: SeatPricingUpdate,
    current_user: dict = Depends(get_super_admin_user)
):
    """Update seat pricing for a plan tier (Super Admin only)"""
    # Find by plan_id or plan_name
    pricing = await db.seat_pricing.find_one(
        {"$or": [{"plan_id": plan_id}, {"plan_name": {"$regex": f"^{plan_id}$", "$options": "i"}}]},
        {"_id": 0}
    )
    if not pricing:
        raise HTTPException(status_code=404, detail=f"Seat pricing for plan '{plan_id}' not found")
    
    update_fields = {k: v for k, v in update.model_dump().items() if v is not None}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await StripeService.initialize_from_db()
    
    # If monthly price changed, create new Stripe price
    if update.price_per_seat_monthly is not None and update.price_per_seat_monthly != pricing.get("price_per_seat_monthly"):
        if StripeService.is_configured() and pricing.get("stripe_product_id") and update.price_per_seat_monthly > 0:
            new_price_id = await StripeService.create_price(
                pricing["stripe_product_id"],
                update.price_per_seat_monthly,
                "month",
                update.currency or pricing["currency"]
            )
            if new_price_id:
                update_fields["stripe_price_monthly_id"] = new_price_id
    
    # If yearly price changed, create new Stripe price
    if update.price_per_seat_yearly is not None and update.price_per_seat_yearly != pricing.get("price_per_seat_yearly"):
        if StripeService.is_configured() and pricing.get("stripe_product_id") and update.price_per_seat_yearly > 0:
            new_price_id = await StripeService.create_price(
                pricing["stripe_product_id"],
                update.price_per_seat_yearly,
                "year",
                update.currency or pricing["currency"]
            )
            if new_price_id:
                update_fields["stripe_price_yearly_id"] = new_price_id
    
    await db.seat_pricing.update_one(
        {"id": pricing["id"]},
        {"$set": update_fields}
    )
    
    updated_pricing = await db.seat_pricing.find_one({"id": pricing["id"]}, {"_id": 0})
    
    logger.info(f"Updated seat pricing for plan: {plan_id}")
    
    return updated_pricing


@router.delete("/seat-pricing/{plan_id}")
async def delete_seat_pricing(
    plan_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Delete seat pricing for a plan tier (Super Admin only)"""
    pricing = await db.seat_pricing.find_one(
        {"$or": [{"plan_id": plan_id}, {"plan_name": {"$regex": f"^{plan_id}$", "$options": "i"}}]},
        {"_id": 0}
    )
    if not pricing:
        raise HTTPException(status_code=404, detail=f"Seat pricing for plan '{plan_id}' not found")
    
    # Archive Stripe product if exists
    if pricing.get("stripe_product_id"):
        await StripeService.initialize_from_db()
        if StripeService.is_configured():
            await StripeService.delete_product(pricing["stripe_product_id"])
    
    await db.seat_pricing.delete_one({"id": pricing["id"]})
    
    logger.info(f"Deleted seat pricing for plan: {plan_id}")
    
    return {"message": f"Seat pricing for plan '{pricing['plan_name']}' deleted successfully"}


@router.post("/seat-pricing/{plan_id}/sync-stripe")
async def sync_seat_pricing_to_stripe(
    plan_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Sync seat pricing to Stripe - creates products and prices (Super Admin only)"""
    pricing = await db.seat_pricing.find_one(
        {"$or": [{"plan_id": plan_id}, {"plan_name": {"$regex": f"^{plan_id}$", "$options": "i"}}]},
        {"_id": 0}
    )
    if not pricing:
        raise HTTPException(status_code=404, detail=f"Seat pricing for plan '{plan_id}' not found")
    
    if pricing.get("price_per_seat_monthly", 0) <= 0:
        raise HTTPException(status_code=400, detail="Cannot sync free seat pricing to Stripe")
    
    # Initialize Stripe
    await StripeService.initialize_from_db()
    
    if not StripeService.is_configured():
        raise HTTPException(status_code=503, detail="Stripe is not configured. Please configure Stripe integration first.")
    
    now = datetime.now(timezone.utc).isoformat()
    update_fields = {"updated_at": now}
    
    # Create or get Stripe product
    stripe_product_id = pricing.get("stripe_product_id")
    if not stripe_product_id:
        stripe_product_id = await StripeService.create_product(
            pricing["id"],
            f"Additional Seats - {pricing['plan_name']} Plan",
            f"Additional user seats subscription for {pricing['plan_name']} plan"
        )
        if stripe_product_id:
            update_fields["stripe_product_id"] = stripe_product_id
        else:
            raise HTTPException(status_code=500, detail="Failed to create Stripe product")
    
    # Create monthly recurring price if not exists
    if not pricing.get("stripe_price_monthly_id") and pricing.get("price_per_seat_monthly", 0) > 0:
        monthly_price_id = await StripeService.create_price(
            stripe_product_id,
            pricing["price_per_seat_monthly"],
            "month",
            pricing.get("currency", "usd")
        )
        if monthly_price_id:
            update_fields["stripe_price_monthly_id"] = monthly_price_id
            logger.info(f"Created monthly Stripe price for seat pricing: {monthly_price_id}")
    
    # Create yearly recurring price if not exists
    if not pricing.get("stripe_price_yearly_id") and pricing.get("price_per_seat_yearly", 0) > 0:
        yearly_price_id = await StripeService.create_price(
            stripe_product_id,
            pricing["price_per_seat_yearly"],
            "year",
            pricing.get("currency", "usd")
        )
        if yearly_price_id:
            update_fields["stripe_price_yearly_id"] = yearly_price_id
            logger.info(f"Created yearly Stripe price for seat pricing: {yearly_price_id}")
    
    # Update database
    await db.seat_pricing.update_one(
        {"id": pricing["id"]},
        {"$set": update_fields}
    )
    
    updated_pricing = await db.seat_pricing.find_one({"id": pricing["id"]}, {"_id": 0})
    
    logger.info(f"Synced seat pricing to Stripe for plan: {pricing['plan_name']}")
    
    return {
        "message": f"Seat pricing for '{pricing['plan_name']}' synced to Stripe successfully",
        "stripe_product_id": updated_pricing.get("stripe_product_id"),
        "stripe_price_monthly_id": updated_pricing.get("stripe_price_monthly_id"),
        "stripe_price_yearly_id": updated_pricing.get("stripe_price_yearly_id")
    }


@router.post("/seat-pricing/sync")
async def sync_seat_pricing_endpoint(current_user: dict = Depends(get_super_admin_user)):
    """Manually sync seat pricing with subscription plans (Super Admin only)"""
    await sync_seat_pricing_with_plans()
    pricing = await db.seat_pricing.find({}, {"_id": 0}).to_list(100)
    return {"message": "Seat pricing synced with subscription plans", "pricing": pricing}


# ============== SEAT SUBSCRIPTION FLOW ==============

class SeatSubscriptionRequest(BaseModel):
    """Request to subscribe to additional seats"""
    quantity: int
    billing_cycle: str = "monthly"  # "monthly" or "yearly"


@router.post("/extra-seats/checkout")
async def create_seat_subscription_checkout(
    purchase: SeatSubscriptionRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Create Stripe checkout session for seat subscription"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    if purchase.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")
    
    # Get current subscription to determine plan
    subscription = await quota_service._get_subscription(tenant_id)
    plan_name = subscription.get("plan_name", "free")
    plan_id = subscription.get("plan_id", "")
    
    # Check if on free plan
    if plan_name.lower() == "free":
        raise HTTPException(
            status_code=403,
            detail="Extra seats are only available for paid subscription plans. Please upgrade first."
        )
    
    # Get seat pricing for this plan
    seat_pricing = await db.seat_pricing.find_one(
        {"$or": [{"plan_id": plan_id}, {"plan_name": {"$regex": f"^{plan_name}$", "$options": "i"}}]},
        {"_id": 0}
    )
    
    if not seat_pricing:
        raise HTTPException(
            status_code=404,
            detail="Seat pricing not configured for this plan. Please contact support."
        )
    
    if not seat_pricing.get("is_enabled"):
        raise HTTPException(
            status_code=403,
            detail="Seat subscriptions are not available for your current plan."
        )
    
    # Initialize Stripe
    await StripeService.initialize_from_db()
    
    if not StripeService.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Payment system not configured. Please contact support."
        )
    
    # Get or create Stripe customer
    sub_doc = await db.subscriptions.find_one({"tenant_id": tenant_id}, {"_id": 0})
    stripe_customer_id = sub_doc.get("stripe_customer_id") if sub_doc else None
    
    if not stripe_customer_id:
        stripe_customer_id = await StripeService.create_customer(
            current_user["email"],
            current_user["name"],
            tenant_id
        )
        
        if not stripe_customer_id:
            raise HTTPException(status_code=500, detail="Failed to create customer")
        
        # Update subscription with customer ID
        if sub_doc:
            await db.subscriptions.update_one(
                {"tenant_id": tenant_id},
                {"$set": {"stripe_customer_id": stripe_customer_id}}
            )
    
    # Get Stripe price ID based on billing cycle
    if purchase.billing_cycle == "yearly":
        stripe_price_id = seat_pricing.get("stripe_price_yearly_id")
        price_per_seat = seat_pricing.get("price_per_seat_yearly", 0)
    else:
        stripe_price_id = seat_pricing.get("stripe_price_monthly_id")
        price_per_seat = seat_pricing.get("price_per_seat_monthly", 0)
    
    if not stripe_price_id:
        raise HTTPException(
            status_code=500,
            detail=f"Stripe pricing not configured for {purchase.billing_cycle} seat subscriptions. Please contact support."
        )
    
    # Determine frontend URL
    origin = request.headers.get("origin") or request.headers.get("referer")
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        frontend_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    
    # Create subscription checkout session (not one-time)
    import stripe
    try:
        session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price": stripe_price_id,
                "quantity": purchase.quantity
            }],
            mode="subscription",  # Subscription mode for recurring billing
            success_url=f"{frontend_url}/dashboard/team?seats_success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_url}/dashboard/team?seats_canceled=true",
            metadata={
                "tenant_id": tenant_id,
                "type": "seat_subscription",
                "quantity": str(purchase.quantity),
                "plan_name": plan_name,
                "billing_cycle": purchase.billing_cycle
            }
        )
        
        logger.info(f"Created seat subscription checkout: {session.id} for {purchase.quantity} seats")
        
        # Calculate total
        total_amount = price_per_seat * purchase.quantity
        
        return {
            "checkout_url": session.url,
            "session_id": session.id,
            "quantity": purchase.quantity,
            "price_per_seat": price_per_seat,
            "total_amount": total_amount,
            "currency": seat_pricing["currency"],
            "billing_cycle": purchase.billing_cycle
        }
    except Exception as e:
        logger.error(f"Failed to create seat subscription checkout: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")


@router.post("/extra-seats/verify")
async def verify_seat_subscription(
    session_id: str = Query(..., description="Stripe checkout session ID"),
    current_user: dict = Depends(get_current_user)
):
    """Verify and activate seat subscription from Stripe checkout session"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    logger.info(f"Verifying seat subscription session: {session_id} for tenant: {tenant_id}")
    
    # Initialize Stripe
    await StripeService.initialize_from_db()
    
    if not StripeService.is_configured():
        raise HTTPException(status_code=503, detail="Payment system not configured")
    
    import stripe
    try:
        # Get checkout session from Stripe
        session = stripe.checkout.Session.retrieve(session_id)
        
        # Verify tenant
        if session.metadata.get("tenant_id") != tenant_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Check if this is a seat subscription
        session_type = session.metadata.get("type")
        if session_type not in ["seat_subscription", "seat_purchase"]:
            raise HTTPException(status_code=400, detail="Invalid session type")
        
        # Check payment status
        if session.payment_status != "paid":
            return {"status": "pending", "message": "Payment not completed"}
        
        # Get quantity and billing info from metadata
        quantity = int(session.metadata.get("quantity", 0))
        billing_cycle = session.metadata.get("billing_cycle", "monthly")
        subscription_id = session.subscription
        
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Invalid quantity")
        
        now = datetime.now(timezone.utc).isoformat()
        
        # Check if already processed
        existing_subscription = await db.seat_subscriptions.find_one({
            "stripe_session_id": session_id,
            "status": "active"
        })
        
        if existing_subscription:
            return {
                "status": "already_processed",
                "message": "This subscription was already activated",
                "quantity": quantity
            }
        
        # Record seat subscription
        await db.seat_subscriptions.update_one(
            {"tenant_id": tenant_id},
            {
                "$set": {
                    "quantity": quantity,
                    "billing_cycle": billing_cycle,
                    "stripe_subscription_id": subscription_id,
                    "stripe_session_id": session_id,
                    "status": "active",
                    "updated_at": now
                },
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "created_at": now
                }
            },
            upsert=True
        )
        
        # Update extra_seats collection for quota tracking
        await db.extra_seats.update_one(
            {"tenant_id": tenant_id},
            {
                "$set": {
                    "quantity": quantity,
                    "subscription_based": True,
                    "stripe_subscription_id": subscription_id,
                    "billing_cycle": billing_cycle,
                    "updated_at": now
                },
                "$setOnInsert": {
                    "created_at": now
                }
            },
            upsert=True
        )
        
        # Record transaction
        await db.seat_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "type": "subscription",
            "quantity": quantity,
            "billing_cycle": billing_cycle,
            "amount_total": (session.amount_total or 0) / 100,
            "stripe_session_id": session_id,
            "stripe_subscription_id": subscription_id,
            "status": "completed",
            "created_at": now
        })
        
        logger.info(f"Seat subscription activated: {quantity} seats for tenant {tenant_id}")
        
        return {
            "status": "completed",
            "message": f"Successfully subscribed to {quantity} seat(s)",
            "quantity": quantity,
            "billing_cycle": billing_cycle,
            "subscription_id": subscription_id
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error verifying seat subscription: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"Error verifying seat subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to verify subscription: {str(e)}")


# ============== HELPER FUNCTIONS ==============

async def sync_seat_pricing_with_plans():
    """Sync seat pricing configurations with subscription plans from Plan Management"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Get all subscription plans from database
    plans = await db.subscription_plans.find({}, {"_id": 0}).to_list(100)
    
    if not plans:
        logger.warning("No subscription plans found - skipping seat pricing sync")
        return
    
    # Default seat pricing percentages based on plan price
    # Lower tier plans = lower seat price, higher tier = higher seat price
    def calculate_seat_price(plan_monthly_price):
        if plan_monthly_price == 0:
            return 0  # Free plan
        elif plan_monthly_price < 50:
            return 5.0  # Entry tier
        elif plan_monthly_price < 100:
            return 8.0  # Mid tier
        elif plan_monthly_price < 200:
            return 12.0  # Pro tier
        else:
            return 15.0  # Enterprise tier
    
    for plan in plans:
        plan_id = plan.get("id")
        plan_name = plan.get("name", "Unknown")
        plan_monthly_price = plan.get("price_monthly", 0)
        
        # Check if seat pricing already exists for this plan
        existing = await db.seat_pricing.find_one({"plan_id": plan_id})
        
        if existing:
            # Update plan_name if it changed
            if existing.get("plan_name") != plan_name:
                await db.seat_pricing.update_one(
                    {"plan_id": plan_id},
                    {"$set": {"plan_name": plan_name, "updated_at": now}}
                )
            continue
        
        # Calculate default seat pricing
        monthly_seat_price = calculate_seat_price(plan_monthly_price)
        yearly_seat_price = monthly_seat_price * 12 * 0.8 if monthly_seat_price > 0 else 0  # 20% yearly discount
        
        # Create new seat pricing for this plan
        pricing_doc = {
            "id": str(uuid.uuid4()),
            "plan_id": plan_id,
            "plan_name": plan_name,
            "price_per_seat_monthly": monthly_seat_price,
            "price_per_seat_yearly": yearly_seat_price,
            "currency": "usd",
            "billing_type": "subscription",
            "is_enabled": plan_monthly_price > 0,  # Disabled for free plans
            "stripe_product_id": None,
            "stripe_price_monthly_id": None,
            "stripe_price_yearly_id": None,
            "created_at": now,
            "updated_at": now
        }
        
        await db.seat_pricing.insert_one(pricing_doc)
        logger.info(f"Created seat pricing for plan: {plan_name} (${monthly_seat_price}/month)")
    
    # Clean up orphaned seat pricing (plans that no longer exist)
    plan_ids = [p.get("id") for p in plans]
    orphaned = await db.seat_pricing.find(
        {"plan_id": {"$nin": plan_ids, "$ne": None}},
        {"_id": 0, "plan_name": 1}
    ).to_list(100)
    
    if orphaned:
        for orphan in orphaned:
            logger.info(f"Removing orphaned seat pricing for: {orphan.get('plan_name')}")
        await db.seat_pricing.delete_many({"plan_id": {"$nin": plan_ids, "$ne": None}})
    
    logger.info(f"Seat pricing synced with {len(plans)} subscription plans")
