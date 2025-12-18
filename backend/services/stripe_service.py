"""
Stripe integration service for subscription management
"""
import stripe
import os
from typing import Dict, Any, Optional, List
from utils.logger import log_info, log_error
from middleware.database import db

# Initialize Stripe (will be overridden by database settings)
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

class StripeService:
    """Stripe API wrapper for subscription management"""
    
    @staticmethod
    async def initialize_from_db():
        """Load Stripe API key from database settings"""
        try:
            settings = await db.platform_settings.find_one({"key": "stripe_integration"})
            if settings and settings.get("value"):
                value = settings["value"]
                use_live = value.get("use_live_mode", False)
                
                if use_live:
                    secret_key = value.get("live_secret_key")
                else:
                    secret_key = value.get("test_secret_key")
                
                if secret_key:
                    stripe.api_key = secret_key
                    log_info(f"Stripe initialized from database ({'live' if use_live else 'test'} mode)")
                    return True
            
            # Fallback to env variable
            env_key = os.environ.get("STRIPE_SECRET_KEY", "")
            if env_key:
                stripe.api_key = env_key
                log_info("Stripe initialized from environment variable")
                return True
                
            return False
        except Exception as e:
            log_error("Failed to initialize Stripe from database", error=e)
            return False
    
    @staticmethod
    def is_configured() -> bool:
        """Check if Stripe is configured"""
        return bool(stripe.api_key and stripe.api_key != "")
    
    @staticmethod
    async def create_product(plan_id: str, name: str, description: str) -> Optional[str]:
        """
        Create a Stripe product
        Returns: product_id or None if Stripe not configured
        """
        if not StripeService.is_configured():
            log_info("Stripe not configured, skipping product creation")
            return None
        
        try:
            product = stripe.Product.create(
                name=name,
                description=description,
                metadata={"plan_id": plan_id}
            )
            log_info(f"Created Stripe product: {product.id}", plan_id=plan_id)
            return product.id
        except Exception as e:
            log_error(f"Failed to create Stripe product", error=e, plan_id=plan_id)
            return None
    
    @staticmethod
    async def update_product(product_id: str, name: str, description: str) -> bool:
        """Update a Stripe product"""
        if not StripeService.is_configured():
            return False
        
        try:
            stripe.Product.modify(
                product_id,
                name=name,
                description=description
            )
            log_info(f"Updated Stripe product: {product_id}")
            return True
        except Exception as e:
            log_error(f"Failed to update Stripe product", error=e, product_id=product_id)
            return False
    
    @staticmethod
    async def delete_product(product_id: str) -> bool:
        """Delete (archive) a Stripe product"""
        if not StripeService.is_configured():
            return False
        
        try:
            stripe.Product.modify(product_id, active=False)
            log_info(f"Archived Stripe product: {product_id}")
            return True
        except Exception as e:
            log_error(f"Failed to archive Stripe product", error=e, product_id=product_id)
            return False
    
    @staticmethod
    async def create_price(
        product_id: str,
        amount: float,
        interval: str,
        currency: str = "usd"
    ) -> Optional[str]:
        """
        Create a Stripe price
        Returns: price_id or None if Stripe not configured
        """
        if not StripeService.is_configured():
            return None
        
        try:
            # Convert amount to cents
            amount_cents = int(amount * 100)
            
            price = stripe.Price.create(
                product=product_id,
                unit_amount=amount_cents,
                currency=currency,
                recurring={"interval": interval}
            )
            log_info(f"Created Stripe price: {price.id}", product_id=product_id, amount=amount, interval=interval)
            return price.id
        except Exception as e:
            log_error(f"Failed to create Stripe price", error=e, product_id=product_id)
            return None
    
    @staticmethod
    async def create_customer(email: str, name: str, tenant_id: str) -> Optional[str]:
        """
        Create a Stripe customer
        Returns: customer_id or None
        """
        if not StripeService.is_configured():
            return None
        
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={"tenant_id": tenant_id}
            )
            log_info(f"Created Stripe customer: {customer.id}", tenant_id=tenant_id)
            return customer.id
        except Exception as e:
            log_error(f"Failed to create Stripe customer", error=e, tenant_id=tenant_id)
            return None
    
    @staticmethod
    async def create_checkout_session(
        customer_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        tenant_id: str,
        plan_id: str,
        trial_days: int = 0
    ) -> Optional[Dict[str, Any]]:
        """
        Create a Stripe checkout session
        Returns: {session_id, url} or None
        """
        if not StripeService.is_configured():
            return None
        
        try:
            session_params = {
                "customer": customer_id,
                "payment_method_types": ["card"],
                "line_items": [{
                    "price": price_id,
                    "quantity": 1
                }],
                "mode": "subscription",
                "success_url": success_url,
                "cancel_url": cancel_url,
                "metadata": {
                    "tenant_id": tenant_id,
                    "plan_id": plan_id
                }
            }
            
            # Add trial period if specified
            if trial_days > 0:
                session_params["subscription_data"] = {
                    "trial_period_days": trial_days
                }
            
            session = stripe.checkout.Session.create(**session_params)
            
            log_info(f"Created Stripe checkout session: {session.id}", tenant_id=tenant_id, plan_id=plan_id)
            return {
                "session_id": session.id,
                "url": session.url
            }
        except Exception as e:
            log_error(f"Failed to create Stripe checkout session", error=e, tenant_id=tenant_id)
            return None
    
    @staticmethod
    async def cancel_subscription(subscription_id: str) -> bool:
        """Cancel a Stripe subscription"""
        if not StripeService.is_configured():
            return False
        
        try:
            stripe.Subscription.delete(subscription_id)
            log_info(f"Canceled Stripe subscription: {subscription_id}")
            return True
        except Exception as e:
            log_error(f"Failed to cancel Stripe subscription", error=e, subscription_id=subscription_id)
            return False
    
    @staticmethod
    async def get_subscription(subscription_id: str) -> Optional[Dict[str, Any]]:
        """Get Stripe subscription details"""
        if not StripeService.is_configured():
            return None
        
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            return {
                "id": subscription.id,
                "status": subscription.status,
                "current_period_start": subscription.current_period_start,
                "current_period_end": subscription.current_period_end,
                "cancel_at_period_end": subscription.cancel_at_period_end,
                "trial_end": subscription.trial_end
            }
        except Exception as e:
            log_error(f"Failed to get Stripe subscription", error=e, subscription_id=subscription_id)
            return None
    
    @staticmethod
    async def create_portal_session(customer_id: str, return_url: str) -> Optional[str]:
        """
        Create a Stripe customer portal session
        Returns: portal URL or None
        """
        if not StripeService.is_configured():
            return None
        
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url
            )
            log_info(f"Created Stripe portal session", customer_id=customer_id)
            return session.url
        except Exception as e:
            log_error(f"Failed to create Stripe portal session", error=e, customer_id=customer_id)
            return None
    
    @staticmethod
    async def create_seat_checkout_session(
        customer_id: str,
        price_id: str,
        quantity: int,
        success_url: str,
        cancel_url: str,
        tenant_id: str,
        plan_name: str
    ) -> Optional[Dict[str, Any]]:
        """
        Create a Stripe checkout session for seat purchase (one-time payment)
        Returns: {session_id, url} or None
        """
        if not StripeService.is_configured():
            return None
        
        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                line_items=[{
                    "price": price_id,
                    "quantity": quantity
                }],
                mode="payment",  # One-time payment for seats
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={
                    "tenant_id": tenant_id,
                    "type": "seat_purchase",
                    "quantity": str(quantity),
                    "plan_name": plan_name
                }
            )
            
            log_info(f"Created seat checkout session: {session.id}", tenant_id=tenant_id, quantity=quantity)
            return {
                "session_id": session.id,
                "url": session.url
            }
        except Exception as e:
            log_error(f"Failed to create seat checkout session", error=e, tenant_id=tenant_id)
            return None
    
    @staticmethod
    async def create_one_time_price(
        product_id: str,
        amount: float,
        currency: str = "usd"
    ) -> Optional[str]:
        """
        Create a one-time Stripe price for seat purchases
        Returns: price_id or None
        """
        if not StripeService.is_configured():
            return None
        
        try:
            amount_cents = int(amount * 100)
            
            price = stripe.Price.create(
                product=product_id,
                unit_amount=amount_cents,
                currency=currency
            )
            log_info(f"Created Stripe one-time price: {price.id}", product_id=product_id, amount=amount)
            return price.id
        except Exception as e:
            log_error(f"Failed to create one-time price", error=e, product_id=product_id)
            return None
    
    @staticmethod
    async def get_checkout_session(session_id: str) -> Optional[Dict[str, Any]]:
        """Get Stripe checkout session details"""
        if not StripeService.is_configured():
            return None
        
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            return {
                "id": session.id,
                "payment_status": session.payment_status,
                "status": session.status,
                "customer": session.customer,
                "metadata": dict(session.metadata) if session.metadata else {},
                "amount_total": session.amount_total
            }
        except Exception as e:
            log_error(f"Failed to get checkout session", error=e, session_id=session_id)
            return None
    
    @staticmethod
    async def get_customer_invoices(customer_id: str, limit: int = 10) -> Optional[List[Dict[str, Any]]]:
        """
        Get invoices for a Stripe customer
        Returns: list of invoice dictionaries or None
        """
        if not StripeService.is_configured():
            return None
        
        if not customer_id:
            return []
        
        try:
            invoices = stripe.Invoice.list(
                customer=customer_id,
                limit=limit
            )
            
            invoice_list = []
            for invoice in invoices.data:
                invoice_list.append({
                    "id": invoice.id,
                    "number": invoice.number,
                    "amount_due": invoice.amount_due,
                    "amount_paid": invoice.amount_paid,
                    "currency": invoice.currency,
                    "status": invoice.status,  # draft, open, paid, uncollectible, void
                    "created": invoice.created,
                    "due_date": invoice.due_date,
                    "paid_at": invoice.status_transitions.paid_at if invoice.status_transitions else None,
                    "hosted_invoice_url": invoice.hosted_invoice_url,
                    "invoice_pdf": invoice.invoice_pdf,
                    "description": invoice.description or (
                        invoice.lines.data[0].description if invoice.lines and invoice.lines.data else None
                    )
                })
            
            log_info(f"Retrieved {len(invoice_list)} invoices for customer", customer_id=customer_id)
            return invoice_list
        except Exception as e:
            log_error(f"Failed to get customer invoices", error=e, customer_id=customer_id)
            return None
