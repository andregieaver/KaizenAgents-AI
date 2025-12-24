"""
Email Service - Centralized email sending using templates
"""
import logging
import os
from typing import Dict, Any, Optional
from datetime import datetime

from middleware.database import db

logger = logging.getLogger(__name__)


class EmailService:
    """Centralized email service using database templates and SendGrid"""
    
    @staticmethod
    async def get_sendgrid_settings() -> Optional[Dict[str, Any]]:
        """Get SendGrid configuration from database"""
        settings = await db.platform_settings.find_one({"key": "sendgrid_integration"}, {"_id": 0})
        if not settings or not settings.get("value"):
            return None
        
        value = settings["value"]
        if not value.get("api_key") or not value.get("sender_email") or not value.get("is_enabled"):
            return None
        
        return value
    
    @staticmethod
    async def get_template(template_key: str) -> Optional[Dict[str, Any]]:
        """Get an email template by key"""
        template = await db.email_templates.find_one(
            {"key": template_key, "is_enabled": True},
            {"_id": 0}
        )
        return template
    
    @staticmethod
    def replace_variables(content: str, variables: Dict[str, Any]) -> str:
        """Replace {{variable}} placeholders with actual values"""
        result = content
        for key, value in variables.items():
            result = result.replace(f"{{{{{key}}}}}", str(value))
        return result
    
    @staticmethod
    async def send_email(
        to_email: str,
        template_key: str,
        variables: Dict[str, Any],
        fallback_subject: str = "Notification",
        fallback_content: str = ""
    ) -> bool:
        """
        Send an email using a template from the database
        
        Args:
            to_email: Recipient email address
            template_key: Key of the template to use (e.g., 'password_reset', 'welcome')
            variables: Dict of variables to replace in the template
            fallback_subject: Subject to use if template not found
            fallback_content: HTML content to use if template not found
        
        Returns:
            True if email was sent successfully, False otherwise
        """
        try:
            # Get SendGrid settings
            sendgrid_settings = await EmailService.get_sendgrid_settings()
            
            if not sendgrid_settings:
                logger.warning(f"SendGrid not configured - cannot send email to {to_email}")
                return False
            
            api_key = sendgrid_settings["api_key"]
            sender_email = sendgrid_settings["sender_email"]
            sender_name = sendgrid_settings.get("sender_name", "Platform")
            
            # Get template from database
            template = await EmailService.get_template(template_key)
            
            if template:
                subject = template["subject"]
                html_content = template["html_content"]
            else:
                logger.warning(f"Template '{template_key}' not found or disabled, using fallback")
                subject = fallback_subject
                html_content = fallback_content
            
            # Add common variables
            variables.setdefault("year", str(datetime.now().year))
            variables.setdefault("platform_name", sender_name)
            
            # Replace variables
            subject = EmailService.replace_variables(subject, variables)
            html_content = EmailService.replace_variables(html_content, variables)
            
            # Send via SendGrid
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail, Email, To
            
            sg = SendGridAPIClient(api_key)
            
            message = Mail(
                from_email=Email(sender_email, sender_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=html_content
            )
            
            response = sg.send(message)
            
            if response.status_code == 202:
                logger.info(f"Email sent successfully: {template_key} to {to_email}")
                return True
            else:
                logger.error(f"SendGrid returned status {response.status_code} for {template_key}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to send email '{template_key}' to {to_email}: {str(e)}")
            return False
    
    # ============== Convenience Methods for Common Emails ==============
    
    @staticmethod
    async def send_welcome_email(
        to_email: str,
        user_name: str,
        login_url: str
    ) -> bool:
        """Send welcome email to new user"""
        return await EmailService.send_email(
            to_email=to_email,
            template_key="welcome",
            variables={
                "user_name": user_name,
                "user_email": to_email,
                "login_url": login_url
            },
            fallback_subject="Welcome!",
            fallback_content=f"<p>Welcome {user_name}! Your account has been created.</p>"
        )
    
    @staticmethod
    async def send_password_reset_email(
        to_email: str,
        user_name: str,
        reset_url: str,
        expiry_hours: int = 1
    ) -> bool:
        """Send password reset email"""
        return await EmailService.send_email(
            to_email=to_email,
            template_key="password_reset",
            variables={
                "user_name": user_name,
                "reset_url": reset_url,
                "expiry_hours": str(expiry_hours)
            },
            fallback_subject="Reset Your Password",
            fallback_content=f"""
            <p>Hi {user_name},</p>
            <p>Click <a href="{reset_url}">here</a> to reset your password.</p>
            <p>This link expires in {expiry_hours} hour(s).</p>
            """
        )
    
    @staticmethod
    async def send_team_invite_email(
        to_email: str,
        user_name: str,
        inviter_name: str,
        team_name: str,
        user_role: str,
        invite_url: str,
        temp_password: str
    ) -> bool:
        """Send team invitation email"""
        return await EmailService.send_email(
            to_email=to_email,
            template_key="team_invite",
            variables={
                "user_name": user_name,
                "inviter_name": inviter_name,
                "team_name": team_name,
                "user_role": user_role,
                "invite_url": invite_url,
                "temp_password": temp_password
            },
            fallback_subject=f"You've been invited to join {team_name}",
            fallback_content=f"""
            <p>Hi {user_name},</p>
            <p>{inviter_name} has invited you to join {team_name}.</p>
            <p>Your role: {user_role}</p>
            <p>Temporary password: {temp_password}</p>
            <p><a href="{invite_url}">Click here to login</a></p>
            """
        )
    
    @staticmethod
    async def send_order_receipt_email(
        to_email: str,
        user_name: str,
        order_id: str,
        order_date: str,
        item_name: str,
        total_amount: str,
        billing_url: str
    ) -> bool:
        """Send order receipt email"""
        return await EmailService.send_email(
            to_email=to_email,
            template_key="order_receipt",
            variables={
                "user_name": user_name,
                "order_id": order_id,
                "order_date": order_date,
                "item_name": item_name,
                "total_amount": total_amount,
                "billing_url": billing_url
            },
            fallback_subject=f"Your Receipt - Order #{order_id}",
            fallback_content=f"""
            <p>Hi {user_name},</p>
            <p>Thank you for your purchase!</p>
            <p>Order ID: {order_id}</p>
            <p>Item: {item_name}</p>
            <p>Total: {total_amount}</p>
            """
        )
    
    @staticmethod
    async def send_subscription_activated_email(
        to_email: str,
        user_name: str,
        plan_name: str,
        billing_cycle: str,
        next_billing_date: str,
        dashboard_url: str
    ) -> bool:
        """Send subscription activated email"""
        return await EmailService.send_email(
            to_email=to_email,
            template_key="subscription_activated",
            variables={
                "user_name": user_name,
                "plan_name": plan_name,
                "billing_cycle": billing_cycle,
                "next_billing_date": next_billing_date,
                "dashboard_url": dashboard_url
            },
            fallback_subject=f"Your {plan_name} subscription is now active!",
            fallback_content=f"""
            <p>Hi {user_name},</p>
            <p>Your {plan_name} subscription is now active!</p>
            <p>Billing: {billing_cycle}</p>
            <p>Next billing: {next_billing_date}</p>
            """
        )
    
    @staticmethod
    async def send_subscription_cancelled_email(
        to_email: str,
        user_name: str,
        plan_name: str,
        end_date: str,
        reactivate_url: str
    ) -> bool:
        """Send subscription cancelled email"""
        return await EmailService.send_email(
            to_email=to_email,
            template_key="subscription_cancelled",
            variables={
                "user_name": user_name,
                "plan_name": plan_name,
                "end_date": end_date,
                "reactivate_url": reactivate_url
            },
            fallback_subject="Your subscription has been cancelled",
            fallback_content=f"""
            <p>Hi {user_name},</p>
            <p>Your {plan_name} subscription has been cancelled.</p>
            <p>Access until: {end_date}</p>
            """
        )
    
    @staticmethod
    async def send_quota_warning_email(
        to_email: str,
        user_name: str,
        resource_name: str,
        plan_name: str,
        current_usage: str,
        usage_limit: str,
        usage_percentage: str,
        upgrade_url: str
    ) -> bool:
        """Send quota warning email (approaching limit)"""
        return await EmailService.send_email(
            to_email=to_email,
            template_key="quota_warning",
            variables={
                "user_name": user_name,
                "resource_name": resource_name,
                "plan_name": plan_name,
                "current_usage": current_usage,
                "usage_limit": usage_limit,
                "usage_percentage": usage_percentage,
                "upgrade_url": upgrade_url
            },
            fallback_subject=f"You're approaching your {resource_name} limit",
            fallback_content=f"""
            <p>Hi {user_name},</p>
            <p>You're at {usage_percentage}% of your {resource_name} limit.</p>
            <p>Current: {current_usage} / {usage_limit}</p>
            """
        )
    
    @staticmethod
    async def send_quota_exceeded_email(
        to_email: str,
        user_name: str,
        resource_name: str,
        plan_name: str,
        usage_percentage: str,
        upgrade_url: str
    ) -> bool:
        """Send quota exceeded email"""
        return await EmailService.send_email(
            to_email=to_email,
            template_key="quota_exceeded",
            variables={
                "user_name": user_name,
                "resource_name": resource_name,
                "plan_name": plan_name,
                "usage_percentage": usage_percentage,
                "upgrade_url": upgrade_url
            },
            fallback_subject=f"You've reached your {resource_name} limit",
            fallback_content=f"""
            <p>Hi {user_name},</p>
            <p>You've exceeded your {resource_name} limit on the {plan_name} plan.</p>
            """
        )


# Singleton instance
email_service = EmailService()
