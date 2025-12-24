"""
Widget routes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import jwt
import logging

from models import MessageCreate
from middleware import get_current_user, get_super_admin_user, get_admin_or_owner_user
from middleware.database import db
from middleware.auth import create_token, hash_password, verify_password, is_super_admin, JWT_SECRET, JWT_ALGORITHM
from routes.transfers import check_transfer_triggers

logger = logging.getLogger(__name__)

# Widget-specific models
class WidgetSessionCreate(BaseModel):
    tenant_id: str
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None

class WidgetSessionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_token: str
    conversation_id: str
    settings: dict

class WidgetMessageCreate(BaseModel):
    content: str

router = APIRouter(prefix="/widget", tags=["widget"])

@router.get("/{tenant_id}/settings")
async def get_widget_settings(tenant_id: str):
    """Public endpoint to get widget configuration"""
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not settings:
        return {
            "brand_name": "Support Chat",
            "brand_logo": None,
            "primary_color": "#0047AB",
            "welcome_message": "Hi! How can we help you today?"
        }
    
    return {
        "brand_name": settings.get("brand_name", "Support Chat"),
        "brand_logo": settings.get("brand_logo"),
        "primary_color": settings.get("primary_color", "#0047AB"),
        "welcome_message": settings.get("welcome_message", "Hi! How can we help you today?")
    }

@router.post("/session", response_model=WidgetSessionResponse)
async def create_widget_session(session_data: WidgetSessionCreate):
    """Public endpoint for widget to create a session"""
    tenant_id = session_data.tenant_id
    
    # Verify tenant exists
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Invalid tenant")
    
    # Get tenant settings (public-safe fields only)
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Tenant not configured")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Create conversation
    conversation_id = str(uuid.uuid4())
    customer_id = str(uuid.uuid4())
    
    # Auto-link or create CRM customer if email provided
    crm_customer_id = None
    if session_data.customer_email:
        # Check if CRM customer exists with this email
        existing_crm = await db.crm_customers.find_one(
            {"email": session_data.customer_email, "tenant_id": tenant_id},
            {"_id": 0, "id": 1}
        )
        if existing_crm:
            crm_customer_id = existing_crm["id"]
            # Update last contact
            await db.crm_customers.update_one(
                {"id": crm_customer_id},
                {
                    "$set": {"last_contact": now, "updated_at": now},
                    "$inc": {"total_conversations": 1}
                }
            )
        else:
            # Auto-create CRM customer
            crm_customer_id = str(uuid.uuid4())
            crm_customer = {
                "id": crm_customer_id,
                "tenant_id": tenant_id,
                "name": session_data.customer_name or "Unknown",
                "email": session_data.customer_email,
                "phone": None,
                "company": None,
                "position": None,
                "address": None,
                "notes": "Auto-created from widget conversation",
                "tags": ["from-chat", "auto-created"],
                "custom_fields": {},
                "status": "active",
                "total_conversations": 1,
                "last_contact": now,
                "created_at": now,
                "updated_at": now
            }
            await db.crm_customers.insert_one(crm_customer)
            logger.info(f"Auto-created CRM customer {crm_customer_id} from widget session")
    
    conversation_doc = {
        "id": conversation_id,
        "tenant_id": tenant_id,
        "customer_id": customer_id,
        "crm_customer_id": crm_customer_id,  # Link to CRM
        "customer_name": session_data.customer_name,
        "customer_email": session_data.customer_email,
        "status": "open",
        "mode": "ai",
        "source": "widget",
        "assigned_agent_id": None,
        "last_message": None,
        "last_message_at": None,
        "created_at": now,
        "updated_at": now
    }
    await db.conversations.insert_one(conversation_doc)
    
    # Create session token
    session_token = jwt.encode(
        {
            "conversation_id": conversation_id,
            "tenant_id": tenant_id,
            "customer_id": customer_id,
            "exp": datetime.now(timezone.utc) + timedelta(hours=24)
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )
    
    # Return public settings
    public_settings = {
        "brand_name": settings.get("brand_name", "Support"),
        "brand_logo": settings.get("brand_logo"),
        "primary_color": settings.get("primary_color", "#0047AB"),
        "widget_position": settings.get("widget_position", "bottom-right"),
        "widget_theme": settings.get("widget_theme", "light"),
        "welcome_message": settings.get("welcome_message", "Hi! How can we help?")
    }
    
    return {
        "session_token": session_token,
        "conversation_id": conversation_id,
        "settings": public_settings
    }

@router.get("/messages/{conversation_id}")
async def get_widget_messages(conversation_id: str, token: str):
    """Get messages for widget session"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("conversation_id") != conversation_id:
            raise HTTPException(status_code=403, detail="Invalid session")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    messages = await db.messages.find(
        {"conversation_id": conversation_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    # Get conversation to check mode and assigned agent
    conversation = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    
    # If an agent is assigned, get their info
    assigned_agent_info = None
    if conversation and conversation.get("mode") == "agent" and conversation.get("assigned_agent_id"):
        agent_user = await db.users.find_one(
            {"id": conversation["assigned_agent_id"]},
            {"_id": 0, "id": 1, "name": 1, "avatar_url": 1}
        )
        if agent_user:
            assigned_agent_info = {
                "id": agent_user.get("id"),
                "name": agent_user.get("name", "Support Agent"),
                "avatar_url": agent_user.get("avatar_url")
            }
    
    return {
        "messages": messages,
        "mode": conversation.get("mode", "ai") if conversation else "ai",
        "assigned_agent": assigned_agent_info
    }

@router.post("/messages/{conversation_id}")
async def send_widget_message(conversation_id: str, token: str, message_data: WidgetMessageCreate):
    """Send message from widget and get AI response"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("conversation_id") != conversation_id:
            raise HTTPException(status_code=403, detail="Invalid session")
        tenant_id = payload.get("tenant_id")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get conversation
    conversation = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Save customer message
    customer_message_id = str(uuid.uuid4())
    customer_message_doc = {
        "id": customer_message_id,
        "conversation_id": conversation_id,
        "author_type": "customer",
        "author_id": payload.get("customer_id"),
        "content": message_data.content,
        "created_at": now
    }
    await db.messages.insert_one(customer_message_doc)
    
    # Update conversation
    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {
                "last_message": message_data.content[:100],
                "last_message_at": now,
                "updated_at": now,
                "status": "open"
            }
        }
    )
    
    # If conversation is in AI mode, generate AI response
    ai_message = None
    if conversation.get("mode") == "ai":
        # Get settings
        settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
        
        # Get recent messages for context
        recent_messages = await db.messages.find(
            {"conversation_id": conversation_id}, {"_id": 0}
        ).sort("created_at", -1).to_list(20)
        recent_messages.reverse()
        
        # Generate AI response (with conversation_id for orchestration support)
        from server import generate_ai_response
        ai_response = await generate_ai_response(recent_messages, settings or {}, conversation_id)
        
        # Save AI message
        ai_now = datetime.now(timezone.utc).isoformat()
        ai_message_id = str(uuid.uuid4())
        ai_message_doc = {
            "id": ai_message_id,
            "conversation_id": conversation_id,
            "author_type": "ai",
            "author_id": None,
            "content": ai_response,
            "created_at": ai_now
        }
        await db.messages.insert_one(ai_message_doc)
        ai_message = {k: v for k, v in ai_message_doc.items() if k != "_id"}
        
        # Update conversation with AI response
        await db.conversations.update_one(
            {"id": conversation_id},
            {
                "$set": {
                    "last_message": ai_response[:100],
                    "last_message_at": ai_now,
                    "updated_at": ai_now
                }
            }
        )
        
        # Check for transfer triggers (human request, AI failure, negative sentiment)
        try:
            # Quick sentiment check on customer message
            sentiment = None
            if len(message_data.content) > 20:  # Only analyze substantial messages
                # Simple negative keyword check for quick trigger
                negative_words = ["angry", "frustrated", "terrible", "horrible", "worst", "hate", "useless", "stupid", "ridiculous"]
                if any(word in message_data.content.lower() for word in negative_words):
                    sentiment = {"tone": -70}
            
            await check_transfer_triggers(
                conversation_id=conversation_id,
                tenant_id=tenant_id,
                customer_message=message_data.content,
                ai_response=ai_response,
                sentiment=sentiment
            )
        except Exception as e:
            print(f"Error checking transfer triggers: {e}")
    
    return {
        "customer_message": {k: v for k, v in customer_message_doc.items() if k != "_id"},
        "ai_message": ai_message
    }

@router.get("/{tenant_id}/agent-info")
async def get_widget_agent_info(tenant_id: str):
    """Get agent information for widget header"""
    try:
        # Get company's agent configuration
        agent_config = await db.company_agent_configs.find_one({"company_id": tenant_id}, {"_id": 0})
        if not agent_config or not agent_config.get("agent_id"):
            return {"name": None, "avatar_url": None}
        
        # Get the agent
        agent = await db.agents.find_one({"id": agent_config["agent_id"], "is_active": True}, {"_id": 0})
        if not agent:
            return {"name": None, "avatar_url": None}
        
        return {
            "name": agent.get("name"),
            "avatar_url": agent.get("avatar_url")
        }
    except Exception as e:
        logger.error(f"Error fetching agent info: {str(e)}")
        return {"name": None, "avatar_url": None}

@router.get("/config/{tenant_id}")
async def get_widget_config(tenant_id: str):
    """Get public widget configuration for embedding"""
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return {
        "brand_name": settings.get("brand_name", "Support"),
        "brand_logo": settings.get("brand_logo"),
        "primary_color": settings.get("primary_color", "#0047AB"),
        "widget_position": settings.get("widget_position", "bottom-right"),
        "widget_theme": settings.get("widget_theme", "light"),
        "welcome_message": settings.get("welcome_message", "Hi! How can we help?")
    }


# --- Verification Endpoints ---

class VerificationRequest(BaseModel):
    email: Optional[str] = None

class OTPVerifyRequest(BaseModel):
    code: str

@router.post("/verify/request/{conversation_id}")
async def request_verification(
    conversation_id: str,
    token: str,
    request_data: VerificationRequest = None
):
    """Request OTP verification for a conversation"""
    from services.verification_service import verification_service
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("conversation_id") != conversation_id:
            raise HTTPException(status_code=403, detail="Invalid session")
        tenant_id = payload.get("tenant_id")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Get conversation to find email
    conversation = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check if already verified
    if conversation.get("email_verified"):
        return {"success": True, "message": "Already verified", "verified": True}
    
    # Get email from request or conversation
    email = None
    if request_data and request_data.email:
        email = request_data.email
        # Update conversation with email
        await db.conversations.update_one(
            {"id": conversation_id},
            {"$set": {"customer_email": email}}
        )
    else:
        email = conversation.get("customer_email")
    
    if not email:
        return {
            "success": False,
            "message": "Please provide your email address to receive a verification code.",
            "requires_email": True
        }
    
    # Create and send OTP
    success, message = await verification_service.create_verification(
        conversation_id=conversation_id,
        email=email,
        tenant_id=tenant_id
    )
    
    return {"success": success, "message": message, "email": email}


@router.post("/verify/confirm/{conversation_id}")
async def confirm_verification(
    conversation_id: str,
    token: str,
    verify_data: OTPVerifyRequest
):
    """Verify OTP code"""
    from services.verification_service import verification_service
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("conversation_id") != conversation_id:
            raise HTTPException(status_code=403, detail="Invalid session")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    success, message = await verification_service.verify_otp(
        conversation_id=conversation_id,
        code=verify_data.code.strip()
    )
    
    return {"success": success, "message": message, "verified": success}


@router.get("/verify/status/{conversation_id}")
async def get_verification_status(conversation_id: str, token: str):
    """Get verification status for a conversation"""
    from services.verification_service import verification_service
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("conversation_id") != conversation_id:
            raise HTTPException(status_code=403, detail="Invalid session")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    status = await verification_service.get_verification_status(conversation_id)
    return status