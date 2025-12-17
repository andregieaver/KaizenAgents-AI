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


@router.post("/seat-pricing/sync")
async def sync_seat_pricing_endpoint(current_user: dict = Depends(get_super_admin_user)):
    """Manually sync seat pricing with subscription plans (Super Admin only)"""
    await sync_seat_pricing_with_plans()
    pricing = await db.seat_pricing.find({}, {"_id": 0}).to_list(100)
    return {"message": "Seat pricing synced with subscription plans", "pricing": pricing}


# ============== SEAT PURCHASE FLOW ==============

class SeatPurchaseRequest(BaseModel):
    """Request to purchase additional seats"""
    quantity: int
    

@router.post("/extra-seats/checkout")
async def create_seat_checkout(
    purchase: SeatPurchaseRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Create Stripe checkout session for seat purchase"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    if purchase.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")
    
    # Get current subscription to determine plan
    subscription = await quota_service._get_subscription(tenant_id)
    plan_name = subscription.get("plan_name", "free")
    
    # Check if on free plan
    if plan_name == "free":
        raise HTTPException(
            status_code=403,
            detail="Extra seats are only available for paid subscription plans. Please upgrade first."
        )
    
    # Get seat pricing for this plan
    seat_pricing = await db.seat_pricing.find_one({"plan_name": plan_name}, {"_id": 0})
    
    if not seat_pricing:
        # Try to get default pricing or create it
        seat_pricing = await db.seat_pricing.find_one({"plan_name": "default"}, {"_id": 0})
        
        if not seat_pricing:
            raise HTTPException(
                status_code=404,
                detail="Seat pricing not configured for this plan. Please contact support."
            )
    
    if not seat_pricing.get("is_enabled"):
        raise HTTPException(
            status_code=403,
            detail="Seat purchases are not available for your current plan."
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
    
    # Get Stripe price ID
    stripe_price_id = seat_pricing.get("stripe_price_id")
    
    if not stripe_price_id:
        raise HTTPException(
            status_code=500,
            detail="Stripe pricing not configured for seats. Please contact support."
        )
    
    # Determine frontend URL
    origin = request.headers.get("origin") or request.headers.get("referer")
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        frontend_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    
    # Create checkout session
    checkout = await StripeService.create_seat_checkout_session(
        stripe_customer_id,
        stripe_price_id,
        purchase.quantity,
        f"{frontend_url}/dashboard/team?seats_success=true",
        f"{frontend_url}/dashboard/team?seats_canceled=true",
        tenant_id,
        plan_name
    )
    
    if not checkout:
        raise HTTPException(status_code=500, detail="Failed to create checkout session")
    
    # Calculate total
    total_amount = seat_pricing["price_per_seat"] * purchase.quantity
    
    return {
        "checkout_url": checkout["url"],
        "session_id": checkout["session_id"],
        "quantity": purchase.quantity,
        "price_per_seat": seat_pricing["price_per_seat"],
        "total_amount": total_amount,
        "currency": seat_pricing["currency"]
    }


@router.post("/extra-seats/verify")
async def verify_seat_purchase(
    session_id: str = Query(..., description="Stripe checkout session ID"),
    current_user: dict = Depends(get_current_user)
):
    """Verify and complete seat purchase from Stripe checkout session"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    logger.info(f"Verifying seat purchase session: {session_id} for tenant: {tenant_id}")
    
    # Initialize Stripe
    await StripeService.initialize_from_db()
    
    if not StripeService.is_configured():
        raise HTTPException(status_code=503, detail="Payment system not configured")
    
    # Get checkout session
    session = await StripeService.get_checkout_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Checkout session not found")
    
    # Verify tenant
    if session["metadata"].get("tenant_id") != tenant_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # Check if this is a seat purchase
    if session["metadata"].get("type") != "seat_purchase":
        raise HTTPException(status_code=400, detail="Invalid session type")
    
    # Check payment status
    if session["payment_status"] != "paid":
        return {"status": "pending", "message": "Payment not completed"}
    
    # Get quantity from metadata
    quantity = int(session["metadata"].get("quantity", 0))
    
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Invalid quantity")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if already processed
    existing_transaction = await db.seat_transactions.find_one({
        "stripe_session_id": session_id,
        "status": "completed"
    })
    
    if existing_transaction:
        return {
            "status": "already_processed",
            "message": "This purchase was already processed",
            "quantity": quantity
        }
    
    # Update extra seats
    await db.extra_seats.update_one(
        {"tenant_id": tenant_id},
        {
            "$inc": {"quantity": quantity},
            "$set": {
                "updated_at": now,
                "last_purchase": {
                    "quantity": quantity,
                    "stripe_session_id": session_id,
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
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "type": "purchase",
        "quantity": quantity,
        "amount_total": session.get("amount_total", 0) / 100,  # Convert from cents
        "stripe_session_id": session_id,
        "status": "completed",
        "created_at": now
    })
    
    logger.info(f"Seat purchase completed: {quantity} seats for tenant {tenant_id}")
    
    # Get updated seat count
    extra_seats_doc = await db.extra_seats.find_one({"tenant_id": tenant_id}, {"_id": 0})
    total_extra_seats = extra_seats_doc.get("quantity", 0) if extra_seats_doc else 0
    
    return {
        "status": "completed",
        "message": f"Successfully purchased {quantity} seat(s)",
        "quantity": quantity,
        "total_extra_seats": total_extra_seats
    }


# ============== HELPER FUNCTIONS ==============

async def initialize_default_seat_pricing():
    """Initialize default seat pricing for all plans"""
    now = datetime.now(timezone.utc).isoformat()
    
    default_pricing = [
        {
            "id": str(uuid.uuid4()),
            "plan_name": "free",
            "price_per_seat": 0,
            "currency": "usd",
            "billing_type": "one_time",
            "is_enabled": False,  # Can't buy seats on free plan
            "stripe_product_id": None,
            "stripe_price_id": None,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "plan_name": "starter",
            "price_per_seat": 5.0,
            "currency": "usd",
            "billing_type": "one_time",
            "is_enabled": True,
            "stripe_product_id": None,
            "stripe_price_id": None,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "plan_name": "professional",
            "price_per_seat": 8.0,
            "currency": "usd",
            "billing_type": "one_time",
            "is_enabled": True,
            "stripe_product_id": None,
            "stripe_price_id": None,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "plan_name": "enterprise",
            "price_per_seat": 12.0,
            "currency": "usd",
            "billing_type": "one_time",
            "is_enabled": True,
            "stripe_product_id": None,
            "stripe_price_id": None,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "plan_name": "default",  # Fallback pricing
            "price_per_seat": 5.0,
            "currency": "usd",
            "billing_type": "one_time",
            "is_enabled": True,
            "stripe_product_id": None,
            "stripe_price_id": None,
            "created_at": now,
            "updated_at": now
        }
    ]
    
    for pricing in default_pricing:
        existing = await db.seat_pricing.find_one({"plan_name": pricing["plan_name"]})
        if not existing:
            await db.seat_pricing.insert_one(pricing)
    
    logger.info("Default seat pricing initialized")
