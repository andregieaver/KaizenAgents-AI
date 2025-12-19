"""
Waitlist API Routes
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

from middleware.database import db
from middleware import get_super_admin_user
from services.email_service import EmailService

router = APIRouter(prefix="/waitlist", tags=["waitlist"])
logger = logging.getLogger("app")


class WaitlistEntry(BaseModel):
    """Waitlist submission entry"""
    name: str
    email: EmailStr
    estimated_users: int
    privacy_accepted: bool


class WaitlistResponse(BaseModel):
    """Waitlist entry response"""
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: str
    estimated_users: int
    privacy_accepted: bool
    status: str
    created_at: str
    notes: Optional[str] = None


class WaitlistUpdate(BaseModel):
    """Update waitlist entry"""
    status: Optional[str] = None
    notes: Optional[str] = None


# ============== PUBLIC ENDPOINTS ==============

@router.post("/submit")
async def submit_waitlist_entry(entry: WaitlistEntry):
    """
    Submit a new waitlist entry (Public endpoint)
    Sends auto-responder email if configured
    """
    if not entry.privacy_accepted:
        raise HTTPException(status_code=400, detail="Privacy policy must be accepted")
    
    if entry.estimated_users < 1:
        raise HTTPException(status_code=400, detail="Estimated users must be at least 1")
    
    # Check if email already exists
    existing = await db.waitlist.find_one({"email": entry.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="This email is already on the waitlist")
    
    now = datetime.now(timezone.utc).isoformat()
    entry_id = str(uuid.uuid4())
    
    waitlist_doc = {
        "id": entry_id,
        "name": entry.name,
        "email": entry.email.lower(),
        "estimated_users": entry.estimated_users,
        "privacy_accepted": entry.privacy_accepted,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "notes": None
    }
    
    await db.waitlist.insert_one(waitlist_doc)
    logger.info(f"New waitlist entry: {entry.email}")
    
    # Send auto-responder email
    try:
        await send_waitlist_confirmation(entry.name, entry.email)
    except Exception as e:
        logger.error(f"Failed to send waitlist confirmation email: {e}")
    
    return {
        "message": "Successfully added to the waitlist",
        "id": entry_id
    }


async def send_waitlist_confirmation(name: str, email: str):
    """Send waitlist confirmation auto-responder email"""
    # Get platform info
    platform_info = await db.platform_info.find_one({}, {"_id": 0})
    platform_name = platform_info.get("name", "AI Support Hub") if platform_info else "AI Support Hub"
    
    # Build variables for template
    variables = {
        "platform_name": platform_name,
        "user_name": name,
        "user_email": email,
        "year": str(datetime.now().year)
    }
    
    # Send email using EmailService with template
    success = await EmailService.send_email(
        to_email=email,
        template_key="waitlist_confirmation",
        variables=variables,
        fallback_subject=f"You're on the waitlist - {platform_name}",
        fallback_content=f"<p>Hi {name},</p><p>Thank you for joining our waitlist!</p>"
    )
    
    if success:
        logger.info(f"Waitlist confirmation email sent to {email}")
    else:
        logger.warning(f"Failed to send waitlist confirmation email to {email}")


# ============== ADMIN ENDPOINTS ==============

@router.get("/entries", response_model=List[WaitlistResponse])
async def get_all_waitlist_entries(
    status: Optional[str] = None,
    current_user: dict = Depends(get_super_admin_user)
):
    """Get all waitlist entries (Super Admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    entries = await db.waitlist.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return entries


@router.get("/entries/{entry_id}", response_model=WaitlistResponse)
async def get_waitlist_entry(
    entry_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Get a specific waitlist entry (Super Admin only)"""
    entry = await db.waitlist.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    return entry


@router.patch("/entries/{entry_id}", response_model=WaitlistResponse)
async def update_waitlist_entry(
    entry_id: str,
    update: WaitlistUpdate,
    current_user: dict = Depends(get_super_admin_user)
):
    """Update a waitlist entry status or notes (Super Admin only)"""
    entry = await db.waitlist.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    
    update_fields = {k: v for k, v in update.model_dump().items() if v is not None}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.waitlist.update_one({"id": entry_id}, {"$set": update_fields})
    
    updated_entry = await db.waitlist.find_one({"id": entry_id}, {"_id": 0})
    logger.info(f"Waitlist entry {entry_id} updated")
    
    return updated_entry


@router.delete("/entries/{entry_id}")
async def delete_waitlist_entry(
    entry_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Delete a waitlist entry (Super Admin only)"""
    entry = await db.waitlist.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    
    await db.waitlist.delete_one({"id": entry_id})
    logger.info(f"Waitlist entry {entry_id} deleted")
    
    return {"message": "Waitlist entry deleted successfully"}


@router.get("/stats")
async def get_waitlist_stats(current_user: dict = Depends(get_super_admin_user)):
    """Get waitlist statistics (Super Admin only)"""
    total = await db.waitlist.count_documents({})
    pending = await db.waitlist.count_documents({"status": "pending"})
    approved = await db.waitlist.count_documents({"status": "approved"})
    rejected = await db.waitlist.count_documents({"status": "rejected"})
    
    # Calculate total estimated users
    pipeline = [
        {"$group": {"_id": None, "total_estimated": {"$sum": "$estimated_users"}}}
    ]
    result = await db.waitlist.aggregate(pipeline).to_list(1)
    total_estimated = result[0]["total_estimated"] if result else 0
    
    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "total_estimated_users": total_estimated
    }
