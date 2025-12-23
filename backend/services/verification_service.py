"""
Verification Service - OTP-based identity verification for widget chat
Implements tiered verification: unverified users can ask general questions,
but must verify identity via email OTP to access sensitive information.
"""
import logging
import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple

from middleware.database import db
from services.email_service import EmailService

logger = logging.getLogger(__name__)

# OTP Configuration
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10
MAX_OTP_ATTEMPTS = 3
OTP_COOLDOWN_SECONDS = 60  # Minimum time between OTP requests

# Sensitive topics that require verification
SENSITIVE_TOPICS = [
    # Account-related
    "account", "balance", "payment", "billing", "invoice", "subscription",
    "password", "login", "credential", "security",
    # Order-related  
    "order", "purchase", "transaction", "refund", "shipping", "delivery",
    "tracking", "cancel order", "cancel subscription", "cancel my",
    # Personal data
    "my address", "phone number", "email change", "personal info", "profile", "my data",
    # Financial
    "credit", "debit", "bank", "card number", "wallet", "money", "fund"
]


class VerificationService:
    """Service for managing email-based OTP verification"""
    
    @staticmethod
    def generate_otp() -> str:
        """Generate a random 6-digit OTP code"""
        return ''.join(secrets.choice(string.digits) for _ in range(OTP_LENGTH))
    
    @staticmethod
    async def create_verification(
        conversation_id: str,
        email: str,
        tenant_id: str
    ) -> Tuple[bool, str]:
        """
        Create a new OTP verification request and send email
        
        Returns:
            Tuple of (success, message)
        """
        now = datetime.now(timezone.utc)
        
        # Check for cooldown - prevent OTP spam
        recent_code = await db.verification_codes.find_one({
            "conversation_id": conversation_id,
            "created_at": {"$gte": (now - timedelta(seconds=OTP_COOLDOWN_SECONDS)).isoformat()}
        })
        
        if recent_code:
            remaining = OTP_COOLDOWN_SECONDS - int((now - datetime.fromisoformat(recent_code["created_at"].replace('Z', '+00:00'))).total_seconds())
            return False, f"Please wait {remaining} seconds before requesting a new code."
        
        # Generate OTP
        otp_code = VerificationService.generate_otp()
        expiry = now + timedelta(minutes=OTP_EXPIRY_MINUTES)
        
        # Store verification record
        verification_doc = {
            "conversation_id": conversation_id,
            "tenant_id": tenant_id,
            "email": email.lower(),
            "code": otp_code,
            "attempts": 0,
            "verified": False,
            "created_at": now.isoformat(),
            "expires_at": expiry.isoformat()
        }
        
        # Upsert - replace any existing unverified code for this conversation
        await db.verification_codes.update_one(
            {"conversation_id": conversation_id, "verified": False},
            {"$set": verification_doc},
            upsert=True
        )
        
        # Send OTP email
        email_sent = await VerificationService._send_otp_email(email, otp_code, tenant_id)
        
        if email_sent:
            logger.info(f"OTP sent to {email} for conversation {conversation_id}")
            return True, f"A verification code has been sent to {email}. Please enter the 6-digit code."
        else:
            logger.error(f"Failed to send OTP to {email}")
            return False, "Failed to send verification email. Please try again."
    
    @staticmethod
    async def verify_otp(
        conversation_id: str,
        code: str
    ) -> Tuple[bool, str]:
        """
        Verify an OTP code
        
        Returns:
            Tuple of (success, message)
        """
        now = datetime.now(timezone.utc)
        
        # Find the verification record
        verification = await db.verification_codes.find_one({
            "conversation_id": conversation_id,
            "verified": False
        })
        
        if not verification:
            return False, "No verification in progress. Please request a new code."
        
        # Check expiry
        expires_at = datetime.fromisoformat(verification["expires_at"].replace('Z', '+00:00'))
        if now > expires_at:
            return False, "This code has expired. Please request a new one."
        
        # Check attempts
        if verification["attempts"] >= MAX_OTP_ATTEMPTS:
            return False, "Too many failed attempts. Please request a new code."
        
        # Verify code
        if verification["code"] != code:
            # Increment attempts
            await db.verification_codes.update_one(
                {"conversation_id": conversation_id, "verified": False},
                {"$inc": {"attempts": 1}}
            )
            remaining = MAX_OTP_ATTEMPTS - verification["attempts"] - 1
            return False, f"Invalid code. {remaining} attempts remaining."
        
        # Success! Mark as verified
        await db.verification_codes.update_one(
            {"conversation_id": conversation_id, "verified": False},
            {
                "$set": {
                    "verified": True,
                    "verified_at": now.isoformat()
                }
            }
        )
        
        # Update conversation to mark as verified
        await db.conversations.update_one(
            {"id": conversation_id},
            {
                "$set": {
                    "email_verified": True,
                    "email_verified_at": now.isoformat()
                }
            }
        )
        
        logger.info(f"Conversation {conversation_id} verified successfully")
        return True, "Email verified successfully! I can now help you with your account information."
    
    @staticmethod
    async def is_conversation_verified(conversation_id: str) -> bool:
        """Check if a conversation has been verified"""
        conversation = await db.conversations.find_one(
            {"id": conversation_id},
            {"_id": 0, "email_verified": 1}
        )
        return conversation.get("email_verified", False) if conversation else False
    
    @staticmethod
    async def get_verification_status(conversation_id: str) -> Dict[str, Any]:
        """Get detailed verification status for a conversation"""
        conversation = await db.conversations.find_one(
            {"id": conversation_id},
            {"_id": 0, "email_verified": 1, "email_verified_at": 1, "customer_email": 1}
        )
        
        if not conversation:
            return {"verified": False, "email": None}
        
        return {
            "verified": conversation.get("email_verified", False),
            "verified_at": conversation.get("email_verified_at"),
            "email": conversation.get("customer_email")
        }
    
    @staticmethod
    def requires_verification(message: str) -> bool:
        """
        Check if a message is asking about sensitive topics that require verification
        
        Args:
            message: The customer's message
            
        Returns:
            True if the message likely requires verification
        """
        message_lower = message.lower()
        
        # Check for sensitive topics
        for topic in SENSITIVE_TOPICS:
            if topic in message_lower:
                return True
        
        # Check for specific patterns
        sensitive_patterns = [
            "my order",
            "my account", 
            "my balance",
            "my payment",
            "my subscription",
            "my address",
            "my profile",
            "where is my",
            "status of my",
            "cancel my",
            "change my",
            "update my",
            "what did i",
            "show me my",
            "give me my"
        ]
        
        for pattern in sensitive_patterns:
            if pattern in message_lower:
                return True
        
        return False
    
    @staticmethod
    async def _send_otp_email(email: str, otp_code: str, tenant_id: str) -> bool:
        """Send OTP verification email using SendGrid"""
        # Get tenant/brand name for email
        settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
        brand_name = settings.get("brand_name", "Support") if settings else "Support"
        
        # Use email service with custom OTP template
        return await EmailService.send_email(
            to_email=email,
            template_key="otp_verification",
            variables={
                "otp_code": otp_code,
                "brand_name": brand_name,
                "expiry_minutes": str(OTP_EXPIRY_MINUTES)
            },
            fallback_subject=f"Your {brand_name} verification code: {otp_code}",
            fallback_content=f"""
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333; margin-bottom: 20px;">Verify your identity</h2>
                <p style="color: #666; margin-bottom: 20px;">
                    To access your account information, please enter this verification code in the chat:
                </p>
                <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">
                        {otp_code}
                    </span>
                </div>
                <p style="color: #999; font-size: 14px;">
                    This code expires in {OTP_EXPIRY_MINUTES} minutes.
                </p>
                <p style="color: #999; font-size: 14px;">
                    If you didn't request this code, you can safely ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px; text-align: center;">
                    Sent by {brand_name}
                </p>
            </div>
            """
        )


# AI Response modifiers for verification flow
VERIFICATION_REQUIRED_RESPONSE = """I'd be happy to help you with that! However, to protect your privacy and ensure I'm speaking with the account holder, I'll need to verify your identity first.

I've sent a **6-digit verification code** to your email address. Please enter the code here to continue.

💡 *This is a one-time verification for this chat session.*"""

VERIFICATION_NO_EMAIL_RESPONSE = """I'd be happy to help you with that! However, to access account-specific information, I need to verify your identity.

Please provide your email address and I'll send you a verification code."""

VERIFICATION_PROMPT_CODE = """Please enter the 6-digit verification code sent to your email, or type "resend" to get a new code."""


# Singleton instance
verification_service = VerificationService()
