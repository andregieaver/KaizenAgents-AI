"""
Email Templates Management Routes (Super Admin only)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from middleware import get_super_admin_user
from middleware.database import db

router = APIRouter(prefix="/admin/email-templates", tags=["email-templates"])
logger = logging.getLogger(__name__)


# Default email templates
DEFAULT_TEMPLATES = [
    {
        "key": "welcome",
        "name": "Welcome Email",
        "description": "Sent when a new user registers or is invited to the platform",
        "subject": "Welcome to {{platform_name}}!",
        "html_content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333; margin: 0;">Welcome to {{platform_name}}!</h1>
    </div>
    
    <p style="color: #555; font-size: 16px;">Hi {{user_name}},</p>
    
    <p style="color: #555; font-size: 16px;">
        Welcome to {{platform_name}}! We're excited to have you on board.
    </p>
    
    <p style="color: #555; font-size: 16px;">
        Your account has been created successfully. You can now log in and start exploring all the features we have to offer.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="{{login_url}}" 
           style="display: inline-block; background-color: #0047AB; color: white; 
                  padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                  font-weight: bold; font-size: 16px;">
            Get Started
        </a>
    </div>
    
    <p style="color: #555; font-size: 16px;">
        If you have any questions, feel free to reach out to our support team.
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #888; font-size: 12px; text-align: center;">
        © {{year}} {{platform_name}}. All rights reserved.
    </p>
</div>
""",
        "variables": ["platform_name", "user_name", "user_email", "login_url", "year"],
        "category": "authentication",
        "is_enabled": True
    },
    {
        "key": "password_reset",
        "name": "Password Reset",
        "description": "Sent when a user requests to reset their password",
        "subject": "Reset Your Password - {{platform_name}}",
        "html_content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333; margin: 0;">Password Reset</h1>
    </div>
    
    <p style="color: #555; font-size: 16px;">Hi {{user_name}},</p>
    
    <p style="color: #555; font-size: 16px;">
        We received a request to reset your password. Click the button below to create a new password:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="{{reset_url}}" 
           style="display: inline-block; background-color: #0047AB; color: white; 
                  padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                  font-weight: bold; font-size: 16px;">
            Reset Password
        </a>
    </div>
    
    <p style="color: #555; font-size: 14px;">
        Or copy and paste this link into your browser:
    </p>
    <p style="color: #0047AB; font-size: 14px; word-break: break-all;">
        {{reset_url}}
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #888; font-size: 12px;">
        This link will expire in {{expiry_hours}} hour(s). If you didn't request a password reset, 
        you can safely ignore this email.
    </p>
    
    <p style="color: #888; font-size: 12px; text-align: center;">
        © {{year}} {{platform_name}}. All rights reserved.
    </p>
</div>
""",
        "variables": ["platform_name", "user_name", "reset_url", "expiry_hours", "year"],
        "category": "authentication",
        "is_enabled": True
    },
    {
        "key": "order_receipt",
        "name": "Order Receipt",
        "description": "Sent when a user completes a purchase or subscription",
        "subject": "Your Receipt from {{platform_name}} - Order #{{order_id}}",
        "html_content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333; margin: 0;">Thank You for Your Order!</h1>
    </div>
    
    <p style="color: #555; font-size: 16px;">Hi {{user_name}},</p>
    
    <p style="color: #555; font-size: 16px;">
        Thank you for your purchase! Here's your receipt:
    </p>
    
    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="padding: 10px 0; color: #666;">Order ID:</td>
                <td style="padding: 10px 0; color: #333; text-align: right; font-weight: bold;">{{order_id}}</td>
            </tr>
            <tr>
                <td style="padding: 10px 0; color: #666;">Date:</td>
                <td style="padding: 10px 0; color: #333; text-align: right;">{{order_date}}</td>
            </tr>
            <tr>
                <td style="padding: 10px 0; color: #666;">Item:</td>
                <td style="padding: 10px 0; color: #333; text-align: right;">{{item_name}}</td>
            </tr>
            <tr style="border-top: 1px solid #ddd;">
                <td style="padding: 15px 0 10px; color: #333; font-weight: bold;">Total:</td>
                <td style="padding: 15px 0 10px; color: #333; text-align: right; font-weight: bold; font-size: 18px;">{{total_amount}}</td>
            </tr>
        </table>
    </div>
    
    <p style="color: #555; font-size: 14px;">
        You can view your billing history and manage your subscription in your account settings.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="{{billing_url}}" 
           style="display: inline-block; background-color: #0047AB; color: white; 
                  padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                  font-weight: bold; font-size: 16px;">
            View Billing
        </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #888; font-size: 12px; text-align: center;">
        © {{year}} {{platform_name}}. All rights reserved.
    </p>
</div>
""",
        "variables": ["platform_name", "user_name", "order_id", "order_date", "item_name", "total_amount", "billing_url", "year"],
        "category": "billing",
        "is_enabled": True
    },
    {
        "key": "quota_warning",
        "name": "Quota Warning",
        "description": "Sent when a user is approaching their usage quota limit",
        "subject": "⚠️ You're approaching your {{resource_name}} limit - {{platform_name}}",
        "html_content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #f59e0b; margin: 0;">⚠️ Quota Alert</h1>
    </div>
    
    <p style="color: #555; font-size: 16px;">Hi {{user_name}},</p>
    
    <p style="color: #555; font-size: 16px;">
        You're approaching your <strong>{{resource_name}}</strong> limit on your {{plan_name}} plan.
    </p>
    
    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="padding: 8px 0; color: #666;">Current Usage:</td>
                <td style="padding: 8px 0; color: #333; text-align: right; font-weight: bold;">{{current_usage}}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #666;">Limit:</td>
                <td style="padding: 8px 0; color: #333; text-align: right; font-weight: bold;">{{usage_limit}}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #666;">Usage:</td>
                <td style="padding: 8px 0; color: #f59e0b; text-align: right; font-weight: bold;">{{usage_percentage}}%</td>
            </tr>
        </table>
    </div>
    
    <p style="color: #555; font-size: 16px;">
        To continue using all features without interruption, consider upgrading your plan.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="{{upgrade_url}}" 
           style="display: inline-block; background-color: #0047AB; color: white; 
                  padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                  font-weight: bold; font-size: 16px;">
            Upgrade Plan
        </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #888; font-size: 12px; text-align: center;">
        © {{year}} {{platform_name}}. All rights reserved.
    </p>
</div>
""",
        "variables": ["platform_name", "user_name", "resource_name", "plan_name", "current_usage", "usage_limit", "usage_percentage", "upgrade_url", "year"],
        "category": "notifications",
        "is_enabled": True
    },
    {
        "key": "quota_exceeded",
        "name": "Quota Exceeded",
        "description": "Sent when a user has exceeded their usage quota",
        "subject": "🚫 You've reached your {{resource_name}} limit - {{platform_name}}",
        "html_content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #ef4444; margin: 0;">🚫 Quota Exceeded</h1>
    </div>
    
    <p style="color: #555; font-size: 16px;">Hi {{user_name}},</p>
    
    <p style="color: #555; font-size: 16px;">
        You've reached your <strong>{{resource_name}}</strong> limit on your {{plan_name}} plan.
    </p>
    
    <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
        <p style="color: #991b1b; margin: 0; font-weight: bold;">
            Your {{resource_name}} quota is now at {{usage_percentage}}% capacity.
        </p>
        <p style="color: #991b1b; margin: 10px 0 0 0;">
            Some features may be limited until you upgrade or your quota resets.
        </p>
    </div>
    
    <p style="color: #555; font-size: 16px;">
        Upgrade your plan now to continue using all features without interruption.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="{{upgrade_url}}" 
           style="display: inline-block; background-color: #ef4444; color: white; 
                  padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                  font-weight: bold; font-size: 16px;">
            Upgrade Now
        </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #888; font-size: 12px; text-align: center;">
        © {{year}} {{platform_name}}. All rights reserved.
    </p>
</div>
""",
        "variables": ["platform_name", "user_name", "resource_name", "plan_name", "usage_percentage", "upgrade_url", "year"],
        "category": "notifications",
        "is_enabled": True
    },
    {
        "key": "team_invite",
        "name": "Team Invitation",
        "description": "Sent when a user is invited to join a team",
        "subject": "You've been invited to join {{team_name}} on {{platform_name}}",
        "html_content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333; margin: 0;">You're Invited!</h1>
    </div>
    
    <p style="color: #555; font-size: 16px;">Hi {{user_name}},</p>
    
    <p style="color: #555; font-size: 16px;">
        <strong>{{inviter_name}}</strong> has invited you to join <strong>{{team_name}}</strong> on {{platform_name}}.
    </p>
    
    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0047AB;">
        <p style="color: #333; margin: 0;">
            <strong>Your Role:</strong> {{user_role}}
        </p>
    </div>
    
    <p style="color: #555; font-size: 16px;">
        Click the button below to accept the invitation and get started:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="{{invite_url}}" 
           style="display: inline-block; background-color: #0047AB; color: white; 
                  padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                  font-weight: bold; font-size: 16px;">
            Accept Invitation
        </a>
    </div>
    
    <p style="color: #888; font-size: 14px;">
        Your temporary password is: <code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px;">{{temp_password}}</code>
    </p>
    <p style="color: #888; font-size: 14px;">
        Please change your password after logging in.
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #888; font-size: 12px; text-align: center;">
        © {{year}} {{platform_name}}. All rights reserved.
    </p>
</div>
""",
        "variables": ["platform_name", "user_name", "inviter_name", "team_name", "user_role", "invite_url", "temp_password", "year"],
        "category": "team",
        "is_enabled": True
    },
    {
        "key": "subscription_activated",
        "name": "Subscription Activated",
        "description": "Sent when a user's subscription is successfully activated",
        "subject": "🎉 Your {{plan_name}} subscription is now active! - {{platform_name}}",
        "html_content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #10b981; margin: 0;">🎉 Subscription Activated!</h1>
    </div>
    
    <p style="color: #555; font-size: 16px;">Hi {{user_name}},</p>
    
    <p style="color: #555; font-size: 16px;">
        Great news! Your <strong>{{plan_name}}</strong> subscription is now active.
    </p>
    
    <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="padding: 8px 0; color: #666;">Plan:</td>
                <td style="padding: 8px 0; color: #333; text-align: right; font-weight: bold;">{{plan_name}}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #666;">Billing Cycle:</td>
                <td style="padding: 8px 0; color: #333; text-align: right;">{{billing_cycle}}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #666;">Next Billing Date:</td>
                <td style="padding: 8px 0; color: #333; text-align: right;">{{next_billing_date}}</td>
            </tr>
        </table>
    </div>
    
    <p style="color: #555; font-size: 16px;">
        You now have access to all {{plan_name}} features. Start exploring:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="{{dashboard_url}}" 
           style="display: inline-block; background-color: #0047AB; color: white; 
                  padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                  font-weight: bold; font-size: 16px;">
            Go to Dashboard
        </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #888; font-size: 12px; text-align: center;">
        © {{year}} {{platform_name}}. All rights reserved.
    </p>
</div>
""",
        "variables": ["platform_name", "user_name", "plan_name", "billing_cycle", "next_billing_date", "dashboard_url", "year"],
        "category": "billing",
        "is_enabled": True
    },
    {
        "key": "subscription_cancelled",
        "name": "Subscription Cancelled",
        "description": "Sent when a user cancels their subscription",
        "subject": "Your {{platform_name}} subscription has been cancelled",
        "html_content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333; margin: 0;">Subscription Cancelled</h1>
    </div>
    
    <p style="color: #555; font-size: 16px;">Hi {{user_name}},</p>
    
    <p style="color: #555; font-size: 16px;">
        Your {{plan_name}} subscription has been cancelled as requested.
    </p>
    
    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #555; margin: 0;">
            <strong>Important:</strong> You'll continue to have access to {{plan_name}} features until <strong>{{end_date}}</strong>.
        </p>
    </div>
    
    <p style="color: #555; font-size: 16px;">
        We're sorry to see you go. If you change your mind, you can reactivate your subscription anytime.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="{{reactivate_url}}" 
           style="display: inline-block; background-color: #0047AB; color: white; 
                  padding: 14px 32px; text-decoration: none; border-radius: 6px; 
                  font-weight: bold; font-size: 16px;">
            Reactivate Subscription
        </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #888; font-size: 12px; text-align: center;">
        © {{year}} {{platform_name}}. All rights reserved.
    </p>
</div>
""",
        "variables": ["platform_name", "user_name", "plan_name", "end_date", "reactivate_url", "year"],
        "category": "billing",
        "is_enabled": True
    },
    {
        "key": "waitlist_confirmation",
        "name": "Waitlist Confirmation",
        "description": "Auto-responder sent when someone joins the waitlist",
        "subject": "You're on the waitlist! - {{platform_name}}",
        "html_content": """
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333; margin: 0;">You're on the List! 🎉</h1>
    </div>
    
    <p style="color: #555; font-size: 16px;">Hi {{user_name}},</p>
    
    <p style="color: #555; font-size: 16px;">
        Thank you for joining the {{platform_name}} waitlist! We're thrilled to have you interested in what we're building.
    </p>
    
    <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0047AB;">
        <p style="color: #555; margin: 0; font-size: 15px;">
            <strong>What happens next?</strong><br><br>
            We're carefully reviewing all waitlist applications and will reach out when it's your turn to get access. 
            You'll be among the first to know when we have exciting updates to share!
        </p>
    </div>
    
    <p style="color: #555; font-size: 16px;">
        In the meantime, keep an eye on your inbox. We'll send you updates about our progress and let you know as soon as we're ready to welcome you aboard.
    </p>
    
    <p style="color: #555; font-size: 16px;">
        Thanks for your patience and support!
    </p>
    
    <p style="color: #555; font-size: 16px;">
        Best regards,<br>
        The {{platform_name}} Team
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #888; font-size: 12px; text-align: center;">
        © {{year}} {{platform_name}}. All rights reserved.<br>
        You received this email because you signed up for our waitlist.
    </p>
</div>
""",
        "variables": ["platform_name", "user_name", "user_email", "year"],
        "category": "waitlist",
        "is_enabled": True
    }
]


# Pydantic Models
class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    html_content: Optional[str] = None
    is_enabled: Optional[bool] = None


class EmailTemplateResponse(BaseModel):
    id: str
    key: str
    name: str
    description: str
    subject: str
    html_content: str
    variables: List[str]
    category: str
    is_enabled: bool
    created_at: str
    updated_at: str


# Routes
@router.get("")
async def get_all_email_templates(admin_user: dict = Depends(get_super_admin_user)):
    """Get all email templates (Super Admin only)"""
    
    # Initialize default templates if none exist
    await initialize_default_templates()
    
    templates = await db.email_templates.find({}, {"_id": 0}).sort("category", 1).to_list(100)
    return templates


@router.get("/{template_key}")
async def get_email_template(
    template_key: str,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Get a specific email template by key (Super Admin only)"""
    
    template = await db.email_templates.find_one({"key": template_key}, {"_id": 0})
    
    if not template:
        raise HTTPException(status_code=404, detail=f"Email template '{template_key}' not found")
    
    return template


@router.put("/{template_key}")
async def update_email_template(
    template_key: str,
    update: EmailTemplateUpdate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Update an email template (Super Admin only)"""
    
    template = await db.email_templates.find_one({"key": template_key}, {"_id": 0})
    
    if not template:
        raise HTTPException(status_code=404, detail=f"Email template '{template_key}' not found")
    
    # Build update fields
    update_fields = {k: v for k, v in update.model_dump().items() if v is not None}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.email_templates.update_one(
        {"key": template_key},
        {"$set": update_fields}
    )
    
    logger.info(f"Email template '{template_key}' updated by admin: {admin_user.get('email')}")
    
    updated_template = await db.email_templates.find_one({"key": template_key}, {"_id": 0})
    return updated_template


@router.post("/{template_key}/reset")
async def reset_email_template(
    template_key: str,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Reset an email template to its default content (Super Admin only)"""
    
    # Find the default template
    default_template = next((t for t in DEFAULT_TEMPLATES if t["key"] == template_key), None)
    
    if not default_template:
        raise HTTPException(status_code=404, detail=f"No default template found for '{template_key}'")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Reset to default
    await db.email_templates.update_one(
        {"key": template_key},
        {"$set": {
            "name": default_template["name"],
            "description": default_template["description"],
            "subject": default_template["subject"],
            "html_content": default_template["html_content"],
            "updated_at": now
        }}
    )
    
    logger.info(f"Email template '{template_key}' reset to default by admin: {admin_user.get('email')}")
    
    updated_template = await db.email_templates.find_one({"key": template_key}, {"_id": 0})
    return {"message": f"Template '{template_key}' has been reset to default", "template": updated_template}


class SendTestEmailRequest(BaseModel):
    to_email: str
    template_key: str


@router.post("/send-test")
async def send_test_email(
    request: SendTestEmailRequest,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Send a test email using a specific template (Super Admin only)"""
    
    # Get the template
    template = await db.email_templates.find_one({"key": request.template_key}, {"_id": 0})
    
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{request.template_key}' not found")
    
    # Get SendGrid settings
    sendgrid_settings = await db.platform_settings.find_one({"key": "sendgrid_integration"})
    
    if not sendgrid_settings or not sendgrid_settings.get("value"):
        raise HTTPException(status_code=400, detail="SendGrid not configured. Please configure SendGrid in Integrations first.")
    
    settings_value = sendgrid_settings["value"]
    api_key = settings_value.get("api_key")
    sender_email = settings_value.get("sender_email")
    sender_name = settings_value.get("sender_name", "Platform")
    is_enabled = settings_value.get("is_enabled", False)
    
    if not api_key or not sender_email:
        raise HTTPException(status_code=400, detail="SendGrid API key or sender email not configured")
    
    if not is_enabled:
        raise HTTPException(status_code=400, detail="SendGrid integration is disabled. Please enable it in Integrations.")
    
    # Sample data for test email
    sample_data = {
        "platform_name": sender_name,
        "user_name": admin_user.get("name", "Test User"),
        "user_email": request.to_email,
        "login_url": "https://example.com/login",
        "reset_url": "https://example.com/reset-password?token=sample_token",
        "expiry_hours": "1",
        "order_id": "TEST-12345",
        "order_date": datetime.now().strftime("%B %d, %Y"),
        "item_name": "Professional Plan (Monthly)",
        "total_amount": "$99.00",
        "billing_url": "https://example.com/billing",
        "resource_name": "Agents",
        "plan_name": "Professional",
        "current_usage": "8",
        "usage_limit": "10",
        "usage_percentage": "80",
        "upgrade_url": "https://example.com/pricing",
        "team_name": "Acme Inc",
        "inviter_name": admin_user.get("name", "Admin"),
        "user_role": "Agent",
        "invite_url": "https://example.com/login",
        "temp_password": "TempPass123!",
        "billing_cycle": "Monthly",
        "next_billing_date": "January 15, 2025",
        "dashboard_url": "https://example.com/dashboard",
        "end_date": "February 1, 2025",
        "reactivate_url": "https://example.com/pricing",
        "year": str(datetime.now().year)
    }
    
    # Replace variables in template
    subject = template["subject"]
    html_content = template["html_content"]
    
    for key, value in sample_data.items():
        subject = subject.replace(f"{{{{{key}}}}}", value)
        html_content = html_content.replace(f"{{{{{key}}}}}", value)
    
    # Add test email banner
    test_banner = """
    <div style="background-color: #fef3c7; border: 2px solid #f59e0b; padding: 12px; margin-bottom: 20px; border-radius: 6px; text-align: center;">
        <strong style="color: #92400e;">🧪 TEST EMAIL</strong>
        <p style="color: #92400e; margin: 5px 0 0 0; font-size: 14px;">
            This is a test email for the "{template['name']}" template.<br>
            Variables have been replaced with sample data.
        </p>
    </div>
    """
    
    # Insert banner after opening body/div tag
    if "<body" in html_content.lower():
        html_content = html_content.replace("<body>", f"<body>{test_banner}", 1)
    elif "<div" in html_content:
        # Find the first div and insert after it
        first_div_end = html_content.find(">", html_content.find("<div"))
        if first_div_end > 0:
            html_content = html_content[:first_div_end+1] + test_banner + html_content[first_div_end+1:]
    else:
        html_content = test_banner + html_content
    
    # Send via SendGrid
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, Email, To
        
        sg = SendGridAPIClient(api_key)
        
        message = Mail(
            from_email=Email(sender_email, sender_name),
            to_emails=To(request.to_email),
            subject=f"[TEST] {subject}",
            html_content=html_content
        )
        
        response = sg.send(message)
        
        if response.status_code == 202:
            logger.info(f"Test email sent for template '{request.template_key}' to {request.to_email} by admin: {admin_user.get('email')}")
            return {
                "message": f"Test email sent successfully to {request.to_email}",
                "template": request.template_key,
                "status_code": response.status_code
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"SendGrid returned status code: {response.status_code}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to send test email for template '{request.template_key}': {error_msg}")
        
        if "401" in error_msg or "Unauthorized" in error_msg:
            raise HTTPException(status_code=401, detail="Invalid SendGrid API key")
        
        raise HTTPException(status_code=500, detail=f"Failed to send email: {error_msg}")


@router.post("/preview")
async def preview_email_template(
    data: dict,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Preview an email template with sample data (Super Admin only)"""
    
    html_content = data.get("html_content", "")
    subject = data.get("subject", "")
    
    # Sample data for preview
    sample_data = {
        "platform_name": "Your Platform",
        "user_name": "John Doe",
        "user_email": "john@example.com",
        "login_url": "https://example.com/login",
        "reset_url": "https://example.com/reset-password?token=sample",
        "expiry_hours": "1",
        "order_id": "ORD-12345",
        "order_date": datetime.now().strftime("%B %d, %Y"),
        "item_name": "Professional Plan (Monthly)",
        "total_amount": "$99.00",
        "billing_url": "https://example.com/billing",
        "resource_name": "Agents",
        "plan_name": "Professional",
        "current_usage": "8",
        "usage_limit": "10",
        "usage_percentage": "80",
        "upgrade_url": "https://example.com/pricing",
        "team_name": "Acme Inc",
        "inviter_name": "Jane Smith",
        "user_role": "Agent",
        "invite_url": "https://example.com/login",
        "temp_password": "TempPass123!",
        "billing_cycle": "Monthly",
        "next_billing_date": "January 15, 2025",
        "dashboard_url": "https://example.com/dashboard",
        "end_date": "February 1, 2025",
        "reactivate_url": "https://example.com/pricing",
        "year": str(datetime.now().year)
    }
    
    # Replace variables in content
    preview_html = html_content
    preview_subject = subject
    
    for key, value in sample_data.items():
        preview_html = preview_html.replace(f"{{{{{key}}}}}", value)
        preview_subject = preview_subject.replace(f"{{{{{key}}}}}", value)
    
    return {
        "subject": preview_subject,
        "html_content": preview_html
    }


async def initialize_default_templates():
    """Initialize default email templates - adds any missing templates"""
    
    now = datetime.now(timezone.utc).isoformat()
    added_count = 0
    
    for template in DEFAULT_TEMPLATES:
        # Check if this template already exists
        existing = await db.email_templates.find_one({"key": template["key"]})
        
        if existing:
            continue  # Template already exists, skip
        
        # Add the missing template
        template_doc = {
            "id": str(uuid.uuid4()),
            **template,
            "created_at": now,
            "updated_at": now
        }
        await db.email_templates.insert_one(template_doc)
        added_count += 1
        logger.info(f"Added missing email template: {template['key']}")
    
    if added_count > 0:
        logger.info(f"Initialized {added_count} missing email templates")


async def get_template(template_key: str) -> Optional[Dict[str, Any]]:
    """Get an email template by key (helper function for other modules)"""
    return await db.email_templates.find_one({"key": template_key, "is_enabled": True}, {"_id": 0})
