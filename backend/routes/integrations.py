"""
Integrations management routes (Super Admin only)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import os
import logging

from middleware import get_super_admin_user
from middleware.database import db

router = APIRouter(prefix="/admin/integrations", tags=["integrations"])
logger = logging.getLogger(__name__)

# Models
class StripeSettingsUpdate(BaseModel):
    use_live_mode: Optional[bool] = None
    test_publishable_key: Optional[str] = None
    test_secret_key: Optional[str] = None
    test_webhook_secret: Optional[str] = None
    live_publishable_key: Optional[str] = None
    live_secret_key: Optional[str] = None
    live_webhook_secret: Optional[str] = None

class CodeInjectionUpdate(BaseModel):
    head_code: Optional[str] = None
    body_start_code: Optional[str] = None
    body_end_code: Optional[str] = None

class SendGridSettingsUpdate(BaseModel):
    api_key: Optional[str] = None
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None
    is_enabled: Optional[bool] = None

class SendGridTestEmail(BaseModel):
    to_email: str
    subject: Optional[str] = "Test Email from Platform"
    content: Optional[str] = "This is a test email to verify your SendGrid integration is working correctly."

# Helper to mask sensitive keys
def mask_key(key: str) -> str:
    if not key or len(key) < 8:
        return "••••••••"
    return f"{key[:4]}••••{key[-4:]}"

@router.get("")
async def get_integration_settings(admin_user: dict = Depends(get_super_admin_user)):
    """Get all integration settings (Super Admin only)"""
    
    # Get Stripe settings
    stripe_settings = await db.platform_settings.find_one(
        {"key": "stripe_integration"}, 
        {"_id": 0}
    )
    
    stripe_data = {
        "use_live_mode": False,
        "test_publishable_key": "",
        "test_secret_key_set": False,
        "test_webhook_secret_set": False,
        "live_publishable_key": "",
        "live_secret_key_set": False,
        "live_webhook_secret_set": False
    }
    
    if stripe_settings and stripe_settings.get("value"):
        value = stripe_settings["value"]
        stripe_data = {
            "use_live_mode": value.get("use_live_mode", False),
            "test_publishable_key": value.get("test_publishable_key", ""),
            "test_secret_key_set": bool(value.get("test_secret_key")),
            "test_webhook_secret_set": bool(value.get("test_webhook_secret")),
            "live_publishable_key": value.get("live_publishable_key", ""),
            "live_secret_key_set": bool(value.get("live_secret_key")),
            "live_webhook_secret_set": bool(value.get("live_webhook_secret"))
        }
    
    # Get code injection settings
    code_settings = await db.platform_settings.find_one(
        {"key": "code_injection"},
        {"_id": 0}
    )
    
    code_data = {
        "head_code": "",
        "body_start_code": "",
        "body_end_code": ""
    }
    
    if code_settings and code_settings.get("value"):
        code_data = code_settings["value"]
    
    return {
        "stripe": stripe_data,
        "code_injection": code_data
    }

@router.put("/stripe")
async def update_stripe_settings(
    settings: StripeSettingsUpdate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Update Stripe integration settings (Super Admin only)"""
    
    # Get existing settings
    existing = await db.platform_settings.find_one(
        {"key": "stripe_integration"},
        {"_id": 0}
    )
    
    current_value = existing.get("value", {}) if existing else {}
    
    # Update only provided fields
    update_data = {}
    
    if settings.use_live_mode is not None:
        update_data["use_live_mode"] = settings.use_live_mode
    
    if settings.test_publishable_key is not None:
        update_data["test_publishable_key"] = settings.test_publishable_key
    
    if settings.test_secret_key is not None and settings.test_secret_key:
        update_data["test_secret_key"] = settings.test_secret_key
    
    if settings.test_webhook_secret is not None and settings.test_webhook_secret:
        update_data["test_webhook_secret"] = settings.test_webhook_secret
    
    if settings.live_publishable_key is not None:
        update_data["live_publishable_key"] = settings.live_publishable_key
    
    if settings.live_secret_key is not None and settings.live_secret_key:
        update_data["live_secret_key"] = settings.live_secret_key
    
    if settings.live_webhook_secret is not None and settings.live_webhook_secret:
        update_data["live_webhook_secret"] = settings.live_webhook_secret
    
    # Merge with existing
    merged = {**current_value, **update_data}
    merged["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.platform_settings.update_one(
        {"key": "stripe_integration"},
        {"$set": {"key": "stripe_integration", "value": merged}},
        upsert=True
    )
    
    # Also update the environment variables dynamically (for current session)
    # Note: This doesn't persist across restarts - use .env for that
    if settings.use_live_mode:
        if merged.get("live_secret_key"):
            os.environ["STRIPE_SECRET_KEY"] = merged["live_secret_key"]
        if merged.get("live_webhook_secret"):
            os.environ["STRIPE_WEBHOOK_SECRET"] = merged["live_webhook_secret"]
    else:
        if merged.get("test_secret_key"):
            os.environ["STRIPE_SECRET_KEY"] = merged["test_secret_key"]
        if merged.get("test_webhook_secret"):
            os.environ["STRIPE_WEBHOOK_SECRET"] = merged["test_webhook_secret"]
    
    return {"message": "Stripe settings updated successfully"}

@router.put("/code-injection")
async def update_code_injection(
    settings: CodeInjectionUpdate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Update code injection settings (Super Admin only)"""
    
    # Get existing settings
    existing = await db.platform_settings.find_one(
        {"key": "code_injection"},
        {"_id": 0}
    )
    
    current_value = existing.get("value", {}) if existing else {}
    
    # Update only provided fields
    update_data = {}
    
    if settings.head_code is not None:
        update_data["head_code"] = settings.head_code
    
    if settings.body_start_code is not None:
        update_data["body_start_code"] = settings.body_start_code
    
    if settings.body_end_code is not None:
        update_data["body_end_code"] = settings.body_end_code
    
    # Merge with existing
    merged = {**current_value, **update_data}
    merged["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.platform_settings.update_one(
        {"key": "code_injection"},
        {"$set": {"key": "code_injection", "value": merged}},
        upsert=True
    )
    
    return {"message": "Code injection settings updated successfully"}

@router.get("/code-injection/public")
async def get_public_code_injection():
    """Get code injection for public pages (no auth required)"""
    
    code_settings = await db.platform_settings.find_one(
        {"key": "code_injection"},
        {"_id": 0}
    )
    
    if not code_settings or not code_settings.get("value"):
        return {
            "head_code": "",
            "body_start_code": "",
            "body_end_code": ""
        }
    
    return code_settings["value"]

@router.post("/stripe/test-connection")
async def test_stripe_connection(admin_user: dict = Depends(get_super_admin_user)):
    """Test Stripe API connection (Super Admin only)"""
    import stripe
    
    # Get Stripe settings
    stripe_settings = await db.platform_settings.find_one({"key": "stripe_integration"})
    
    if not stripe_settings or not stripe_settings.get("value"):
        raise HTTPException(status_code=400, detail="Stripe not configured")
    
    settings_value = stripe_settings["value"]
    use_live = settings_value.get("use_live_mode", False)
    
    # Get the appropriate secret key
    if use_live:
        secret_key = settings_value.get("live_secret_key")
        mode = "live"
    else:
        secret_key = settings_value.get("test_secret_key")
        mode = "test"
    
    if not secret_key:
        raise HTTPException(
            status_code=400, 
            detail=f"Stripe {mode} secret key not configured"
        )
    
    try:
        # Test the connection by retrieving account info
        stripe.api_key = secret_key
        account = stripe.Account.retrieve()
        
        return {
            "message": f"Successfully connected to Stripe ({mode} mode)",
            "details": {
                "account_id": account.id,
                "mode": mode,
                "country": account.country,
                "email": account.email
            }
        }
    except stripe.error.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid Stripe API key")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe connection failed: {str(e)}")

@router.post("/stripe/sync-to-stripe")
async def sync_plans_to_stripe(admin_user: dict = Depends(get_super_admin_user)):
    """Sync subscription plans from database to Stripe (Super Admin only)"""
    import stripe
    
    # Get Stripe settings
    stripe_settings = await db.platform_settings.find_one({"key": "stripe_integration"})
    
    if not stripe_settings or not stripe_settings.get("value"):
        raise HTTPException(status_code=400, detail="Stripe not configured")
    
    settings_value = stripe_settings["value"]
    use_live = settings_value.get("use_live_mode", False)
    secret_key = settings_value.get("live_secret_key" if use_live else "test_secret_key")
    
    if not secret_key:
        mode = "live" if use_live else "test"
        raise HTTPException(status_code=400, detail=f"Stripe {mode} secret key not configured")
    
    stripe.api_key = secret_key
    
    # Get all plans from database
    plans = await db.subscription_plans.find({}, {"_id": 0}).to_list(1000)
    
    if not plans:
        raise HTTPException(status_code=404, detail="No subscription plans found in database")
    
    synced_count = 0
    errors = []
    
    for plan in plans:
        try:
            plan_name = plan.get("name", "Unknown")
            
            # Check if product already exists in Stripe
            product_id = plan.get("stripe_product_id")
            
            if product_id:
                # Update existing product
                try:
                    stripe.Product.modify(
                        product_id,
                        name=plan_name,
                        description=plan.get("description", ""),
                        metadata={"plan_id": plan.get("id")}
                    )
                except stripe.error.InvalidRequestError:
                    # Product doesn't exist, create new one
                    product_id = None
            
            if not product_id:
                # Create new product
                product = stripe.Product.create(
                    name=plan_name,
                    description=plan.get("description", ""),
                    metadata={"plan_id": plan.get("id")}
                )
                product_id = product.id
                
                # Save product ID to database
                await db.subscription_plans.update_one(
                    {"id": plan.get("id")},
                    {"$set": {"stripe_product_id": product_id}}
                )
            
            # Create or update prices
            price_monthly = plan.get("price_monthly", 0)
            price_yearly = plan.get("price_yearly", 0)
            
            # Monthly price
            if price_monthly > 0:
                price_monthly_id = plan.get("stripe_price_monthly_id")
                if not price_monthly_id:
                    price = stripe.Price.create(
                        product=product_id,
                        unit_amount=int(price_monthly * 100),  # Convert to cents
                        currency="usd",
                        recurring={"interval": "month"},
                        metadata={"plan_id": plan.get("id"), "interval": "monthly"}
                    )
                    await db.subscription_plans.update_one(
                        {"id": plan.get("id")},
                        {"$set": {"stripe_price_monthly_id": price.id}}
                    )
            
            # Yearly price
            if price_yearly > 0:
                price_yearly_id = plan.get("stripe_price_yearly_id")
                if not price_yearly_id:
                    price = stripe.Price.create(
                        product=product_id,
                        unit_amount=int(price_yearly * 100),  # Convert to cents
                        currency="usd",
                        recurring={"interval": "year"},
                        metadata={"plan_id": plan.get("id"), "interval": "yearly"}
                    )
                    await db.subscription_plans.update_one(
                        {"id": plan.get("id")},
                        {"$set": {"stripe_price_yearly_id": price.id}}
                    )
            
            synced_count += 1
            
        except Exception as e:
            errors.append(f"{plan.get('name', 'Unknown')}: {str(e)}")
    
    result = {
        "message": f"Successfully synced {synced_count} plan(s) to Stripe",
        "synced_count": synced_count
    }
    
    if errors:
        result["errors"] = errors
    
    return result

@router.post("/stripe/sync-from-stripe")
async def sync_plans_from_stripe(admin_user: dict = Depends(get_super_admin_user)):
    """Sync subscription plans from Stripe to database (Super Admin only)"""
    import stripe
    
    # Get Stripe settings
    stripe_settings = await db.platform_settings.find_one({"key": "stripe_integration"})
    
    if not stripe_settings or not stripe_settings.get("value"):
        raise HTTPException(status_code=400, detail="Stripe not configured")
    
    settings_value = stripe_settings["value"]
    use_live = settings_value.get("use_live_mode", False)
    secret_key = settings_value.get("live_secret_key" if use_live else "test_secret_key")
    
    if not secret_key:
        mode = "live" if use_live else "test"
        raise HTTPException(status_code=400, detail=f"Stripe {mode} secret key not configured")
    
    stripe.api_key = secret_key
    
    try:
        # Get all products from Stripe
        products = stripe.Product.list(active=True, limit=100)
        
        synced_count = 0
        
        for product in products.data:
            # Get prices for this product
            prices = stripe.Price.list(product=product.id, active=True, limit=10)
            
            monthly_price = None
            yearly_price = None
            
            for price in prices.data:
                if price.recurring:
                    if price.recurring.interval == "month":
                        monthly_price = price.unit_amount / 100  # Convert from cents
                    elif price.recurring.interval == "year":
                        yearly_price = price.unit_amount / 100
            
            # Check if plan exists in database by stripe_product_id
            existing_plan = await db.subscription_plans.find_one(
                {"stripe_product_id": product.id},
                {"_id": 0}
            )
            
            plan_data = {
                "name": product.name,
                "description": product.description or "",
                "stripe_product_id": product.id,
                "price_monthly": monthly_price or 0,
                "price_yearly": yearly_price or 0,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if prices.data:
                # Store price IDs
                for price in prices.data:
                    if price.recurring:
                        if price.recurring.interval == "month":
                            plan_data["stripe_price_monthly_id"] = price.id
                        elif price.recurring.interval == "year":
                            plan_data["stripe_price_yearly_id"] = price.id
            
            if existing_plan:
                # Update existing plan
                await db.subscription_plans.update_one(
                    {"stripe_product_id": product.id},
                    {"$set": plan_data}
                )
            else:
                # Create new plan
                from uuid import uuid4
                plan_data["id"] = str(uuid4())
                plan_data["created_at"] = datetime.now(timezone.utc).isoformat()
                await db.subscription_plans.insert_one(plan_data)
            
            synced_count += 1
        
        return {
            "message": f"Successfully synced {synced_count} plan(s) from Stripe",
            "synced_count": synced_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync from Stripe: {str(e)}")
