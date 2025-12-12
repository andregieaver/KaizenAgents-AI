"""
Transfers routes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid

from models import *
from middleware import get_current_user, get_super_admin_user
from middleware.database import db

router = APIRouter(prefix="/transfers", tags=["transfers"])

@profile_router.get("/availability")
async def get_availability(current_user: dict = Depends(get_current_user)):
    """Get current user's availability status"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return {"available": user.get("is_available", False)}

@profile_router.post("/availability")
async def set_availability(
    available: bool,
    current_user: dict = Depends(get_current_user)
):
    """Set current user's availability status"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"is_available": available, "availability_updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"available": available}

# Transfer requests collection
transfer_router = APIRouter(prefix="/transfers", tags=["transfers"])

@router.get("/pending")
async def get_pending_transfers(current_user: dict = Depends(get_current_user)):
    """Get pending transfer requests for available agents"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        return {"transfers": []}
    
    # Check if user is available
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not user.get("is_available", False):
        return {"transfers": []}
    
    # Get pending transfers for this tenant
    transfers = await db.transfer_requests.find({
        "tenant_id": tenant_id,
        "status": "pending"
    }, {"_id": 0}).sort("created_at", -1).to_list(10)
    
    return {"transfers": transfers}

@router.post("/{transfer_id}/accept")
async def accept_transfer(
    transfer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Accept a transfer request"""
    transfer = await db.transfer_requests.find_one({"id": transfer_id}, {"_id": 0})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    if transfer["status"] != "pending":
        raise HTTPException(status_code=400, detail="Transfer already handled")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update transfer request
    await db.transfer_requests.update_one(
        {"id": transfer_id},
        {
            "$set": {
                "status": "accepted",
                "accepted_by": current_user["id"],
                "accepted_at": now
            }
        }
    )
    
    # Update conversation to agent mode
    await db.conversations.update_one(
        {"id": transfer["conversation_id"]},
        {
            "$set": {
                "mode": "agent",
                "assigned_agent_id": current_user["id"],
                "updated_at": now
            }
        }
    )
    
    # Add system message
    system_message = {
        "id": str(uuid.uuid4()),
        "conversation_id": transfer["conversation_id"],
        "content": "A human support agent has joined the conversation.",
        "author_type": "system",
        "created_at": now
    }
    await db.messages.insert_one(system_message)
    
    return {"success": True, "conversation_id": transfer["conversation_id"]}

@router.post("/{transfer_id}/decline")
async def decline_transfer(
    transfer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Decline a transfer request"""
    transfer = await db.transfer_requests.find_one({"id": transfer_id}, {"_id": 0})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    # Just remove this user from the request, don't cancel it entirely
    await db.transfer_requests.update_one(
        {"id": transfer_id},
        {"$addToSet": {"declined_by": current_user["id"]}}
    )
    
    return {"success": True}

async def create_transfer_request(conversation_id: str, tenant_id: str, reason: str, summary: str):
    """Create a transfer request for available agents"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if there's already a pending transfer for this conversation
    existing = await db.transfer_requests.find_one({
        "conversation_id": conversation_id,
        "status": "pending"
    })
    if existing:
        return existing
    
    transfer = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "tenant_id": tenant_id,
        "reason": reason,
        "summary": summary,
        "status": "pending",
        "created_at": now,
        "declined_by": []
    }
    
    await db.transfer_requests.insert_one(transfer)
    return transfer

async def check_transfer_triggers(conversation_id: str, tenant_id: str, customer_message: str, ai_response: str, sentiment: dict = None):
    """Check if conversation should be transferred to human agent"""
    
    # Trigger phrases for human request
    human_request_phrases = [
        "talk to human", "speak to human", "human agent", "real person",
        "talk to someone", "speak to someone", "talk to a person",
        "need a human", "want a human", "get me a human",
        "transfer to agent", "live agent", "customer service",
        "speak with representative", "talk to representative"
    ]
    
    message_lower = customer_message.lower()
    
    # Check for explicit human request
    for phrase in human_request_phrases:
        if phrase in message_lower:
            # Get conversation summary
            messages = await db.messages.find(
                {"conversation_id": conversation_id},
                {"_id": 0}
            ).sort("created_at", -1).limit(5).to_list(5)
            
            summary = "Customer has requested to speak with a human agent."
            if messages:
                last_msgs = [m.get("content", "")[:50] for m in reversed(messages[-3:])]
                summary += f" Recent messages: {' | '.join(last_msgs)}"
            
            await create_transfer_request(
                conversation_id=conversation_id,
                tenant_id=tenant_id,
                reason="customer_request",
                summary=summary
            )
            return True
    
    # Check for AI failure indicators in response
    failure_indicators = [
        "i don't have that information",
        "i cannot help with",
        "i'm not able to",
        "outside my knowledge",
        "please contact support",
        "i apologize, but i cannot"
    ]
    
    response_lower = ai_response.lower() if ai_response else ""
    for indicator in failure_indicators:
        if indicator in response_lower:
            messages = await db.messages.find(
                {"conversation_id": conversation_id},
                {"_id": 0}
            ).sort("created_at", -1).limit(5).to_list(5)
            
            summary = "AI was unable to adequately assist the customer."
            if messages:
                last_msgs = [m.get("content", "")[:50] for m in reversed(messages[-3:])]
                summary += f" Topic: {last_msgs[0] if last_msgs else 'Unknown'}"
            
            await create_transfer_request(
                conversation_id=conversation_id,
                tenant_id=tenant_id,
                reason="ai_limitation",
                summary=summary
            )
            return True
    
    # Check sentiment for very negative tone
    if sentiment and sentiment.get("tone", 0) < -60:
        messages = await db.messages.find(
            {"conversation_id": conversation_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(5).to_list(5)
        
        summary = "Customer appears frustrated or upset. Tone analysis indicates negative sentiment."
        
        await create_transfer_request(
            conversation_id=conversation_id,
            tenant_id=tenant_id,
            reason="negative_sentiment",
            summary=summary
        )
        return True
    
    return False

api_router.include_router(transfer_router)