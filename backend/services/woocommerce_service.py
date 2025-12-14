"""
WooCommerce REST API Service
Handles all WooCommerce operations for agents
"""
from typing import Dict, List, Optional, Any
from woocommerce import API
import logging
from cryptography.fernet import Fernet
import os
import base64

logger = logging.getLogger(__name__)

# Encryption key for storing sensitive credentials
# In production, this should be in environment variables
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


class WooCommerceService:
    """Service class for WooCommerce API interactions"""
    
    def __init__(self, store_url: str, consumer_key: str, consumer_secret: str):
        """
        Initialize WooCommerce API client
        
        Args:
            store_url: WooCommerce store URL (e.g., https://example.com)
            consumer_key: Consumer key from WooCommerce REST API settings
            consumer_secret: Consumer secret from WooCommerce REST API settings
        """
        self.store_url = store_url.rstrip('/')
        self.wcapi = API(
            url=self.store_url,
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            version="wc/v3",
            timeout=30
        )
    
    async def test_connection(self) -> Dict[str, Any]:
        """
        Test WooCommerce API connection
        
        Returns:
            Dict with success status and message
        """
        try:
            response = self.wcapi.get("system_status")
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "Successfully connected to WooCommerce"
                }
            else:
                return {
                    "success": False,
                    "message": f"Connection failed: {response.status_code}"
                }
        except Exception as e:
            logger.error(f"WooCommerce connection test failed: {str(e)}")
            return {
                "success": False,
                "message": f"Connection error: {str(e)}"
            }
    
    async def search_orders_by_email(self, email: str) -> List[Dict[str, Any]]:
        """
        Search for orders by customer email
        
        Args:
            email: Customer email address
            
        Returns:
            List of orders
        """
        try:
            response = self.wcapi.get("orders", params={"customer": email, "per_page": 50})
            if response.status_code == 200:
                orders = response.json()
                return [{
                    "id": order["id"],
                    "order_number": order["number"],
                    "status": order["status"],
                    "date_created": order["date_created"],
                    "total": order["total"],
                    "currency": order["currency"],
                    "payment_method": order.get("payment_method_title", "N/A"),
                    "billing": order["billing"],
                    "line_items": [
                        {
                            "name": item["name"],
                            "quantity": item["quantity"],
                            "total": item["total"]
                        } for item in order["line_items"]
                    ]
                } for order in orders]
            else:
                logger.error(f"Failed to search orders: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Error searching orders by email: {str(e)}")
            return []
    
    async def get_order_details(self, order_id: int) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific order
        
        Args:
            order_id: WooCommerce order ID
            
        Returns:
            Order details or None if not found
        """
        try:
            response = self.wcapi.get(f"orders/{order_id}")
            if response.status_code == 200:
                order = response.json()
                return {
                    "id": order["id"],
                    "order_number": order["number"],
                    "status": order["status"],
                    "date_created": order["date_created"],
                    "total": order["total"],
                    "currency": order["currency"],
                    "payment_method": order.get("payment_method_title", "N/A"),
                    "billing": order["billing"],
                    "shipping": order["shipping"],
                    "line_items": order["line_items"],
                    "shipping_lines": order["shipping_lines"],
                    "customer_note": order.get("customer_note", "")
                }
            else:
                logger.error(f"Order {order_id} not found: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Error getting order details: {str(e)}")
            return None
    
    async def create_refund(
        self, 
        order_id: int, 
        amount: Optional[str] = None,
        reason: str = "Customer request"
    ) -> Dict[str, Any]:
        """
        Create a refund for an order
        
        Args:
            order_id: WooCommerce order ID
            amount: Refund amount (if None, full refund)
            reason: Reason for refund
            
        Returns:
            Dict with success status and refund details
        """
        try:
            refund_data = {"reason": reason}
            if amount:
                refund_data["amount"] = amount
            
            response = self.wcapi.post(f"orders/{order_id}/refunds", refund_data)
            if response.status_code == 201:
                refund = response.json()
                return {
                    "success": True,
                    "refund_id": refund["id"],
                    "amount": refund["amount"],
                    "reason": refund["reason"],
                    "message": f"Refund of {refund['amount']} created successfully"
                }
            else:
                logger.error(f"Failed to create refund: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": f"Failed to create refund: {response.text}"
                }
        except Exception as e:
            logger.error(f"Error creating refund: {str(e)}")
            return {
                "success": False,
                "message": f"Error: {str(e)}"
            }
    
    async def update_order_status(self, order_id: int, status: str) -> Dict[str, Any]:
        """
        Update order status
        
        Args:
            order_id: WooCommerce order ID
            status: New status (processing, completed, cancelled, etc.)
            
        Returns:
            Dict with success status
        """
        try:
            response = self.wcapi.put(f"orders/{order_id}", {"status": status})
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": f"Order status updated to {status}"
                }
            else:
                return {
                    "success": False,
                    "message": f"Failed to update status: {response.text}"
                }
        except Exception as e:
            logger.error(f"Error updating order status: {str(e)}")
            return {
                "success": False,
                "message": f"Error: {str(e)}"
            }


def get_woocommerce_client(config: Dict[str, Any]) -> Optional[WooCommerceService]:
    """
    Create WooCommerce client from encrypted config
    
    Args:
        config: Agent config containing WooCommerce credentials
        
    Returns:
        WooCommerceService instance or None if not configured
    """
    try:
        wc_config = config.get("woocommerce", {})
        if not wc_config.get("enabled"):
            return None
        
        store_url = wc_config.get("store_url")
        consumer_key = decrypt_credential(wc_config.get("consumer_key_encrypted", ""))
        consumer_secret = decrypt_credential(wc_config.get("consumer_secret_encrypted", ""))
        
        if not all([store_url, consumer_key, consumer_secret]):
            return None
        
        return WooCommerceService(store_url, consumer_key, consumer_secret)
    except Exception as e:
        logger.error(f"Error creating WooCommerce client: {str(e)}")
        return None
