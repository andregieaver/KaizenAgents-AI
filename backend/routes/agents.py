"""
User Agents management routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import logging

from models import *
from middleware import get_current_user
from middleware.database import db
from services.woocommerce_service import encrypt_credential, decrypt_credential, WooCommerceService

router = APIRouter(prefix="/agents", tags=["agents"])
logger = logging.getLogger(__name__)

# Models
class UserAgentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: str
    category: str
    icon: str
    config: Dict[str, Any]
    is_active: bool
    created_at: str
    updated_at: str

class UserAgentUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None

@router.get("/", response_model=List[UserAgentResponse])
async def get_user_agents(current_user: dict = Depends(get_current_user)):
    """Get all user's saved agents"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    agents = await db.user_agents.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return agents

@router.get("/{agent_id}", response_model=UserAgentResponse)
async def get_user_agent(
    agent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific user agent"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return agent

@router.patch("/{agent_id}", response_model=UserAgentResponse)
async def update_user_agent(
    agent_id: str,
    update_data: UserAgentUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user agent configuration"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check agent exists and belongs to user
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Build update
    update_fields = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.user_agents.update_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"$set": update_fields}
    )
    
    # Return updated agent
    updated_agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    return updated_agent

@router.post("/{agent_id}/activate")
async def activate_agent(
    agent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Set agent as active (deactivates all others)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check agent exists
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Deactivate all agents for this tenant
    await db.user_agents.update_many(
        {"tenant_id": tenant_id},
        {"$set": {"is_active": False}}
    )
    
    # Activate this agent
    await db.user_agents.update_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update settings to reference this agent
    await db.settings.update_one(
        {"tenant_id": tenant_id},
        {"$set": {
            "active_agent_id": agent_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Agent activated successfully", "agent_id": agent_id}

@router.delete("/{agent_id}")
async def delete_user_agent(
    agent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a user agent"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check if agent is active
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent.get("is_active"):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete active agent. Please activate another agent first."
        )
    
    # Delete agent
    await db.user_agents.delete_one({"id": agent_id, "tenant_id": tenant_id})
    
    return {"message": "Agent deleted successfully"}
