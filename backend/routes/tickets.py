"""
Tickets API Routes
Manage support tickets escalated from conversations
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from uuid import uuid4
from enum import Enum

import sys
sys.path.append('/app/backend')
from server import db, get_current_user


router = APIRouter(prefix="/tickets", tags=["tickets"])


# =============================================================================
# ENUMS
# =============================================================================

class TicketStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING_ON_CUSTOMER = "waiting_on_customer"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TicketCategory(str, Enum):
    BUG = "bug"
    FEATURE_REQUEST = "feature_request"
    SUPPORT = "support"
    BILLING = "billing"
    TECHNICAL = "technical"
    OTHER = "other"


class EscalationType(str, Enum):
    MANUAL = "manual"
    AI_AUTO = "ai_auto"


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class TicketCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_id: Optional[str] = None
    priority: TicketPriority = TicketPriority.MEDIUM
    category: TicketCategory = TicketCategory.SUPPORT
    assigned_to_user_id: Optional[str] = None
    assigned_to_team_id: Optional[str] = None
    due_date: Optional[str] = None
    conversation_id: Optional[str] = None
    escalation_type: EscalationType = EscalationType.MANUAL


class TicketUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    category: Optional[TicketCategory] = None
    assigned_to_user_id: Optional[str] = None
    assigned_to_team_id: Optional[str] = None
    due_date: Optional[str] = None


class EscalateConversation(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: TicketPriority = TicketPriority.MEDIUM
    category: TicketCategory = TicketCategory.SUPPORT
    assigned_to_user_id: Optional[str] = None
    assigned_to_team_id: Optional[str] = None
    escalation_type: EscalationType = EscalationType.MANUAL


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def check_ticketing_feature(tenant_id: str) -> bool:
    """Check if tenant has ticketing feature enabled"""
    # Check feature gates
    feature_gate = await db.feature_gates.find_one({
        "tenant_id": tenant_id,
        "feature_key": "ticketing"
    })
    
    if feature_gate:
        return feature_gate.get("is_enabled", False)
    
    # Default: check tenant tier (professional and above get ticketing)
    tenant = await db.tenants.find_one({"id": tenant_id})
    if tenant:
        tier = tenant.get("tier", "starter")
        return tier in ["professional", "enterprise", "unlimited"]
    
    return False


async def get_ticket_stats(tenant_id: str) -> dict:
    """Get ticket statistics for a tenant"""
    pipeline = [
        {"$match": {"tenant_id": tenant_id}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    
    results = await db.tickets.aggregate(pipeline).to_list(100)
    
    stats = {
        "total": 0,
        "open": 0,
        "in_progress": 0,
        "waiting_on_customer": 0,
        "resolved": 0,
        "closed": 0
    }
    
    for r in results:
        status = r["_id"]
        count = r["count"]
        stats["total"] += count
        if status in stats:
            stats[status] = count
    
    # Get priority breakdown
    priority_pipeline = [
        {"$match": {"tenant_id": tenant_id, "status": {"$nin": ["resolved", "closed"]}}},
        {"$group": {
            "_id": "$priority",
            "count": {"$sum": 1}
        }}
    ]
    
    priority_results = await db.tickets.aggregate(priority_pipeline).to_list(100)
    stats["by_priority"] = {r["_id"]: r["count"] for r in priority_results}
    
    return stats


# =============================================================================
# TICKET CRUD ENDPOINTS
# =============================================================================

@router.get("")
async def get_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    assigned_to_user_id: Optional[str] = None,
    assigned_to_team_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get all tickets for the tenant with optional filters"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Build query
    query = {"tenant_id": tenant_id}
    
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if category:
        query["category"] = category
    if assigned_to_user_id:
        query["assigned_to_user_id"] = assigned_to_user_id
    if assigned_to_team_id:
        query["assigned_to_team_id"] = assigned_to_team_id
    
    # Search in title and description
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_email": {"$regex": search, "$options": "i"}}
        ]
    
    # Get tickets with sorting (newest first, then by priority)
    tickets = await db.tickets.find(
        query,
        {"_id": 0}
    ).sort([
        ("priority_order", 1),  # urgent=0, high=1, medium=2, low=3
        ("created_at", -1)
    ]).skip(skip).limit(limit).to_list(limit)
    
    # Get total count for pagination
    total = await db.tickets.count_documents(query)
    
    # Enrich with assigned user/team names
    for ticket in tickets:
        if ticket.get("assigned_to_user_id"):
            user = await db.users.find_one(
                {"id": ticket["assigned_to_user_id"]},
                {"_id": 0, "id": 1, "name": 1, "email": 1, "avatar_url": 1}
            )
            ticket["assigned_user"] = user
        
        if ticket.get("assigned_to_team_id"):
            team = await db.teams.find_one(
                {"id": ticket["assigned_to_team_id"]},
                {"_id": 0, "id": 1, "name": 1}
            )
            ticket["assigned_team"] = team
    
    return {
        "tickets": tickets,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@router.get("/stats")
async def get_tickets_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get ticket statistics for the dashboard"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    stats = await get_ticket_stats(tenant_id)
    return stats


@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific ticket by ID"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    ticket = await db.tickets.find_one(
        {"id": ticket_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Get linked conversation if exists
    if ticket.get("conversation_id"):
        conversation = await db.conversations.find_one(
            {"id": ticket["conversation_id"]},
            {"_id": 0, "id": 1, "customer_name": 1, "customer_email": 1, "status": 1, "created_at": 1}
        )
        ticket["linked_conversation"] = conversation
    
    # Get assigned user details
    if ticket.get("assigned_to_user_id"):
        user = await db.users.find_one(
            {"id": ticket["assigned_to_user_id"]},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "avatar_url": 1}
        )
        ticket["assigned_user"] = user
    
    # Get assigned team details
    if ticket.get("assigned_to_team_id"):
        team = await db.teams.find_one(
            {"id": ticket["assigned_to_team_id"]},
            {"_id": 0, "id": 1, "name": 1}
        )
        ticket["assigned_team"] = team
    
    # Get created by user details
    if ticket.get("created_by_user_id"):
        creator = await db.users.find_one(
            {"id": ticket["created_by_user_id"]},
            {"_id": 0, "id": 1, "name": 1, "email": 1}
        )
        ticket["created_by_user"] = creator
    
    return ticket


@router.post("")
async def create_ticket(
    ticket_data: TicketCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new ticket"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    now = datetime.now(timezone.utc)
    
    # Priority order for sorting (urgent first)
    priority_order = {
        "urgent": 0,
        "high": 1,
        "medium": 2,
        "low": 3
    }
    
    ticket = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "title": ticket_data.title,
        "description": ticket_data.description,
        "customer_name": ticket_data.customer_name,
        "customer_email": ticket_data.customer_email,
        "customer_id": ticket_data.customer_id,
        "status": TicketStatus.OPEN.value,
        "priority": ticket_data.priority.value,
        "priority_order": priority_order.get(ticket_data.priority.value, 2),
        "category": ticket_data.category.value,
        "assigned_to_user_id": ticket_data.assigned_to_user_id,
        "assigned_to_team_id": ticket_data.assigned_to_team_id,
        "due_date": ticket_data.due_date,
        "conversation_id": ticket_data.conversation_id,
        "escalation_type": ticket_data.escalation_type.value,
        "created_by_user_id": current_user.get("id"),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "resolved_at": None,
        "closed_at": None
    }
    
    await db.tickets.insert_one(ticket)
    
    # Remove MongoDB _id before returning
    ticket.pop("_id", None)
    
    return ticket


@router.put("/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    ticket_data: TicketUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a ticket"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check ticket exists
    existing = await db.tickets.find_one(
        {"id": ticket_id, "tenant_id": tenant_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc)
    
    # Build update data
    update_data = {"updated_at": now.isoformat()}
    
    if ticket_data.title is not None:
        update_data["title"] = ticket_data.title
    if ticket_data.description is not None:
        update_data["description"] = ticket_data.description
    if ticket_data.status is not None:
        update_data["status"] = ticket_data.status.value
        # Track resolution/closure times
        if ticket_data.status == TicketStatus.RESOLVED and not existing.get("resolved_at"):
            update_data["resolved_at"] = now.isoformat()
        if ticket_data.status == TicketStatus.CLOSED and not existing.get("closed_at"):
            update_data["closed_at"] = now.isoformat()
    if ticket_data.priority is not None:
        update_data["priority"] = ticket_data.priority.value
        priority_order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
        update_data["priority_order"] = priority_order.get(ticket_data.priority.value, 2)
    if ticket_data.category is not None:
        update_data["category"] = ticket_data.category.value
    if ticket_data.assigned_to_user_id is not None:
        update_data["assigned_to_user_id"] = ticket_data.assigned_to_user_id or None
    if ticket_data.assigned_to_team_id is not None:
        update_data["assigned_to_team_id"] = ticket_data.assigned_to_team_id or None
    if ticket_data.due_date is not None:
        update_data["due_date"] = ticket_data.due_date or None
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": update_data}
    )
    
    updated = await db.tickets.find_one(
        {"id": ticket_id},
        {"_id": 0}
    )
    
    return updated


@router.delete("/{ticket_id}")
async def delete_ticket(
    ticket_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a ticket"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check ticket exists
    existing = await db.tickets.find_one(
        {"id": ticket_id, "tenant_id": tenant_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    await db.tickets.delete_one({"id": ticket_id})
    
    return {"message": "Ticket deleted successfully"}


# =============================================================================
# ESCALATION ENDPOINT
# =============================================================================

@router.post("/escalate/{conversation_id}")
async def escalate_conversation_to_ticket(
    conversation_id: str,
    escalation_data: EscalateConversation,
    current_user: dict = Depends(get_current_user)
):
    """Escalate a conversation to a ticket"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get the conversation
    conversation = await db.conversations.find_one(
        {"id": conversation_id, "tenant_id": tenant_id}
    )
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check if already escalated
    existing_ticket = await db.tickets.find_one(
        {"conversation_id": conversation_id, "tenant_id": tenant_id}
    )
    
    if existing_ticket:
        raise HTTPException(
            status_code=400, 
            detail="This conversation has already been escalated to a ticket",
            headers={"X-Ticket-Id": existing_ticket["id"]}
        )
    
    now = datetime.now(timezone.utc)
    
    priority_order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
    
    ticket = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "title": escalation_data.title,
        "description": escalation_data.description or f"Escalated from conversation with {conversation.get('customer_name', 'Unknown')}",
        "customer_name": conversation.get("customer_name"),
        "customer_email": conversation.get("customer_email"),
        "customer_id": conversation.get("customer_id"),
        "status": TicketStatus.OPEN.value,
        "priority": escalation_data.priority.value,
        "priority_order": priority_order.get(escalation_data.priority.value, 2),
        "category": escalation_data.category.value,
        "assigned_to_user_id": escalation_data.assigned_to_user_id,
        "assigned_to_team_id": escalation_data.assigned_to_team_id,
        "due_date": None,
        "conversation_id": conversation_id,
        "escalation_type": escalation_data.escalation_type.value,
        "created_by_user_id": current_user.get("id"),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "resolved_at": None,
        "closed_at": None
    }
    
    await db.tickets.insert_one(ticket)
    
    # Update conversation to mark as escalated
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {
            "escalated_to_ticket_id": ticket["id"],
            "escalated_at": now.isoformat()
        }}
    )
    
    ticket.pop("_id", None)
    
    return ticket


# =============================================================================
# ASSIGNMENT HELPERS
# =============================================================================

@router.get("/assignees/users")
async def get_assignable_users(
    current_user: dict = Depends(get_current_user)
):
    """Get list of users that can be assigned to tickets"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    users = await db.users.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "avatar_url": 1, "role": 1}
    ).to_list(100)
    
    return users


@router.get("/assignees/teams")
async def get_assignable_teams(
    current_user: dict = Depends(get_current_user)
):
    """Get list of teams that can be assigned to tickets"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    teams = await db.teams.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "id": 1, "name": 1, "description": 1}
    ).to_list(100)
    
    return teams
