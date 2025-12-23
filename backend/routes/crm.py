"""
CRM (Customer Relationship Management) routes
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from uuid import uuid4
import logging

from middleware.database import db
from middleware import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/crm", tags=["crm"])

# --- Models ---

class CustomerCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    tags: List[str] = []
    custom_fields: Dict[str, Any] = {}

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    status: Optional[str] = None

class CustomerResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    tags: List[str] = []
    custom_fields: Dict[str, Any] = {}
    status: str = "active"
    total_conversations: int = 0
    last_contact: Optional[str] = None
    created_at: str
    updated_at: str

class FollowUpCreate(BaseModel):
    customer_id: str
    title: str
    description: Optional[str] = None
    due_date: str
    priority: str = "medium"  # low, medium, high
    type: str = "call"  # call, email, meeting, task

class FollowUpUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None  # pending, completed, cancelled

class FollowUpResponse(BaseModel):
    id: str
    tenant_id: str
    customer_id: str
    customer_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    due_date: str
    priority: str
    type: str
    status: str = "pending"
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None

class ActivityCreate(BaseModel):
    customer_id: str
    type: str  # note, email_sent, email_received, call, meeting, status_change
    title: str
    description: Optional[str] = None
    metadata: Dict[str, Any] = {}

class ActivityResponse(BaseModel):
    id: str
    tenant_id: str
    customer_id: str
    type: str
    title: str
    description: Optional[str] = None
    metadata: Dict[str, Any] = {}
    created_at: str
    created_by: Optional[str] = None

class EmailSend(BaseModel):
    customer_id: str
    subject: str
    body: str
    template_id: Optional[str] = None

# --- Customer Endpoints ---

@router.get("/customers", response_model=List[CustomerResponse])
async def get_customers(
    current_user: dict = Depends(get_current_user),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0)
):
    """Get all customers for the tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    query = {"tenant_id": tenant_id}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}}
        ]
    
    if status:
        query["status"] = status
    
    if tag:
        query["tags"] = tag
    
    customers = await db.crm_customers.find(
        query,
        {"_id": 0}
    ).sort("updated_at", -1).skip(offset).limit(limit).to_list(limit)
    
    return customers

@router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific customer"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    customer = await db.crm_customers.find_one(
        {"id": customer_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return customer

@router.post("/customers", response_model=CustomerResponse)
async def create_customer(
    data: CustomerCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new customer"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    now = datetime.now(timezone.utc).isoformat()
    customer = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "company": data.company,
        "position": data.position,
        "address": data.address,
        "notes": data.notes,
        "tags": data.tags,
        "custom_fields": data.custom_fields,
        "status": "active",
        "total_conversations": 0,
        "last_contact": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.crm_customers.insert_one(customer)
    
    # Log activity
    await log_activity(
        tenant_id=tenant_id,
        customer_id=customer["id"],
        type="customer_created",
        title="Customer created",
        description=f"Customer {data.name} was added to CRM",
        user_id=current_user.get("id")
    )
    
    return customer

@router.patch("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    data: CustomerUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a customer"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    customer = await db.crm_customers.find_one(
        {"id": customer_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.crm_customers.update_one(
        {"id": customer_id, "tenant_id": tenant_id},
        {"$set": update_data}
    )
    
    # Log activity for status changes
    if data.status and data.status != customer.get("status"):
        await log_activity(
            tenant_id=tenant_id,
            customer_id=customer_id,
            type="status_change",
            title=f"Status changed to {data.status}",
            description=f"Customer status changed from {customer.get('status')} to {data.status}",
            user_id=current_user.get("id")
        )
    
    updated = await db.crm_customers.find_one(
        {"id": customer_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    return updated

@router.delete("/customers/{customer_id}")
async def delete_customer(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a customer"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    result = await db.crm_customers.delete_one(
        {"id": customer_id, "tenant_id": tenant_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Also delete related data
    await db.crm_followups.delete_many({"customer_id": customer_id, "tenant_id": tenant_id})
    await db.crm_activities.delete_many({"customer_id": customer_id, "tenant_id": tenant_id})
    
    return {"message": "Customer deleted successfully"}

# --- Follow-up Endpoints ---

@router.get("/followups", response_model=List[FollowUpResponse])
async def get_followups(
    current_user: dict = Depends(get_current_user),
    customer_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    limit: int = Query(50, le=200)
):
    """Get follow-ups"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    query = {"tenant_id": tenant_id}
    
    if customer_id:
        query["customer_id"] = customer_id
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    
    followups = await db.crm_followups.find(
        query,
        {"_id": 0}
    ).sort("due_date", 1).limit(limit).to_list(limit)
    
    # Add customer names
    for followup in followups:
        customer = await db.crm_customers.find_one(
            {"id": followup["customer_id"]},
            {"_id": 0, "name": 1}
        )
        followup["customer_name"] = customer.get("name") if customer else None
    
    return followups

@router.post("/followups", response_model=FollowUpResponse)
async def create_followup(
    data: FollowUpCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new follow-up"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify customer exists
    customer = await db.crm_customers.find_one(
        {"id": data.customer_id, "tenant_id": tenant_id},
        {"_id": 0, "name": 1}
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    now = datetime.now(timezone.utc).isoformat()
    followup = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "customer_id": data.customer_id,
        "title": data.title,
        "description": data.description,
        "due_date": data.due_date,
        "priority": data.priority,
        "type": data.type,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "completed_at": None
    }
    
    await db.crm_followups.insert_one(followup)
    
    # Log activity
    await log_activity(
        tenant_id=tenant_id,
        customer_id=data.customer_id,
        type="followup_created",
        title=f"Follow-up scheduled: {data.title}",
        description=f"Due: {data.due_date}",
        user_id=current_user.get("id")
    )
    
    followup["customer_name"] = customer.get("name")
    return followup

@router.patch("/followups/{followup_id}", response_model=FollowUpResponse)
async def update_followup(
    followup_id: str,
    data: FollowUpUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a follow-up"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    followup = await db.crm_followups.find_one(
        {"id": followup_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not followup:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Set completed_at if status changed to completed
    if data.status == "completed" and followup.get("status") != "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        # Log activity
        await log_activity(
            tenant_id=tenant_id,
            customer_id=followup["customer_id"],
            type="followup_completed",
            title=f"Follow-up completed: {followup['title']}",
            user_id=current_user.get("id")
        )
    
    await db.crm_followups.update_one(
        {"id": followup_id, "tenant_id": tenant_id},
        {"$set": update_data}
    )
    
    updated = await db.crm_followups.find_one(
        {"id": followup_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    # Add customer name
    customer = await db.crm_customers.find_one(
        {"id": updated["customer_id"]},
        {"_id": 0, "name": 1}
    )
    updated["customer_name"] = customer.get("name") if customer else None
    
    return updated

@router.delete("/followups/{followup_id}")
async def delete_followup(
    followup_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a follow-up"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    result = await db.crm_followups.delete_one(
        {"id": followup_id, "tenant_id": tenant_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    
    return {"message": "Follow-up deleted successfully"}

# --- Activity/History Endpoints ---

@router.get("/activities", response_model=List[ActivityResponse])
async def get_activities(
    current_user: dict = Depends(get_current_user),
    customer_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    limit: int = Query(50, le=200)
):
    """Get activity history"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    query = {"tenant_id": tenant_id}
    
    if customer_id:
        query["customer_id"] = customer_id
    if type:
        query["type"] = type
    
    activities = await db.crm_activities.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return activities

@router.post("/activities", response_model=ActivityResponse)
async def create_activity(
    data: ActivityCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new activity/note"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    activity = await log_activity(
        tenant_id=tenant_id,
        customer_id=data.customer_id,
        type=data.type,
        title=data.title,
        description=data.description,
        metadata=data.metadata,
        user_id=current_user.get("id")
    )
    
    # Update customer's last_contact
    await db.crm_customers.update_one(
        {"id": data.customer_id, "tenant_id": tenant_id},
        {"$set": {"last_contact": datetime.now(timezone.utc).isoformat()}}
    )
    
    return activity

# --- Email Endpoints ---

@router.post("/email/send")
async def send_customer_email(
    data: EmailSend,
    current_user: dict = Depends(get_current_user)
):
    """Send an email to a customer"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get customer
    customer = await db.crm_customers.find_one(
        {"id": data.customer_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    if not customer.get("email"):
        raise HTTPException(status_code=400, detail="Customer has no email address")
    
    # Get settings for SendGrid
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    sendgrid_key = settings.get("sendgrid_api_key") if settings else None
    from_email = settings.get("from_email", "noreply@example.com") if settings else "noreply@example.com"
    
    email_sent = False
    error_message = None
    
    if sendgrid_key:
        try:
            import sendgrid
            from sendgrid.helpers.mail import Mail, Email, To, Content
            
            sg = sendgrid.SendGridAPIClient(api_key=sendgrid_key)
            message = Mail(
                from_email=Email(from_email),
                to_emails=To(customer["email"]),
                subject=data.subject,
                html_content=Content("text/html", data.body)
            )
            
            response = sg.send(message)
            email_sent = response.status_code in [200, 201, 202]
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            error_message = str(e)
    else:
        error_message = "SendGrid not configured"
    
    # Log activity regardless of success
    await log_activity(
        tenant_id=tenant_id,
        customer_id=data.customer_id,
        type="email_sent",
        title=f"Email: {data.subject}",
        description=data.body[:500] if data.body else None,
        metadata={
            "to": customer["email"],
            "subject": data.subject,
            "sent": email_sent,
            "error": error_message
        },
        user_id=current_user.get("id")
    )
    
    # Update last contact
    await db.crm_customers.update_one(
        {"id": data.customer_id, "tenant_id": tenant_id},
        {"$set": {"last_contact": datetime.now(timezone.utc).isoformat()}}
    )
    
    if not email_sent:
        return {"success": False, "message": error_message or "Failed to send email"}
    
    return {"success": True, "message": "Email sent successfully"}

# --- Conversation Integration Endpoints ---

@router.get("/customers/{customer_id}/conversations")
async def get_customer_conversations(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all conversations linked to a CRM customer"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify customer exists
    customer = await db.crm_customers.find_one(
        {"id": customer_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Find conversations by crm_customer_id or by matching email
    query = {"tenant_id": tenant_id}
    if customer.get("email"):
        query["$or"] = [
            {"crm_customer_id": customer_id},
            {"customer_email": customer["email"]}
        ]
    else:
        query["crm_customer_id"] = customer_id
    
    conversations = await db.conversations.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with message count
    for conv in conversations:
        msg_count = await db.messages.count_documents({"conversation_id": conv["id"]})
        conv["message_count"] = msg_count
    
    return conversations


@router.post("/customers/from-conversation/{conversation_id}")
async def create_customer_from_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Create a CRM customer from an existing conversation or link to existing"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get the conversation
    conversation = await db.conversations.find_one(
        {"id": conversation_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check if already linked to a CRM customer
    if conversation.get("crm_customer_id"):
        existing = await db.crm_customers.find_one(
            {"id": conversation["crm_customer_id"], "tenant_id": tenant_id},
            {"_id": 0}
        )
        if existing:
            return {"customer": existing, "created": False, "message": "Already linked to CRM customer"}
    
    # Try to find existing customer by email
    customer_email = conversation.get("customer_email")
    existing_customer = None
    if customer_email:
        existing_customer = await db.crm_customers.find_one(
            {"email": customer_email, "tenant_id": tenant_id},
            {"_id": 0}
        )
    
    if existing_customer:
        # Link conversation to existing customer
        await db.conversations.update_one(
            {"id": conversation_id},
            {"$set": {"crm_customer_id": existing_customer["id"]}}
        )
        
        # Update customer stats
        conv_count = await db.conversations.count_documents({
            "tenant_id": tenant_id,
            "$or": [
                {"crm_customer_id": existing_customer["id"]},
                {"customer_email": customer_email}
            ]
        })
        await db.crm_customers.update_one(
            {"id": existing_customer["id"]},
            {
                "$set": {
                    "total_conversations": conv_count,
                    "last_contact": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Log activity
        await log_activity(
            tenant_id=tenant_id,
            customer_id=existing_customer["id"],
            type="conversation_linked",
            title="Conversation linked",
            description=f"Linked to conversation from {conversation.get('source', 'widget')}",
            metadata={"conversation_id": conversation_id},
            user_id=current_user.get("id")
        )
        
        return {"customer": existing_customer, "created": False, "message": "Linked to existing CRM customer"}
    
    # Create new customer
    now = datetime.now(timezone.utc).isoformat()
    customer = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "name": conversation.get("customer_name") or "Unknown",
        "email": customer_email,
        "phone": None,
        "company": None,
        "position": None,
        "address": None,
        "notes": f"Created from {conversation.get('source', 'widget')} conversation",
        "tags": ["from-chat"],
        "custom_fields": {},
        "status": "active",
        "total_conversations": 1,
        "last_contact": now,
        "created_at": now,
        "updated_at": now
    }
    
    await db.crm_customers.insert_one(customer)
    
    # Link conversation to new customer
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"crm_customer_id": customer["id"]}}
    )
    
    # Log activity
    await log_activity(
        tenant_id=tenant_id,
        customer_id=customer["id"],
        type="customer_created",
        title="Customer created from conversation",
        description=f"Created from {conversation.get('source', 'widget')} conversation",
        metadata={"conversation_id": conversation_id},
        user_id=current_user.get("id")
    )
    
    return {"customer": customer, "created": True, "message": "New CRM customer created"}


@router.get("/lookup-by-conversation/{conversation_id}")
async def lookup_crm_by_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if a conversation is linked to a CRM customer"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get the conversation
    conversation = await db.conversations.find_one(
        {"id": conversation_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check direct link
    if conversation.get("crm_customer_id"):
        customer = await db.crm_customers.find_one(
            {"id": conversation["crm_customer_id"], "tenant_id": tenant_id},
            {"_id": 0}
        )
        if customer:
            return {"linked": True, "customer": customer}
    
    # Try to find by email
    customer_email = conversation.get("customer_email")
    if customer_email:
        customer = await db.crm_customers.find_one(
            {"email": customer_email, "tenant_id": tenant_id},
            {"_id": 0}
        )
        if customer:
            return {"linked": True, "customer": customer, "link_suggested": True}
    
    return {"linked": False, "customer": None}


# --- Stats Endpoint ---

@router.get("/stats")
async def get_crm_stats(current_user: dict = Depends(get_current_user)):
    """Get CRM statistics"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    total_customers = await db.crm_customers.count_documents({"tenant_id": tenant_id})
    active_customers = await db.crm_customers.count_documents({"tenant_id": tenant_id, "status": "active"})
    pending_followups = await db.crm_followups.count_documents({"tenant_id": tenant_id, "status": "pending"})
    overdue_followups = await db.crm_followups.count_documents({
        "tenant_id": tenant_id,
        "status": "pending",
        "due_date": {"$lt": datetime.now(timezone.utc).isoformat()}
    })
    
    return {
        "total_customers": total_customers,
        "active_customers": active_customers,
        "pending_followups": pending_followups,
        "overdue_followups": overdue_followups
    }

# --- Helper Functions ---

async def log_activity(
    tenant_id: str,
    customer_id: str,
    type: str,
    title: str,
    description: Optional[str] = None,
    metadata: Dict[str, Any] = {},
    user_id: Optional[str] = None
) -> dict:
    """Log an activity for a customer"""
    activity = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "customer_id": customer_id,
        "type": type,
        "title": title,
        "description": description,
        "metadata": metadata,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user_id
    }
    
    await db.crm_activities.insert_one(activity)
    return activity



# --- AI Automation Endpoints ---

@router.get("/customers/{customer_id}/lead-score")
async def get_customer_lead_score(
    customer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Calculate and return lead score for a customer"""
    from services.ai_automation_service import ai_automation_service
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    result = await ai_automation_service.calculate_lead_score(customer_id, tenant_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


@router.get("/conversations/{conversation_id}/summary")
async def get_conversation_summary(
    conversation_id: str,
    use_ai: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Generate AI-powered summary for a conversation"""
    from services.ai_automation_service import ai_automation_service
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    result = await ai_automation_service.generate_conversation_summary(
        conversation_id, tenant_id, use_ai=use_ai
    )
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


@router.get("/conversations/{conversation_id}/suggest-followup")
async def get_followup_suggestion(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get AI-suggested follow-up for a conversation"""
    from services.ai_automation_service import ai_automation_service
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    result = await ai_automation_service.suggest_followup(conversation_id, tenant_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


@router.post("/conversations/{conversation_id}/auto-process")
async def auto_process_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually trigger AI automation for a conversation
    (normally runs automatically when resolved)
    """
    from services.ai_automation_service import ai_automation_service
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    result = await ai_automation_service.on_conversation_resolved(
        conversation_id,
        tenant_id,
        current_user.get("id")
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.post("/customers/bulk-score")
async def bulk_calculate_lead_scores(
    current_user: dict = Depends(get_current_user)
):
    """Calculate lead scores for all customers"""
    from services.ai_automation_service import ai_automation_service
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get all customers
    customers = await db.crm_customers.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    
    results = {
        "processed": 0,
        "errors": 0,
        "scores": []
    }
    
    for customer in customers:
        try:
            score_result = await ai_automation_service.calculate_lead_score(
                customer["id"], tenant_id
            )
            if "error" not in score_result:
                results["processed"] += 1
                results["scores"].append({
                    "customer_id": customer["id"],
                    "score": score_result["score"],
                    "grade": score_result["grade"]
                })
            else:
                results["errors"] += 1
        except Exception:
            results["errors"] += 1
    
    return results

