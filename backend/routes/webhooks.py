"""
Webhook handlers for external services (Stripe, etc.)
"""
from fastapi import APIRouter, HTTPException, Request, Header
from typing import Optional
import stripe
import os
from datetime import datetime, timezone, timedelta

from middleware.database import db
from utils.logger import log_info, log_error

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/stripe")
async def stripe_webhook(request: Request, stripe_signature: Optional[str] = Header(None)):
    """Handle Stripe webhook events"""
    
    # Initialize Stripe API key from database
    try:
        settings = await db.platform_settings.find_one({"key": "stripe_integration"})
        if settings and settings.get("value"):
            value = settings["value"]
            use_live = value.get("use_live_mode", False)
            secret_key = value.get("live_secret_key" if use_live else "test_secret_key")
            if secret_key:
                stripe.api_key = secret_key
            
            # Get webhook secret from database
            if use_live:
                webhook_secret = value.get("live_webhook_secret", "")
            else:
                webhook_secret = value.get("test_webhook_secret", "")
        else:
            webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    except Exception as e:
        log_error("Failed to load Stripe settings from database", error=e)
        webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    
    if not webhook_secret:
        log_info("Stripe webhook secret not configured, processing without verification")
    
    # Get raw body
    payload = await request.body()
    
    try:
        if webhook_secret and stripe_signature:
            # Verify webhook signature
            event = stripe.Webhook.construct_event(
                payload, stripe_signature, webhook_secret
            )
        else:
            # Parse event without verification (development only)
            import json
            event = json.loads(payload)
        
        event_type = event["type"]
        log_info(f"Received Stripe webhook: {event_type}")
        
        # Handle different event types
        if event_type == "checkout.session.completed":
            await handle_checkout_completed(event["data"]["object"])
        
        elif event_type == "customer.subscription.updated":
            await handle_subscription_updated(event["data"]["object"])
        
        elif event_type == "customer.subscription.deleted":
            await handle_subscription_deleted(event["data"]["object"])
        
        elif event_type == "invoice.payment_succeeded":
            await handle_payment_succeeded(event["data"]["object"])
        
        elif event_type == "invoice.payment_failed":
            await handle_payment_failed(event["data"]["object"])
        
        return {"status": "success"}
    
    except stripe.error.SignatureVerificationError as e:
        log_error("Stripe signature verification failed", error=e)
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        log_error("Stripe webhook processing failed", error=e)
        raise HTTPException(status_code=400, detail=str(e))

async def handle_checkout_completed(session):
    """Handle successful checkout"""
    tenant_id = session["metadata"].get("tenant_id")
    plan_id = session["metadata"].get("plan_id")
    
    if not tenant_id or not plan_id:
        log_error("Missing metadata in checkout session", session_id=session["id"])
        return
    
    subscription_id = session.get("subscription")
    customer_id = session.get("customer")
    
    # Get plan details
    plan = await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        log_error("Plan not found", plan_id=plan_id)
        return
    
    # Get subscription details from Stripe
    try:
        stripe_sub = stripe.Subscription.retrieve(subscription_id)
        
        now = datetime.now(timezone.utc)
        period_start = datetime.fromtimestamp(stripe_sub.current_period_start, tz=timezone.utc)
        period_end = datetime.fromtimestamp(stripe_sub.current_period_end, tz=timezone.utc)
        trial_end = datetime.fromtimestamp(stripe_sub.trial_end, tz=timezone.utc) if stripe_sub.trial_end else None
        
        # Determine billing cycle from price
        billing_cycle = "monthly"
        if stripe_sub.items.data[0].price.recurring.interval == "year":
            billing_cycle = "yearly"
        
        # Update or create subscription
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
        
        await db.subscriptions.update_one(
            {"tenant_id": tenant_id},
            {"$set": subscription_doc, "$setOnInsert": {"created_at": now.isoformat()}},
            upsert=True
        )
        
        log_info("Subscription activated", tenant_id=tenant_id, plan_id=plan_id)
    
    except Exception as e:
        log_error("Failed to process checkout completion", error=e, tenant_id=tenant_id)

async def handle_subscription_updated(subscription):
    """Handle subscription update"""
    # Find subscription by Stripe subscription ID
    db_subscription = await db.subscriptions.find_one(
        {"stripe_subscription_id": subscription["id"]},
        {"_id": 0}
    )
    
    if not db_subscription:
        log_error("Subscription not found", stripe_subscription_id=subscription["id"])
        return
    
    # Update subscription details
    period_start = datetime.fromtimestamp(subscription["current_period_start"], tz=timezone.utc)
    period_end = datetime.fromtimestamp(subscription["current_period_end"], tz=timezone.utc)
    
    await db.subscriptions.update_one(
        {"stripe_subscription_id": subscription["id"]},
        {"$set": {
            "status": subscription["status"],
            "current_period_start": period_start.isoformat(),
            "current_period_end": period_end.isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    log_info("Subscription updated", tenant_id=db_subscription["tenant_id"])

async def handle_subscription_deleted(subscription):
    """Handle subscription cancellation"""
    db_subscription = await db.subscriptions.find_one(
        {"stripe_subscription_id": subscription["id"]},
        {"_id": 0}
    )
    
    if not db_subscription:
        log_error("Subscription not found", stripe_subscription_id=subscription["id"])
        return
    
    # Get free plan
    free_plan = await db.subscription_plans.find_one(
        {"name": "Free", "price_monthly": 0},
        {"_id": 0}
    )
    
    if free_plan:
        # Downgrade to free plan
        now = datetime.now(timezone.utc)
        await db.subscriptions.update_one(
            {"stripe_subscription_id": subscription["id"]},
            {"$set": {
                "plan_id": free_plan["id"],
                "plan_name": free_plan["name"],
                "status": "active",
                "billing_cycle": "monthly",
                "current_period_start": now.isoformat(),
                "current_period_end": (now + timedelta(days=30)).isoformat(),
                "stripe_subscription_id": None,
                "updated_at": now.isoformat()
            }}
        )
        log_info("Subscription downgraded to free", tenant_id=db_subscription["tenant_id"])
    else:
        # Just mark as canceled
        await db.subscriptions.update_one(
            {"stripe_subscription_id": subscription["id"]},
            {"$set": {
                "status": "canceled",
                "canceled_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        log_info("Subscription canceled", tenant_id=db_subscription["tenant_id"])

async def handle_payment_succeeded(invoice):
    """Handle successful payment"""
    subscription_id = invoice.get("subscription")
    
    if subscription_id:
        db_subscription = await db.subscriptions.find_one(
            {"stripe_subscription_id": subscription_id},
            {"_id": 0}
        )
        
        if db_subscription:
            log_info("Payment succeeded", tenant_id=db_subscription["tenant_id"], amount=invoice["amount_paid"])

async def handle_payment_failed(invoice):
    """Handle failed payment"""
    subscription_id = invoice.get("subscription")
    
    if subscription_id:
        db_subscription = await db.subscriptions.find_one(
            {"stripe_subscription_id": subscription_id},
            {"_id": 0}
        )
        
        if db_subscription:
            # Update status to past_due
            await db.subscriptions.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": {
                    "status": "past_due",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            log_error("Payment failed", tenant_id=db_subscription["tenant_id"])
