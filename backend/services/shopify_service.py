"""
Shopify REST API Service
Handles all Shopify operations for agents
"""
from typing import Dict, List, Optional, Any
import httpx
import logging
from cryptography.fernet import Fernet
import os

logger = logging.getLogger(__name__)

# Encryption key for storing sensitive credentials
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", Fernet.generate_key())
if isinstance(ENCRYPTION_KEY, str):
    ENCRYPTION_KEY = ENCRYPTION_KEY.encode()
cipher_suite = Fernet(ENCRYPTION_KEY)


def encrypt_credential(value: str) -> str:
    """Encrypt sensitive credential"""
    return cipher_suite.encrypt(value.encode()).decode()


def decrypt_credential(encrypted_value: str) -> str:
    """Decrypt sensitive credential"""
    return cipher_suite.decrypt(encrypted_value.encode()).decode()


class ShopifyService:
    """Service class for Shopify API interactions"""
    
    def __init__(self, store_domain: str, access_token: str, api_version: str = "2024-01"):
        """
        Initialize Shopify API client
        
        Args:
            store_domain: Shopify store domain (e.g., mystore.myshopify.com or mystore)
            access_token: Admin API access token
            api_version: Shopify API version (default: 2024-01)
        """
        # Normalize store domain
        self.store_domain = store_domain.replace("https://", "").replace("http://", "")
        if not self.store_domain.endswith(".myshopify.com"):
            self.store_domain = f"{self.store_domain}.myshopify.com"
        
        self.access_token = access_token
        self.api_version = api_version
        self.base_url = f"https://{self.store_domain}/admin/api/{api_version}"
        
        self.headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json"
        }
    
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        params: Dict = None, 
        json_data: Dict = None
    ) -> Dict[str, Any]:
        """Make HTTP request to Shopify API"""
        url = f"{self.base_url}/{endpoint}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=self.headers,
                params=params,
                json=json_data
            )
            
            if response.status_code == 429:
                # Rate limited
                retry_after = response.headers.get("Retry-After", 5)
                raise Exception(f"Rate limited. Retry after {retry_after} seconds")
            
            response.raise_for_status()
            return response.json()
    
    async def test_connection(self) -> Dict[str, Any]:
        """
        Test Shopify API connection
        
        Returns:
            Dict with success status and message
        """
        try:
            result = await self._make_request("GET", "shop.json")
            shop = result.get("shop", {})
            return {
                "success": True,
                "message": f"Successfully connected to {shop.get('name', 'Shopify store')}",
                "shop_name": shop.get("name"),
                "shop_email": shop.get("email"),
                "shop_domain": shop.get("domain")
            }
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                return {
                    "success": False,
                    "message": "Invalid access token. Please check your credentials."
                }
            return {
                "success": False,
                "message": f"Connection failed: {e.response.status_code}"
            }
        except Exception as e:
            logger.error(f"Shopify connection test failed: {str(e)}")
            return {
                "success": False,
                "message": f"Connection error: {str(e)}"
            }
    
    async def search_orders_by_email(self, email: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Search for orders by customer email
        
        Args:
            email: Customer email address
            limit: Maximum number of orders to return
            
        Returns:
            List of orders
        """
        try:
            result = await self._make_request(
                "GET", 
                "orders.json",
                params={
                    "email": email,
                    "status": "any",
                    "limit": limit
                }
            )
            
            orders = result.get("orders", [])
            return [{
                "id": order["id"],
                "order_number": order.get("order_number") or order.get("name", "").replace("#", ""),
                "name": order.get("name", f"#{order['id']}"),
                "status": order.get("fulfillment_status") or "unfulfilled",
                "financial_status": order.get("financial_status", "pending"),
                "date_created": order.get("created_at"),
                "total": order.get("total_price"),
                "currency": order.get("currency"),
                "payment_status": order.get("financial_status", "N/A"),
                "customer": {
                    "email": order.get("email"),
                    "name": f"{order.get('customer', {}).get('first_name', '')} {order.get('customer', {}).get('last_name', '')}".strip()
                },
                "line_items": [
                    {
                        "name": item.get("name"),
                        "quantity": item.get("quantity"),
                        "price": item.get("price"),
                        "sku": item.get("sku")
                    } for item in order.get("line_items", [])
                ],
                "shipping_address": order.get("shipping_address"),
                "fulfillments": [
                    {
                        "status": f.get("status"),
                        "tracking_number": f.get("tracking_number"),
                        "tracking_url": f.get("tracking_url")
                    } for f in order.get("fulfillments", [])
                ]
            } for order in orders]
        except Exception as e:
            logger.error(f"Error searching orders by email: {str(e)}")
            return []
    
    async def get_order_details(self, order_id: int) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific order
        
        Args:
            order_id: Shopify order ID
            
        Returns:
            Order details or None if not found
        """
        try:
            result = await self._make_request("GET", f"orders/{order_id}.json")
            order = result.get("order")
            
            if not order:
                return None
            
            return {
                "id": order["id"],
                "order_number": order.get("order_number") or order.get("name", "").replace("#", ""),
                "name": order.get("name", f"#{order['id']}"),
                "status": order.get("fulfillment_status") or "unfulfilled",
                "financial_status": order.get("financial_status", "pending"),
                "date_created": order.get("created_at"),
                "date_updated": order.get("updated_at"),
                "total": order.get("total_price"),
                "subtotal": order.get("subtotal_price"),
                "total_tax": order.get("total_tax"),
                "total_discounts": order.get("total_discounts"),
                "currency": order.get("currency"),
                "customer": {
                    "id": order.get("customer", {}).get("id"),
                    "email": order.get("email"),
                    "name": f"{order.get('customer', {}).get('first_name', '')} {order.get('customer', {}).get('last_name', '')}".strip(),
                    "phone": order.get("customer", {}).get("phone")
                },
                "billing_address": order.get("billing_address"),
                "shipping_address": order.get("shipping_address"),
                "line_items": order.get("line_items", []),
                "shipping_lines": order.get("shipping_lines", []),
                "fulfillments": order.get("fulfillments", []),
                "refunds": order.get("refunds", []),
                "note": order.get("note"),
                "tags": order.get("tags", "").split(", ") if order.get("tags") else [],
                "cancel_reason": order.get("cancel_reason"),
                "cancelled_at": order.get("cancelled_at")
            }
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise
        except Exception as e:
            logger.error(f"Error getting order details: {str(e)}")
            return None
    
    async def create_refund(
        self, 
        order_id: int, 
        amount: Optional[str] = None,
        reason: str = "Customer request",
        notify_customer: bool = True
    ) -> Dict[str, Any]:
        """
        Create a refund for an order
        
        Args:
            order_id: Shopify order ID
            amount: Refund amount (if None, calculates full refund)
            reason: Reason for refund
            notify_customer: Whether to notify customer via email
            
        Returns:
            Dict with success status and refund details
        """
        try:
            # First, calculate the refund
            calculate_result = await self._make_request(
                "POST",
                f"orders/{order_id}/refunds/calculate.json",
                json_data={
                    "refund": {
                        "currency": "USD",
                        "shipping": {"full_refund": True} if not amount else {}
                    }
                }
            )
            
            refund_data = {
                "refund": {
                    "notify": notify_customer,
                    "note": reason,
                    "shipping": {"full_refund": True} if not amount else {},
                    "transactions": calculate_result.get("refund", {}).get("transactions", [])
                }
            }
            
            # If specific amount, adjust
            if amount:
                refund_data["refund"]["transactions"] = [{
                    "parent_id": calculate_result.get("refund", {}).get("transactions", [{}])[0].get("parent_id"),
                    "amount": amount,
                    "kind": "refund",
                    "gateway": calculate_result.get("refund", {}).get("transactions", [{}])[0].get("gateway")
                }]
            
            result = await self._make_request(
                "POST",
                f"orders/{order_id}/refunds.json",
                json_data=refund_data
            )
            
            refund = result.get("refund", {})
            total_refunded = sum(float(t.get("amount", 0)) for t in refund.get("transactions", []))
            
            return {
                "success": True,
                "refund_id": refund.get("id"),
                "amount": str(total_refunded),
                "reason": reason,
                "message": f"Refund of {total_refunded} {refund.get('currency', 'USD')} created successfully"
            }
        except httpx.HTTPStatusError as e:
            error_msg = "Unknown error"
            try:
                error_data = e.response.json()
                error_msg = error_data.get("errors", str(e))
            except Exception:
                error_msg = str(e)
            
            logger.error(f"Failed to create refund: {error_msg}")
            return {
                "success": False,
                "message": f"Failed to create refund: {error_msg}"
            }
        except Exception as e:
            logger.error(f"Error creating refund: {str(e)}")
            return {
                "success": False,
                "message": f"Error: {str(e)}"
            }
    
    async def cancel_order(
        self, 
        order_id: int, 
        reason: str = "customer",
        email: bool = True,
        restock: bool = True
    ) -> Dict[str, Any]:
        """
        Cancel an order
        
        Args:
            order_id: Shopify order ID
            reason: Cancel reason (customer, inventory, fraud, declined, other)
            email: Send cancellation email to customer
            restock: Restock inventory
            
        Returns:
            Dict with success status
        """
        try:
            result = await self._make_request(
                "POST",
                f"orders/{order_id}/cancel.json",
                json_data={
                    "reason": reason,
                    "email": email,
                    "restock": restock
                }
            )
            
            return {
                "success": True,
                "message": "Order cancelled successfully",
                "order": result.get("order", {})
            }
        except httpx.HTTPStatusError as e:
            error_msg = str(e)
            try:
                error_data = e.response.json()
                error_msg = error_data.get("errors", str(e))
            except Exception:
                pass
            return {
                "success": False,
                "message": f"Failed to cancel order: {error_msg}"
            }
        except Exception as e:
            logger.error(f"Error cancelling order: {str(e)}")
            return {
                "success": False,
                "message": f"Error: {str(e)}"
            }
    
    async def update_order_note(self, order_id: int, note: str) -> Dict[str, Any]:
        """
        Update order note/memo
        
        Args:
            order_id: Shopify order ID
            note: New note content
            
        Returns:
            Dict with success status
        """
        try:
            await self._make_request(
                "PUT",
                f"orders/{order_id}.json",
                json_data={
                    "order": {
                        "id": order_id,
                        "note": note
                    }
                }
            )
            
            return {
                "success": True,
                "message": "Order note updated successfully"
            }
        except Exception as e:
            logger.error(f"Error updating order note: {str(e)}")
            return {
                "success": False,
                "message": f"Error: {str(e)}"
            }
    
    async def get_customer_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Get customer details by email
        
        Args:
            email: Customer email
            
        Returns:
            Customer details or None
        """
        try:
            result = await self._make_request(
                "GET",
                "customers/search.json",
                params={"query": f"email:{email}"}
            )
            
            customers = result.get("customers", [])
            if not customers:
                return None
            
            customer = customers[0]
            return {
                "id": customer.get("id"),
                "email": customer.get("email"),
                "first_name": customer.get("first_name"),
                "last_name": customer.get("last_name"),
                "phone": customer.get("phone"),
                "orders_count": customer.get("orders_count", 0),
                "total_spent": customer.get("total_spent", "0.00"),
                "created_at": customer.get("created_at"),
                "tags": customer.get("tags", "").split(", ") if customer.get("tags") else [],
                "addresses": customer.get("addresses", [])
            }
        except Exception as e:
            logger.error(f"Error getting customer: {str(e)}")
            return None


def get_shopify_client(config: Dict[str, Any]) -> Optional[ShopifyService]:
    """
    Create Shopify client from encrypted config
    
    Args:
        config: Agent config containing Shopify credentials
        
    Returns:
        ShopifyService instance or None if not configured
    """
    try:
        shopify_config = config.get("shopify", {})
        if not shopify_config.get("enabled"):
            return None
        
        store_domain = shopify_config.get("store_domain")
        access_token = decrypt_credential(shopify_config.get("access_token_encrypted", ""))
        
        if not all([store_domain, access_token]):
            return None
        
        return ShopifyService(store_domain, access_token)
    except Exception as e:
        logger.error(f"Error creating Shopify client: {str(e)}")
        return None
