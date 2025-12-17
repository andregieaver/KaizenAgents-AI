"""
Subscription management routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
import uuid
import os
from utils.logger import log_error, log_info

from models import *
from middleware import get_current_user, get_super_admin_user
from middleware.database import db
from services.stripe_service import StripeService

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# Models
class PlanFeatures(BaseModel):
    max_conversations: Optional[int] = None  # None = unlimited
    max_agents: Optional[int] = None  # None = unlimited
    analytics_enabled: bool = True
    api_access: bool = False
    support_level: Literal["email", "priority", "premium"] = "email"
    conversation_history_days: Optional[int] = 30  # None = unlimited
    remove_branding: bool = False
    custom_integrations: bool = False
    custom_items: Optional[List[str]] = None  # Custom feature items for display

class PlanCreate(BaseModel):
    name: str
    description: str
    price_monthly: float
    price_yearly: Optional[float] = None
    features: PlanFeatures
    is_public: bool = True
    sort_order: int = 0

class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_monthly: Optional[float] = None
    price_yearly: Optional[float] = None
    features: Optional[PlanFeatures] = None
    is_public: Optional[bool] = None
    sort_order: Optional[int] = None

class PlanResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: str
    price_monthly: float
    price_yearly: Optional[float]
    features: Dict[str, Any]
    is_public: bool
    sort_order: int
    created_at: str
    updated_at: str

class SubscriptionCreate(BaseModel):
    plan_id: str
    billing_cycle: Literal["monthly", "yearly"] = "monthly"

class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: str
    plan_id: str
    plan_name: str
    status: str
    billing_cycle: str
    current_period_start: str
    current_period_end: str
    trial_end: Optional[str]
    stripe_subscription_id: Optional[str]
    stripe_customer_id: Optional[str]

class UsageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tenant_id: str
    period_start: str
    period_end: str
    conversations_used: int
    agents_created: int
    api_calls: int
    limits: Dict[str, Any]
    usage_percentage: Dict[str, float]

# ============== PLAN MANAGEMENT (Super Admin) ==============

@router.post("/plans", response_model=PlanResponse)
async def create_plan(
    plan_data: PlanCreate,
    current_user: dict = Depends(get_super_admin_user)
):
    """Create a new subscription plan (Super Admin only)"""
    now = datetime.now(timezone.utc).isoformat()
    plan_id = str(uuid.uuid4())
    
    # Calculate yearly price if not provided (20% discount by default)
    yearly_price = plan_data.price_yearly
    if yearly_price is None and plan_data.price_monthly > 0:
        # Get discount from platform settings
        platform_settings = await db.platform_settings.find_one({"key": "subscription_settings"}, {"_id": 0})
        discount = platform_settings.get("value", {}).get("yearly_discount_percent", 20) if platform_settings else 20
        yearly_price = plan_data.price_monthly * 12 * (1 - discount / 100)
    
    # Create Stripe product and prices if configured
    stripe_product_id = None
    stripe_price_monthly_id = None
    stripe_price_yearly_id = None
    
    # Initialize Stripe from database
    await StripeService.initialize_from_db()
    
    if StripeService.is_configured():
        # Create Stripe product
        stripe_product_id = await StripeService.create_product(
            plan_id,
            plan_data.name,
            plan_data.description
        )
        
        if stripe_product_id:
            # Create monthly price
            if plan_data.price_monthly > 0:
                stripe_price_monthly_id = await StripeService.create_price(
                    stripe_product_id,
                    plan_data.price_monthly,
                    "month"
                )
            
            # Create yearly price
            if yearly_price and yearly_price > 0:
                stripe_price_yearly_id = await StripeService.create_price(
                    stripe_product_id,
                    yearly_price,
                    "year"
                )
    
    plan = {
        "id": plan_id,
        "name": plan_data.name,
        "description": plan_data.description,
        "price_monthly": plan_data.price_monthly,
        "price_yearly": yearly_price,
        "features": plan_data.features.model_dump(),
        "is_public": plan_data.is_public,
        "sort_order": plan_data.sort_order,
        "stripe_product_id": stripe_product_id,
        "stripe_price_monthly_id": stripe_price_monthly_id,
        "stripe_price_yearly_id": stripe_price_yearly_id,
        "created_at": now,
        "updated_at": now
    }
    
    await db.subscription_plans.insert_one(plan)
    
    return plan

@router.get("/plans", response_model=List[PlanResponse])
async def get_plans(include_hidden: bool = False):
    """Get all subscription plans (public endpoint)"""
    query = {}
    if not include_hidden:
        query["is_public"] = True
    
    plans = await db.subscription_plans.find(query, {"_id": 0}).sort("sort_order", 1).to_list(100)
    return plans

@router.get("/plans/{plan_id}", response_model=PlanResponse)
async def get_plan(
    plan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific plan details"""
    plan = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan

@router.patch("/plans/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: str,
    plan_data: PlanUpdate,
    current_user: dict = Depends(get_super_admin_user)
):
    """Update subscription plan (Super Admin only)"""
    plan = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    update_fields = {k: v for k, v in plan_data.model_dump().items() if v is not None}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Initialize Stripe from database
    await StripeService.initialize_from_db()
    
    # Update Stripe product if configured and exists
    if StripeService.is_configured() and plan.get("stripe_product_id"):
        if plan_data.name or plan_data.description:
            await StripeService.update_product(
                plan["stripe_product_id"],
                plan_data.name or plan["name"],
                plan_data.description or plan["description"]
            )
        
        # If prices changed, create new prices (Stripe prices are immutable)
        if plan_data.price_monthly is not None and plan_data.price_monthly != plan["price_monthly"]:
            if plan_data.price_monthly > 0:
                new_price_id = await StripeService.create_price(
                    plan["stripe_product_id"],
                    plan_data.price_monthly,
                    "month"
                )
                if new_price_id:
                    update_fields["stripe_price_monthly_id"] = new_price_id
        
        if plan_data.price_yearly is not None and plan_data.price_yearly != plan.get("price_yearly"):
            if plan_data.price_yearly > 0:
                new_price_id = await StripeService.create_price(
                    plan["stripe_product_id"],
                    plan_data.price_yearly,
                    "year"
                )
                if new_price_id:
                    update_fields["stripe_price_yearly_id"] = new_price_id
    
    await db.subscription_plans.update_one(
        {"id": plan_id},
        {"$set": update_fields}
    )
    
    updated_plan = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})
    return updated_plan

@router.delete("/plans/{plan_id}")
async def delete_plan(
    plan_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Delete subscription plan (Super Admin only)"""
    # Check if any subscriptions are using this plan
    subscriptions_count = await db.subscriptions.count_documents({"plan_id": plan_id, "status": "active"})
    if subscriptions_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete plan with {subscriptions_count} active subscriptions"
        )
    
    # Get plan to find Stripe product ID
    plan = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})
    
    # Initialize Stripe from database
    await StripeService.initialize_from_db()
    
    # Archive Stripe product if configured
    if StripeService.is_configured() and plan and plan.get("stripe_product_id"):
        await StripeService.delete_product(plan["stripe_product_id"])
    
    result = await db.subscription_plans.delete_one({"id": plan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return {"message": "Plan deleted successfully"}

# ============== SUBSCRIPTION MANAGEMENT ==============

@router.get("/current", response_model=SubscriptionResponse)
async def get_current_subscription(current_user: dict = Depends(get_current_user)):
    """Get current user's subscription"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    subscription = await db.subscriptions.find_one(
        {"tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not subscription:
        # Auto-assign free tier
        free_plan = await db.subscription_plans.find_one(
            {"name": "Free", "price_monthly": 0},
            {"_id": 0}
        )
        
        if not free_plan:
            raise HTTPException(status_code=404, detail="Free plan not found. Please contact support.")
        
        # Create free subscription
        now = datetime.now(timezone.utc)
        subscription_id = str(uuid.uuid4())
        
        subscription = {
            "id": subscription_id,
            "tenant_id": tenant_id,
            "plan_id": free_plan["id"],
            "plan_name": free_plan["name"],
            "status": "active",
            "billing_cycle": "monthly",
            "current_period_start": now.isoformat(),
            "current_period_end": (now + timedelta(days=30)).isoformat(),
            "trial_end": None,
            "stripe_subscription_id": None,
            "stripe_customer_id": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.subscriptions.insert_one(subscription)
    
    return subscription

@router.get("/usage", response_model=UsageResponse)
async def get_usage(current_user: dict = Depends(get_current_user)):
    """Get current usage statistics"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get subscription and plan
    subscription = await db.subscriptions.find_one({"tenant_id": tenant_id}, {"_id": 0})
    
    # Auto-create free subscription if none exists
    if not subscription:
        # Find free plan
        free_plan = await db.subscription_plans.find_one(
            {"name": "Free", "price_monthly": 0},
            {"_id": 0}
        )
        
        if not free_plan:
            # Return default usage with no limits
            now = datetime.now(timezone.utc)
            return {
                "tenant_id": tenant_id,
                "period_start": now.isoformat(),
                "period_end": (now + timedelta(days=30)).isoformat(),
                "conversations_used": 0,
                "agents_created": 0,
                "api_calls": 0,
                "limits": {
                    "max_conversations": None,
                    "max_agents": None,
                    "analytics_enabled": True,
                    "api_access": False,
                    "support_level": "email",
                    "conversation_history_days": 30,
                    "remove_branding": False,
                    "custom_integrations": False
                },
                "usage_percentage": {"conversations": 0, "agents": 0}
            }
        
        # Create free subscription
        now = datetime.now(timezone.utc)
        subscription_id = str(uuid.uuid4())
        
        subscription = {
            "id": subscription_id,
            "tenant_id": tenant_id,
            "plan_id": free_plan["id"],
            "plan_name": free_plan["name"],
            "status": "active",
            "billing_cycle": "monthly",
            "current_period_start": now.isoformat(),
            "current_period_end": (now + timedelta(days=30)).isoformat(),
            "trial_end": None,
            "stripe_subscription_id": None,
            "stripe_customer_id": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.subscriptions.insert_one(subscription)
    
    plan = await db.subscription_plans.find_one({"id": subscription["plan_id"]}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Calculate current period
    period_start = datetime.fromisoformat(subscription["current_period_start"])
    period_end = datetime.fromisoformat(subscription["current_period_end"])
    
    # Count conversations in current period
    conversations_count = await db.conversations.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": period_start.isoformat()}
    })
    
    # Count active agents
    agents_count = await db.user_agents.count_documents({
        "tenant_id": tenant_id
    })
    
    # Get API calls (if tracked)
    api_calls = 0  # Placeholder for future API call tracking
    
    # Calculate usage percentages
    limits = plan["features"]
    usage_percentage = {}
    
    if limits.get("max_conversations"):
        usage_percentage["conversations"] = (conversations_count / limits["max_conversations"]) * 100
    else:
        usage_percentage["conversations"] = 0  # Unlimited
    
    if limits.get("max_agents"):
        usage_percentage["agents"] = (agents_count / limits["max_agents"]) * 100
    else:
        usage_percentage["agents"] = 0  # Unlimited
    
    return {
        "tenant_id": tenant_id,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "conversations_used": conversations_count,
        "agents_created": agents_count,
        "api_calls": api_calls,
        "limits": limits,
        "usage_percentage": usage_percentage
    }

@router.post("/checkout")
async def create_checkout_session(
    subscription_data: SubscriptionCreate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Create Stripe checkout session for subscription"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get plan
    plan = await db.subscription_plans.find_one({"id": subscription_data.plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Get tenant
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Initialize Stripe from database settings
    await StripeService.initialize_from_db()
    
    # Check if Stripe is configured
    if not StripeService.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Payment system not configured. Please contact support."
        )
    
    # Check if free plan
    if plan["price_monthly"] == 0:
        raise HTTPException(status_code=400, detail="Cannot checkout for free plan")
    
    # Get or create Stripe customer
    subscription = await db.subscriptions.find_one({"tenant_id": tenant_id}, {"_id": 0})
    stripe_customer_id = subscription.get("stripe_customer_id") if subscription else None
    
    if not stripe_customer_id:
        stripe_customer_id = await StripeService.create_customer(
            current_user["email"],
            current_user["name"],
            tenant_id
        )
        
        if not stripe_customer_id:
            raise HTTPException(status_code=500, detail="Failed to create customer")
    
    # Get price ID based on billing cycle
    price_id = None
    if subscription_data.billing_cycle == "yearly":
        price_id = plan.get("stripe_price_yearly_id")
    else:
        price_id = plan.get("stripe_price_monthly_id")
    
    if not price_id:
        raise HTTPException(status_code=400, detail="Price not available for this billing cycle")
    
    # Get trial days from settings
    platform_settings = await db.platform_settings.find_one({"key": "subscription_settings"}, {"_id": 0})
    trial_days = platform_settings.get("value", {}).get("trial_days", 30) if platform_settings else 30
    
    # Check if already had trial
    if subscription and subscription.get("trial_end"):
        trial_days = 0  # No trial for returning customers
    
    # Create checkout session
    # Dynamically determine frontend URL from request
    origin = request.headers.get("origin") or request.headers.get("referer")
    if origin:
        # Remove trailing slash and any path from referer
        frontend_url = origin.rstrip('/').split('?')[0]
        # If it's a referer with path, get just the origin
        if origin.startswith('http'):
            from urllib.parse import urlparse
            parsed = urlparse(origin)
            frontend_url = f"{parsed.scheme}://{parsed.netloc}"
    else:
        # Fallback to env variable or localhost
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    
    checkout = await StripeService.create_checkout_session(
        stripe_customer_id,
        price_id,
        f"{frontend_url}/dashboard/billing?success=true",
        f"{frontend_url}/dashboard/billing?canceled=true",
        tenant_id,
        plan["id"],
        trial_days
    )
    
    if not checkout:
        raise HTTPException(status_code=500, detail="Failed to create checkout session")
    
    return {
        "checkout_url": checkout["url"],
        "session_id": checkout["session_id"]
    }

@router.post("/verify-checkout")
async def verify_checkout_session(
    session_id: str = Query(..., description="Stripe checkout session ID"),
    current_user: dict = Depends(get_current_user)
):
    """Verify and activate subscription from Stripe checkout session"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        log_error("No tenant_id in verify-checkout", user=current_user)
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    log_info(f"Verifying checkout session", session_id=session_id, tenant_id=tenant_id)
    
    # Initialize Stripe from database
    initialized = await StripeService.initialize_from_db()
    log_info(f"Stripe initialized from database", success=initialized)
    
    if not StripeService.is_configured():
        log_error("Stripe not configured in verify-checkout")
        raise HTTPException(status_code=503, detail="Payment system not configured")
    
    try:
        # Retrieve the checkout session from Stripe
        import stripe
        log_info(f"Retrieving checkout session from Stripe", session_id=session_id)
        session = stripe.checkout.Session.retrieve(session_id)
        log_info(f"Checkout session retrieved", payment_status=session.payment_status, subscription_id=session.get("subscription"))
        
        # Verify tenant_id matches
        if session.metadata.get("tenant_id") != tenant_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Check if subscription was created
        if session.payment_status != "paid":
            return {"status": "pending", "message": "Payment not completed"}
        
        subscription_id = session.get("subscription")
        customer_id = session.get("customer")
        plan_id = session.metadata.get("plan_id")
        
        if not subscription_id or not plan_id:
            raise HTTPException(status_code=400, detail="Invalid session data")
        
        # Get plan details
        plan = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Get subscription details from Stripe
        log_info(f"Retrieving Stripe subscription", subscription_id=subscription_id)
        stripe_sub = stripe.Subscription.retrieve(subscription_id)
        
        # Log what we received for debugging
        log_info(f"Stripe subscription retrieved", 
                subscription_id=subscription_id,
                status=stripe_sub.get('status') if isinstance(stripe_sub, dict) else getattr(stripe_sub, 'status', 'unknown'),
                object_type=type(stripe_sub).__name__,
                has_items=hasattr(stripe_sub, 'items') or 'items' in stripe_sub if isinstance(stripe_sub, dict) else False)
        
        now = datetime.now(timezone.utc)
        
        # Helper to safely get value from stripe object (can be dict or object)
        def get_stripe_value(obj, key, default=None):
            if isinstance(obj, dict):
                return obj.get(key, default)
            return getattr(obj, key, default)
        
        # Safely get period dates with validation
        current_period_start = get_stripe_value(stripe_sub, 'current_period_start')
        if current_period_start is None:
            log_error("Stripe subscription missing current_period_start", subscription_id=subscription_id)
            period_start = now
        else:
            period_start = datetime.fromtimestamp(current_period_start, tz=timezone.utc)
        
        current_period_end = get_stripe_value(stripe_sub, 'current_period_end')
        if current_period_end is None:
            log_error("Stripe subscription missing current_period_end", subscription_id=subscription_id)
            period_end = now + timedelta(days=30)
        else:
            period_end = datetime.fromtimestamp(current_period_end, tz=timezone.utc)
        
        trial_end_timestamp = get_stripe_value(stripe_sub, 'trial_end')
        trial_end = datetime.fromtimestamp(trial_end_timestamp, tz=timezone.utc) if trial_end_timestamp else None
        
        # Determine billing cycle
        billing_cycle = "monthly"
        try:
            if (hasattr(stripe_sub, 'items') and 
                stripe_sub.items and 
                len(stripe_sub.items.data) > 0 and
                hasattr(stripe_sub.items.data[0], 'price') and
                hasattr(stripe_sub.items.data[0].price, 'recurring') and
                stripe_sub.items.data[0].price.recurring.interval == "year"):
                billing_cycle = "yearly"
        except (AttributeError, IndexError) as e:
            log_error("Could not determine billing cycle", error=str(e), subscription_id=subscription_id)
            # Default to monthly
        
        # Update or create subscription in database
        subscription_doc = {
            "tenant_id": tenant_id,
            "plan_id": plan_id,
            "plan_name": plan["name"],
            "status": "active",
            "billing_cycle": billing_cycle,
            "current_period_start": period_start.isoformat(),
            "current_period_end": period_end.isoformat(),
            "trial_end": trial_end.isoformat() if trial_end else None,
            "stripe_subscription_id": subscription_id,
            "stripe_customer_id": customer_id,
            "updated_at": now.isoformat()
        }
        
        result = await db.subscriptions.update_one(
            {"tenant_id": tenant_id},
            {"$set": subscription_doc, "$setOnInsert": {"created_at": now.isoformat()}},
            upsert=True
        )
        
        log_info(f"Subscription saved to database", tenant_id=tenant_id, matched_count=result.matched_count, modified_count=result.modified_count, upserted_id=result.upserted_id)
        
        return {
            "status": "active",
            "message": "Subscription activated successfully",
            "subscription": subscription_doc
        }
        
    except stripe.error.StripeError as e:
        log_error("Stripe error in verify-checkout", error=str(e), session_id=session_id, tenant_id=tenant_id)
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        log_error("Failed to verify checkout session", error=str(e), tenant_id=tenant_id, session_id=session_id)
        import traceback
        log_error("Traceback", traceback=traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to verify checkout session: {str(e)}")

@router.post("/subscribe")
async def create_subscription(
    subscription_data: SubscriptionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create or update subscription (initiates Stripe checkout)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get plan
    plan = await db.subscription_plans.find_one({"id": subscription_data.plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Check if free plan
    is_free = plan["price_monthly"] == 0
    
    if is_free:
        # Create free subscription immediately
        now = datetime.now(timezone.utc)
        subscription_id = str(uuid.uuid4())
        
        # Get trial days from settings
        platform_settings = await db.platform_settings.find_one({"key": "subscription_settings"}, {"_id": 0})
        trial_days = platform_settings.get("value", {}).get("trial_days", 30) if platform_settings else 30
        
        subscription = {
            "id": subscription_id,
            "tenant_id": tenant_id,
            "plan_id": plan["id"],
            "plan_name": plan["name"],
            "status": "active",
            "billing_cycle": subscription_data.billing_cycle,
            "current_period_start": now.isoformat(),
            "current_period_end": (now + timedelta(days=30)).isoformat(),
            "trial_end": (now + timedelta(days=trial_days)).isoformat(),
            "stripe_subscription_id": None,
            "stripe_customer_id": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        # Upsert subscription
        await db.subscriptions.update_one(
            {"tenant_id": tenant_id},
            {"$set": subscription},
            upsert=True
        )
        
        return {
            "message": "Subscribed to free plan successfully",
            "subscription": subscription
        }
    else:
        # Return info for Stripe checkout
        price = plan["price_yearly"] if subscription_data.billing_cycle == "yearly" else plan["price_monthly"]
        
        return {
            "message": "Ready for checkout",
            "requires_payment": True,
            "plan": plan,
            "price": price,
            "billing_cycle": subscription_data.billing_cycle
        }

@router.post("/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Cancel current subscription"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    subscription = await db.subscriptions.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # If has Stripe subscription, cancel it
    if subscription.get("stripe_subscription_id"):
        # TODO: Cancel Stripe subscription via API
        pass
    
    # Update status
    await db.subscriptions.update_one(
        {"tenant_id": tenant_id},
        {"$set": {
            "status": "canceled",
            "canceled_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Subscription canceled successfully"}

# ============== PLATFORM SETTINGS (Super Admin) ==============

@router.get("/settings/platform")
async def get_subscription_settings(current_user: dict = Depends(get_super_admin_user)):
    """Get platform subscription settings"""
    settings = await db.platform_settings.find_one({"key": "subscription_settings"}, {"_id": 0})
    
    if not settings:
        # Return defaults
        return {
            "trial_days": 30,
            "yearly_discount_percent": 20,
            "soft_limit_threshold": 90
        }
    
    return settings.get("value", {})

@router.put("/settings/platform")
async def update_subscription_settings(
    settings: Dict[str, Any],
    current_user: dict = Depends(get_super_admin_user)
):
    """Update platform subscription settings"""
    await db.platform_settings.update_one(
        {"key": "subscription_settings"},
        {"$set": {
            "key": "subscription_settings",
            "value": settings,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Settings updated successfully", "settings": settings}
