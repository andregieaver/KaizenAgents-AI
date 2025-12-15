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
    # Orchestration fields
    orchestration_enabled: bool = False
    tags: List[str] = []

class UserAgentUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    # Orchestration fields
    orchestration_enabled: Optional[bool] = None
    tags: Optional[List[str]] = None

class WooCommerceConfig(BaseModel):
    store_url: str
    consumer_key: str
    consumer_secret: str
    enabled: bool = True

class WooCommerceConfigResponse(BaseModel):
    enabled: bool
    store_url: Optional[str] = None
    has_credentials: bool = False

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
    
    # Check if agent exists and is active
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


@router.post("/{agent_id}/woocommerce-config")
async def configure_woocommerce(
    agent_id: str,
    wc_config: WooCommerceConfig,
    current_user: dict = Depends(get_current_user)
):
    """Configure WooCommerce integration for an agent"""
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
    
    # Encrypt credentials
    encrypted_key = encrypt_credential(wc_config.consumer_key)
    encrypted_secret = encrypt_credential(wc_config.consumer_secret)
    
    # Update agent config
    config = agent.get("config", {})
    config["woocommerce"] = {
        "enabled": wc_config.enabled,
        "store_url": wc_config.store_url,
        "consumer_key_encrypted": encrypted_key,
        "consumer_secret_encrypted": encrypted_secret
    }
    
    await db.user_agents.update_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {
            "$set": {
                "config": config,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "message": "WooCommerce integration configured successfully",
        "enabled": wc_config.enabled
    }

@router.get("/{agent_id}/woocommerce-config", response_model=WooCommerceConfigResponse)
async def get_woocommerce_config(
    agent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get WooCommerce configuration for an agent"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    wc_config = agent.get("config", {}).get("woocommerce", {})
    
    return {
        "enabled": wc_config.get("enabled", False),
        "store_url": wc_config.get("store_url"),
        "has_credentials": bool(wc_config.get("consumer_key_encrypted"))
    }

@router.post("/{agent_id}/woocommerce-test")
async def test_woocommerce_connection(
    agent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Test WooCommerce API connection"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    wc_config = agent.get("config", {}).get("woocommerce", {})
    
    if not wc_config.get("enabled"):
        raise HTTPException(status_code=400, detail="WooCommerce integration not enabled")
    
    try:
        # Decrypt credentials
        store_url = wc_config.get("store_url")
        consumer_key = decrypt_credential(wc_config.get("consumer_key_encrypted", ""))
        consumer_secret = decrypt_credential(wc_config.get("consumer_secret_encrypted", ""))
        
        # Create client and test
        wc_service = WooCommerceService(store_url, consumer_key, consumer_secret)
        result = await wc_service.test_connection()
        
        return result
    except Exception as e:
        logger.error(f"WooCommerce test failed: {str(e)}")
        return {
            "success": False,
            "message": f"Connection test failed: {str(e)}"
        }

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


# ============== ORCHESTRATION ENDPOINTS ==============

class OrchestrationSettingsUpdate(BaseModel):
    """Update orchestration settings for an agent"""
    orchestration_enabled: Optional[bool] = None
    tags: Optional[List[str]] = None


@router.patch("/{agent_id}/orchestration")
async def update_agent_orchestration_settings(
    agent_id: str,
    settings: OrchestrationSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update orchestration settings for a user agent (child agent config)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check agent exists and belongs to tenant
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Build update
    update_fields = {}
    if settings.orchestration_enabled is not None:
        update_fields["orchestration_enabled"] = settings.orchestration_enabled
    if settings.tags is not None:
        # Normalize tags: lowercase and strip whitespace
        update_fields["tags"] = [tag.lower().strip() for tag in settings.tags if tag.strip()]
    
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.user_agents.update_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"$set": update_fields}
    )
    
    return {"message": "Orchestration settings updated", "agent_id": agent_id}


@router.get("/{agent_id}/orchestration")
async def get_agent_orchestration_settings(
    agent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get orchestration settings for a user agent"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0, "orchestration_enabled": 1, "tags": 1, "name": 1, "id": 1}
    )
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return {
        "id": agent.get("id"),
        "name": agent.get("name"),
        "orchestration_enabled": agent.get("orchestration_enabled", False),
        "tags": agent.get("tags", [])
    }


@router.get("/orchestration/available-children")
async def get_available_child_agents(current_user: dict = Depends(get_current_user)):
    """Get all agents available as children for orchestration (enabled + have tags)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Find all agents that are orchestration-enabled
    agents = await db.user_agents.find(
        {
            "tenant_id": tenant_id,
            "orchestration_enabled": True
        },
        {"_id": 0}
    ).to_list(100)
    
    # Enrich with capability info
    result = []
    for agent in agents:
        capabilities = []
        config = agent.get("config", {})
        
        if config.get("woocommerce", {}).get("enabled"):
            capabilities.append("woocommerce_operations")
        
        result.append({
            "id": agent["id"],
            "name": agent["name"],
            "description": agent.get("description", ""),
            "category": agent.get("category", "general"),
            "tags": agent.get("tags", []),
            "capabilities": capabilities,
            "is_active": agent.get("is_active", False)
        })
    
    return result
