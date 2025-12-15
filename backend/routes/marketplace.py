"""
Agent Marketplace routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from models import *
from middleware import get_current_user
from middleware.database import db

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

# Models
class AgentTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: str
    category: str
    icon: str
    config: Dict[str, Any]
    is_public: bool
    usage_count: int
    created_at: str

class UserAgent(BaseModel):
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

class CloneAgentRequest(BaseModel):
    custom_name: Optional[str] = None

@router.get("/", response_model=List[AgentTemplate])
async def get_marketplace_agents(
    category: Optional[str] = None,
    search: Optional[str] = None
):
    """Get all marketplace agent templates (public endpoint)"""
    query = {"is_public": True}
    
    if category and category != "all":
        query["category"] = category
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    templates = await db.agent_templates.find(query, {"_id": 0}).to_list(100)
    return templates

@router.get("/{template_id}", response_model=AgentTemplate)
async def get_agent_template(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific agent template details"""
    template = await db.agent_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Agent template not found")
    
    return template

@router.post("/{template_id}/clone")
async def clone_agent_template(
    template_id: str,
    clone_data: CloneAgentRequest,
    current_user: dict = Depends(get_current_user)
):
    """Clone an agent template to user's workspace"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get template
    template = await db.agent_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Agent template not found")
    
    # Create user agent instance
    now = datetime.now(timezone.utc).isoformat()
    agent_id = str(uuid.uuid4())
    
    user_agent = {
        "id": agent_id,
        "tenant_id": tenant_id,
        "template_id": template_id,
        "name": clone_data.custom_name or template["name"],
        "description": template["description"],
        "category": template["category"],
        "icon": template["icon"],
        "config": template["config"],
        "is_active": False,  # Not active by default
        "created_at": now,
        "updated_at": now
    }
    
    await db.user_agents.insert_one(user_agent)
    
    # Increment usage count
    await db.agent_templates.update_one(
        {"id": template_id},
        {"$inc": {"usage_count": 1}}
    )
    
    return {
        "message": "Agent cloned successfully",
        "agent_id": agent_id,
        "agent": user_agent
    }

@router.get("/categories/list")
async def get_categories(current_user: dict = Depends(get_current_user)):
    """Get all available categories"""
    return {
        "categories": [
            {"value": "all", "label": "All Categories"},
            {"value": "customer_support", "label": "Customer Support"},
            {"value": "sales", "label": "Sales"},
            {"value": "technical", "label": "Technical Support"},
            {"value": "ecommerce", "label": "E-commerce"},
            {"value": "healthcare", "label": "Healthcare"},
            {"value": "hospitality", "label": "Hospitality"},
            {"value": "real_estate", "label": "Real Estate"},
            {"value": "general", "label": "General"}
        ]
    }
