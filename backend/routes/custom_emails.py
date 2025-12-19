"""
Custom Email Campaigns API Routes
Allows super admins to create, save, and send custom emails to user categories
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime, timezone
import uuid
import logging
import asyncio

from middleware.database import db
from middleware import get_super_admin_user
from services.email_service import EmailService

router = APIRouter(prefix="/custom-emails", tags=["custom-emails"])
logger = logging.getLogger("app")


# ============== MODELS ==============

class CustomEmailCreate(BaseModel):
    """Create a custom email campaign"""
    name: str
    subject: str
    html_content: str
    recipient_category: str
    status: Literal["draft", "scheduled", "sent"] = "draft"


class CustomEmailUpdate(BaseModel):
    """Update a custom email"""
    name: Optional[str] = None
    subject: Optional[str] = None
    html_content: Optional[str] = None
    recipient_category: Optional[str] = None
    status: Optional[str] = None


class CustomEmailResponse(BaseModel):
    """Custom email response"""
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    subject: str
    html_content: str
    recipient_category: str
    status: str
    sent_count: int
    failed_count: int
    created_at: str
    updated_at: str
    sent_at: Optional[str] = None
    created_by: Optional[str] = None


class SendEmailRequest(BaseModel):
    """Request to send a custom email"""
    email_id: str
    test_mode: bool = False
    test_email: Optional[EmailStr] = None


class RecipientCategory(BaseModel):
    """Recipient category info"""
    id: str
    name: str
    description: str
    count: int


# ============== RECIPIENT CATEGORIES ==============

async def get_recipient_categories():
    """Get all available recipient categories with counts"""
    categories = []
    
    # All Users
    all_users_count = await db.users.count_documents({})
    categories.append({
        "id": "all_users",
        "name": "All Users",
        "description": "All registered users in the system",
        "count": all_users_count
    })
    
    # Waitlist - All
    waitlist_all_count = await db.waitlist.count_documents({})
    categories.append({
        "id": "waitlist_all",
        "name": "Waitlist - All",
        "description": "All waitlist entries",
        "count": waitlist_all_count
    })
    
    # Waitlist - Pending
    waitlist_pending_count = await db.waitlist.count_documents({"status": "pending"})
    categories.append({
        "id": "waitlist_pending",
        "name": "Waitlist - Pending",
        "description": "Pending waitlist entries",
        "count": waitlist_pending_count
    })
    
    # Waitlist - Approved
    waitlist_approved_count = await db.waitlist.count_documents({"status": "approved"})
    categories.append({
        "id": "waitlist_approved",
        "name": "Waitlist - Approved",
        "description": "Approved waitlist entries",
        "count": waitlist_approved_count
    })
    
    # Users by Plan - Free
    free_users_count = await db.subscriptions.count_documents({
        "$or": [
            {"plan_name": {"$regex": "^free$", "$options": "i"}},
            {"plan_name": {"$exists": False}}
        ]
    })
    categories.append({
        "id": "plan_free",
        "name": "Free Plan Users",
        "description": "Users on the Free plan",
        "count": free_users_count
    })
    
    # Users by Plan - Starter
    starter_users_count = await db.subscriptions.count_documents({
        "plan_name": {"$regex": "^starter$", "$options": "i"}
    })
    categories.append({
        "id": "plan_starter",
        "name": "Starter Plan Users",
        "description": "Users on the Starter plan",
        "count": starter_users_count
    })
    
    # Users by Plan - Professional
    pro_users_count = await db.subscriptions.count_documents({
        "plan_name": {"$regex": "^professional$", "$options": "i"}
    })
    categories.append({
        "id": "plan_professional",
        "name": "Professional Plan Users",
        "description": "Users on the Professional plan",
        "count": pro_users_count
    })
    
    # Paid Users (non-free)
    paid_users_count = await db.subscriptions.count_documents({
        "plan_name": {"$not": {"$regex": "^free$", "$options": "i"}}
    })
    categories.append({
        "id": "paid_users",
        "name": "All Paid Users",
        "description": "Users on any paid plan",
        "count": paid_users_count
    })
    
    # Team Owners
    team_owners_count = await db.users.count_documents({"role": "owner"})
    categories.append({
        "id": "team_owners",
        "name": "Team Owners",
        "description": "Company/team owners",
        "count": team_owners_count
    })
    
    # Super Admins
    super_admins_count = await db.users.count_documents({"is_super_admin": True})
    categories.append({
        "id": "super_admins",
        "name": "Super Admins",
        "description": "Platform super administrators",
        "count": super_admins_count
    })
    
    return categories


async def get_recipients_for_category(category_id: str) -> List[dict]:
    """Get email recipients for a specific category"""
    recipients = []
    
    if category_id == "all_users":
        users = await db.users.find({}, {"_id": 0, "email": 1, "name": 1}).to_list(10000)
        recipients = [{"email": u.get("email"), "name": u.get("name", "")} for u in users if u.get("email")]
    
    elif category_id == "waitlist_all":
        entries = await db.waitlist.find({}, {"_id": 0, "email": 1, "name": 1}).to_list(10000)
        recipients = [{"email": e.get("email"), "name": e.get("name", "")} for e in entries if e.get("email")]
    
    elif category_id == "waitlist_pending":
        entries = await db.waitlist.find({"status": "pending"}, {"_id": 0, "email": 1, "name": 1}).to_list(10000)
        recipients = [{"email": e.get("email"), "name": e.get("name", "")} for e in entries if e.get("email")]
    
    elif category_id == "waitlist_approved":
        entries = await db.waitlist.find({"status": "approved"}, {"_id": 0, "email": 1, "name": 1}).to_list(10000)
        recipients = [{"email": e.get("email"), "name": e.get("name", "")} for e in entries if e.get("email")]
    
    elif category_id == "plan_free":
        subs = await db.subscriptions.find({
            "$or": [
                {"plan_name": {"$regex": "^free$", "$options": "i"}},
                {"plan_name": {"$exists": False}}
            ]
        }, {"_id": 0, "user_id": 1}).to_list(10000)
        user_ids = [s.get("user_id") for s in subs]
        users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "email": 1, "name": 1}).to_list(10000)
        recipients = [{"email": u.get("email"), "name": u.get("name", "")} for u in users if u.get("email")]
    
    elif category_id == "plan_starter":
        subs = await db.subscriptions.find({
            "plan_name": {"$regex": "^starter$", "$options": "i"}
        }, {"_id": 0, "user_id": 1}).to_list(10000)
        user_ids = [s.get("user_id") for s in subs]
        users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "email": 1, "name": 1}).to_list(10000)
        recipients = [{"email": u.get("email"), "name": u.get("name", "")} for u in users if u.get("email")]
    
    elif category_id == "plan_professional":
        subs = await db.subscriptions.find({
            "plan_name": {"$regex": "^professional$", "$options": "i"}
        }, {"_id": 0, "user_id": 1}).to_list(10000)
        user_ids = [s.get("user_id") for s in subs]
        users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "email": 1, "name": 1}).to_list(10000)
        recipients = [{"email": u.get("email"), "name": u.get("name", "")} for u in users if u.get("email")]
    
    elif category_id == "paid_users":
        subs = await db.subscriptions.find({
            "plan_name": {"$not": {"$regex": "^free$", "$options": "i"}}
        }, {"_id": 0, "user_id": 1}).to_list(10000)
        user_ids = [s.get("user_id") for s in subs]
        users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "email": 1, "name": 1}).to_list(10000)
        recipients = [{"email": u.get("email"), "name": u.get("name", "")} for u in users if u.get("email")]
    
    elif category_id == "team_owners":
        users = await db.users.find({"role": "owner"}, {"_id": 0, "email": 1, "name": 1}).to_list(10000)
        recipients = [{"email": u.get("email"), "name": u.get("name", "")} for u in users if u.get("email")]
    
    elif category_id == "super_admins":
        users = await db.users.find({"is_super_admin": True}, {"_id": 0, "email": 1, "name": 1}).to_list(10000)
        recipients = [{"email": u.get("email"), "name": u.get("name", "")} for u in users if u.get("email")]
    
    return recipients


# ============== ROUTES ==============

@router.get("/categories", response_model=List[RecipientCategory])
async def get_categories(current_user: dict = Depends(get_super_admin_user)):
    """Get all recipient categories with counts (Super Admin only)"""
    categories = await get_recipient_categories()
    return categories


@router.get("", response_model=List[CustomEmailResponse])
async def get_all_custom_emails(
    status: Optional[str] = None,
    current_user: dict = Depends(get_super_admin_user)
):
    """Get all custom emails (Super Admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    emails = await db.custom_emails.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return emails


@router.get("/{email_id}", response_model=CustomEmailResponse)
async def get_custom_email(
    email_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Get a specific custom email (Super Admin only)"""
    email = await db.custom_emails.find_one({"id": email_id}, {"_id": 0})
    if not email:
        raise HTTPException(status_code=404, detail="Custom email not found")
    return email


@router.post("", response_model=CustomEmailResponse)
async def create_custom_email(
    email_data: CustomEmailCreate,
    current_user: dict = Depends(get_super_admin_user)
):
    """Create a new custom email (Super Admin only)"""
    now = datetime.now(timezone.utc).isoformat()
    email_id = str(uuid.uuid4())
    
    email_doc = {
        "id": email_id,
        "name": email_data.name,
        "subject": email_data.subject,
        "html_content": email_data.html_content,
        "recipient_category": email_data.recipient_category,
        "status": email_data.status,
        "sent_count": 0,
        "failed_count": 0,
        "created_at": now,
        "updated_at": now,
        "sent_at": None,
        "created_by": current_user.get("email")
    }
    
    await db.custom_emails.insert_one(email_doc)
    logger.info(f"Custom email created: {email_data.name} by {current_user.get('email')}")
    
    return email_doc


@router.patch("/{email_id}", response_model=CustomEmailResponse)
async def update_custom_email(
    email_id: str,
    update: CustomEmailUpdate,
    current_user: dict = Depends(get_super_admin_user)
):
    """Update a custom email (Super Admin only)"""
    email = await db.custom_emails.find_one({"id": email_id}, {"_id": 0})
    if not email:
        raise HTTPException(status_code=404, detail="Custom email not found")
    
    if email.get("status") == "sent":
        raise HTTPException(status_code=400, detail="Cannot edit a sent email")
    
    update_fields = {k: v for k, v in update.model_dump().items() if v is not None}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.custom_emails.update_one({"id": email_id}, {"$set": update_fields})
    
    updated_email = await db.custom_emails.find_one({"id": email_id}, {"_id": 0})
    logger.info(f"Custom email updated: {email_id} by {current_user.get('email')}")
    
    return updated_email


@router.delete("/{email_id}")
async def delete_custom_email(
    email_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Delete a custom email (Super Admin only)"""
    email = await db.custom_emails.find_one({"id": email_id}, {"_id": 0})
    if not email:
        raise HTTPException(status_code=404, detail="Custom email not found")
    
    await db.custom_emails.delete_one({"id": email_id})
    logger.info(f"Custom email deleted: {email_id} by {current_user.get('email')}")
    
    return {"message": "Custom email deleted successfully"}


@router.post("/{email_id}/send")
async def send_custom_email(
    email_id: str,
    background_tasks: BackgroundTasks,
    test_mode: bool = False,
    test_email: Optional[str] = None,
    current_user: dict = Depends(get_super_admin_user)
):
    """Send a custom email to recipients (Super Admin only)"""
    email = await db.custom_emails.find_one({"id": email_id}, {"_id": 0})
    if not email:
        raise HTTPException(status_code=404, detail="Custom email not found")
    
    if test_mode:
        if not test_email:
            raise HTTPException(status_code=400, detail="Test email address required for test mode")
        recipients = [{"email": test_email, "name": "Test Recipient"}]
    else:
        recipients = await get_recipients_for_category(email.get("recipient_category", ""))
        if not recipients:
            raise HTTPException(status_code=400, detail="No recipients found for selected category")
    
    # Get platform info for variables
    platform_info = await db.platform_info.find_one({}, {"_id": 0})
    platform_name = platform_info.get("name", "AI Support Hub") if platform_info else "AI Support Hub"
    
    # Send emails in background
    background_tasks.add_task(
        send_bulk_emails,
        email_id=email_id,
        subject=email.get("subject"),
        html_content=email.get("html_content"),
        recipients=recipients,
        platform_name=platform_name,
        is_test=test_mode
    )
    
    if test_mode:
        return {"message": f"Test email queued for delivery to {test_email}"}
    else:
        return {
            "message": f"Email campaign started. Sending to {len(recipients)} recipients.",
            "recipient_count": len(recipients)
        }


async def send_bulk_emails(
    email_id: str,
    subject: str,
    html_content: str,
    recipients: List[dict],
    platform_name: str,
    is_test: bool = False
):
    """Background task to send bulk emails"""
    sent_count = 0
    failed_count = 0
    
    # Get SendGrid settings
    sendgrid_settings = await db.platform_settings.find_one({"key": "sendgrid_integration"})
    if not sendgrid_settings or not sendgrid_settings.get("value", {}).get("api_key"):
        logger.error("SendGrid not configured - cannot send bulk emails")
        return
    
    settings = sendgrid_settings.get("value", {})
    api_key = settings.get("api_key")
    sender_email = settings.get("sender_email")
    sender_name = settings.get("sender_name", platform_name)
    
    if not api_key or not sender_email:
        logger.error("SendGrid API key or sender email not configured")
        return
    
    import sendgrid
    from sendgrid.helpers.mail import Mail, Email, To, Content
    
    sg = sendgrid.SendGridAPIClient(api_key=api_key)
    
    for recipient in recipients:
        try:
            # Replace variables in content
            personalized_content = html_content
            personalized_subject = subject
            
            variables = {
                "platform_name": platform_name,
                "user_name": recipient.get("name", "there"),
                "user_email": recipient.get("email", ""),
                "year": str(datetime.now().year)
            }
            
            for key, value in variables.items():
                personalized_content = personalized_content.replace(f"{{{{{key}}}}}", value)
                personalized_subject = personalized_subject.replace(f"{{{{{key}}}}}", value)
            
            message = Mail(
                from_email=Email(sender_email, sender_name),
                to_emails=To(recipient.get("email")),
                subject=personalized_subject,
                html_content=Content("text/html", personalized_content)
            )
            
            response = sg.send(message)
            
            if response.status_code in [200, 201, 202]:
                sent_count += 1
                logger.debug(f"Email sent to {recipient.get('email')}")
            else:
                failed_count += 1
                logger.warning(f"Failed to send email to {recipient.get('email')}: {response.status_code}")
            
            # Rate limiting - avoid overwhelming SendGrid
            await asyncio.sleep(0.1)
            
        except Exception as e:
            failed_count += 1
            logger.error(f"Error sending email to {recipient.get('email')}: {str(e)}")
    
    # Update email record with results (only if not test mode)
    if not is_test:
        now = datetime.now(timezone.utc).isoformat()
        await db.custom_emails.update_one(
            {"id": email_id},
            {
                "$set": {
                    "status": "sent",
                    "sent_count": sent_count,
                    "failed_count": failed_count,
                    "sent_at": now,
                    "updated_at": now
                }
            }
        )
    
    logger.info(f"Bulk email campaign {email_id}: sent={sent_count}, failed={failed_count}")


@router.post("/{email_id}/duplicate", response_model=CustomEmailResponse)
async def duplicate_custom_email(
    email_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Duplicate a custom email (Super Admin only)"""
    email = await db.custom_emails.find_one({"id": email_id}, {"_id": 0})
    if not email:
        raise HTTPException(status_code=404, detail="Custom email not found")
    
    now = datetime.now(timezone.utc).isoformat()
    new_id = str(uuid.uuid4())
    
    new_email = {
        "id": new_id,
        "name": f"{email.get('name')} (Copy)",
        "subject": email.get("subject"),
        "html_content": email.get("html_content"),
        "recipient_category": email.get("recipient_category"),
        "status": "draft",
        "sent_count": 0,
        "failed_count": 0,
        "created_at": now,
        "updated_at": now,
        "sent_at": None,
        "created_by": current_user.get("email")
    }
    
    await db.custom_emails.insert_one(new_email)
    logger.info(f"Custom email duplicated: {email_id} -> {new_id} by {current_user.get('email')}")
    
    return new_email
