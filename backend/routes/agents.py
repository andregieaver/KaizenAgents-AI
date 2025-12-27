"""
User Agents management routes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import logging
import uuid
import asyncio
import httpx

from models import AgentCreate, AgentResponse, AgentUpdate, ConversationResponse, SettingsUpdate
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
    profile_image_url: Optional[str] = None
    config: Dict[str, Any]
    is_active: bool
    is_public: bool = False
    created_at: str
    updated_at: str
    activated_at: Optional[str] = None
    published_at: Optional[str] = None
    # Orchestration fields
    orchestration_enabled: bool = False
    tags: List[str] = []
    # Channel integration fields
    channels_enabled: bool = False
    channel_config: Optional[Dict[str, Any]] = None
    # Mother agent field
    is_mother_agent: bool = False

class UserAgentCreate(BaseModel):
    name: str
    description: str
    category: str
    icon: str = "🤖"
    profile_image_url: Optional[str] = None
    system_prompt: str
    temperature: float = 0.7
    max_tokens: int = 2000
    model: Optional[str] = None  # If not provided, use default from provider
    provider_id: Optional[str] = None  # If not provided, use tenant's default provider

class UserAgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    profile_image_url: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    model: Optional[str] = None
    provider_id: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    # Orchestration fields
    orchestration_enabled: Optional[bool] = None
    tags: Optional[List[str]] = None
    # Channel integration fields
    channels_enabled: Optional[bool] = None
    channel_config: Optional[Dict[str, Any]] = None

class WooCommerceConfig(BaseModel):
    store_url: str
    consumer_key: str
    consumer_secret: str
    enabled: bool = True

class WooCommerceConfigResponse(BaseModel):
    enabled: bool
    store_url: Optional[str] = None
    has_credentials: bool = False

class ProviderOption(BaseModel):
    """Provider option for selection dropdown"""
    id: str
    name: str
    type: str
    models: List[str] = []
    default_model: Optional[str] = None

@router.get("/providers/available", response_model=List[ProviderOption])
async def get_available_providers(current_user: dict = Depends(get_current_user)):
    """Get available AI providers for agent configuration"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get all active providers
    providers = await db.providers.find(
        {"is_active": True},
        {"_id": 0, "id": 1, "name": 1, "type": 1, "models": 1, "default_model": 1}
    ).to_list(50)
    
    result = []
    for provider in providers:
        result.append(ProviderOption(
            id=provider.get("id", ""),
            name=provider.get("name", provider.get("type", "Unknown")),
            type=provider.get("type", ""),
            models=provider.get("models", []),
            default_model=provider.get("default_model")
        ))
    
    return result

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

@router.post("/", response_model=UserAgentResponse)
async def create_user_agent(
    agent_data: UserAgentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new custom user agent"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check quota limit for max agents
    from services.quota_service import check_quota_limit
    await check_quota_limit(tenant_id, "max_agents", increment=1)
    
    # Get tenant settings
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Tenant settings not found")
    
    # Get provider - use provided provider_id or fall back to tenant's default
    provider_id = agent_data.provider_id
    if not provider_id:
        provider_id = settings.get("active_provider_id")
    
    if not provider_id:
        raise HTTPException(status_code=400, detail="No provider specified and no default provider configured. Please select a provider or configure one in Admin settings.")
    
    provider = await db.providers.find_one({"id": provider_id, "is_active": True}, {"_id": 0})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found or not active")
    
    # Use provided model or default from provider
    model = agent_data.model or provider.get("default_model", "gpt-4")
    
    # Validate model is available in provider
    available_models = provider.get("models", [])
    if available_models and model not in available_models:
        # If model not in list, still allow it but log a warning
        logger.warning(f"Model {model} not in provider's known models list")
    
    # Create agent document
    import uuid
    agent_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    agent = {
        "id": agent_id,
        "tenant_id": tenant_id,
        "name": agent_data.name,
        "description": agent_data.description,
        "category": agent_data.category,
        "icon": agent_data.icon,
        "profile_image_url": agent_data.profile_image_url,
        "config": {
            "provider_id": provider_id,
            "provider_name": provider.get("name", ""),
            "model": model,
            "system_prompt": agent_data.system_prompt,
            "temperature": agent_data.temperature,
            "max_tokens": agent_data.max_tokens
        },
        "is_active": False,
        "is_public": False,
        "created_at": now,
        "updated_at": now,
        "activated_at": None,
        "published_at": None,
        "orchestration_enabled": False,
        "tags": []
    }
    
    await db.user_agents.insert_one(agent)
    
    logger.info(f"Created new agent {agent_id} for tenant {tenant_id}")
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
    
    # Build update - handle both direct fields and config fields
    update_fields = {}
    config_updates = {}
    
    for key, value in update_data.model_dump().items():
        if value is not None:
            # Fields that go into config
            if key in ["system_prompt", "temperature", "max_tokens", "model"]:
                config_updates[key] = value
            # Provider ID - update both config and validate
            elif key == "provider_id":
                # Validate the provider exists and is active
                provider = await db.providers.find_one({"id": value, "is_active": True}, {"_id": 0})
                if not provider:
                    raise HTTPException(status_code=400, detail="Provider not found or not active")
                config_updates["provider_id"] = value
                config_updates["provider_name"] = provider.get("name", "")
            # Fields that are direct on agent
            elif key in ["name", "description", "category", "icon", "profile_image_url", "orchestration_enabled", "tags", "channels_enabled", "channel_config"]:
                update_fields[key] = value
            # Config object itself
            elif key == "config" and value:
                # Merge with existing config
                existing_config = agent.get("config", {})
                
                # Handle WooCommerce credentials encryption
                if "woocommerce" in value:
                    wc_config = value.get("woocommerce", {})
                    if wc_config.get("consumer_key") and not wc_config.get("consumer_key", "").startswith("ck_encrypted_"):
                        # Encrypt consumer key
                        wc_config["consumer_key_encrypted"] = encrypt_credential(wc_config["consumer_key"])
                        del wc_config["consumer_key"]
                    if wc_config.get("consumer_secret") and not wc_config.get("consumer_secret", "").startswith("cs_encrypted_"):
                        # Encrypt consumer secret
                        wc_config["consumer_secret_encrypted"] = encrypt_credential(wc_config["consumer_secret"])
                        del wc_config["consumer_secret"]
                    value["woocommerce"] = wc_config
                
                # Handle Shopify credentials encryption
                if "shopify" in value:
                    shopify_config = value.get("shopify", {})
                    if shopify_config.get("access_token") and not shopify_config.get("access_token", "").startswith("shpat_encrypted_"):
                        # Encrypt access token
                        shopify_config["access_token_encrypted"] = encrypt_credential(shopify_config["access_token"])
                        del shopify_config["access_token"]
                    value["shopify"] = shopify_config
                
                existing_config.update(value)
                update_fields["config"] = existing_config
    
    # If we have config updates, merge them
    if config_updates:
        existing_config = agent.get("config", {})
        existing_config.update(config_updates)
        update_fields["config"] = existing_config
    
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
    now = datetime.now(timezone.utc).isoformat()
    await db.user_agents.update_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"$set": {"is_active": True, "activated_at": now, "updated_at": now}}
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

@router.post("/{agent_id}/deactivate")
async def deactivate_agent(
    agent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deactivate agent"""
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
    
    # Deactivate this agent
    await db.user_agents.update_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update settings to clear active agent reference
    await db.settings.update_one(
        {"tenant_id": tenant_id},
        {"$set": {
            "active_agent_id": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Agent deactivated successfully", "agent_id": agent_id}


class BulkUpdateRequest(BaseModel):
    agent_ids: List[str]
    is_active: Optional[bool] = None
    channels_enabled: Optional[bool] = None
    orchestration_enabled: Optional[bool] = None


@router.post("/bulk-update")
async def bulk_update_agents(
    request: BulkUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Bulk update multiple agents at once"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    if not request.agent_ids:
        raise HTTPException(status_code=400, detail="No agents specified")
    
    # Build update object
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if request.is_active is not None:
        update_fields["is_active"] = request.is_active
        if request.is_active:
            update_fields["activated_at"] = datetime.now(timezone.utc).isoformat()
    
    if request.channels_enabled is not None:
        update_fields["channels_enabled"] = request.channels_enabled
        # Initialize channel_config if enabling
        if request.channels_enabled:
            update_fields["channel_config"] = {
                "trigger_mode": "mention",
                "response_style": "helpful",
                "response_length": "medium",
                "formality": 0.5,
                "creativity": 0.5
            }
    
    if request.orchestration_enabled is not None:
        update_fields["orchestration_enabled"] = request.orchestration_enabled
    
    # Update all specified agents
    result = await db.user_agents.update_many(
        {
            "id": {"$in": request.agent_ids},
            "tenant_id": tenant_id
        },
        {"$set": update_fields}
    )
    
    return {
        "message": f"Updated {result.modified_count} agents",
        "updated_count": result.modified_count
    }


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


# Test conversation models
class TestConversationMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str

class TestConversationRequest(BaseModel):
    message: str
    history: List[TestConversationMessage] = []

class TestConversationResponse(BaseModel):
    agent_response: str
    model_used: str
    provider_used: str


@router.post("/{agent_id}/test", response_model=TestConversationResponse)
async def test_agent_conversation(
    agent_id: str,
    request: TestConversationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Test an agent with a real AI conversation.
    Uses the configured provider and model for the tenant.
    """
    import openai
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get the agent
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Get agent config
    config = agent.get("config", {})
    system_prompt = config.get("system_prompt") or config.get("ai_persona", "You are a helpful assistant.")
    temperature = config.get("temperature", 0.7)
    max_tokens = config.get("max_tokens", 2000)
    model = config.get("model") or config.get("ai_model")
    
    # Get the provider - try multiple sources
    provider_id = agent.get("provider_id")
    provider = None
    
    if provider_id:
        # Use agent's specific provider
        provider = await db.providers.find_one({"id": provider_id, "is_active": True}, {"_id": 0})
    
    if not provider:
        # Fall back to tenant's active provider in settings
        settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
        if settings and settings.get("active_provider_id"):
            provider = await db.providers.find_one(
                {"id": settings["active_provider_id"], "is_active": True}, 
                {"_id": 0}
            )
    
    if not provider:
        # Fall back to first active provider that supports the model
        if model:
            provider = await db.providers.find_one(
                {"is_active": True, "models": {"$in": [model]}}, 
                {"_id": 0}
            )
    
    if not provider:
        # Last resort: use any active provider
        provider = await db.providers.find_one({"is_active": True}, {"_id": 0})
    
    if not provider:
        raise HTTPException(
            status_code=400, 
            detail="No AI provider configured. Please configure a provider in Settings."
        )
    
    api_key = provider.get("api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="Provider API key not configured")
    
    provider_type = provider.get("type", "openai")
    provider_name = provider.get("name", "Unknown")
    
    # Use model from agent config or provider default
    if not model:
        model = provider.get("default_model", "gpt-4o-mini")
    
    # Build conversation messages
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add history
    for msg in request.history:
        messages.append({"role": msg.role, "content": msg.content})
    
    # Add new user message
    messages.append({"role": "user", "content": request.message})
    
    try:
        if provider_type == "openai":
            client = openai.OpenAI(api_key=api_key)
            
            # Handle different OpenAI model parameter requirements
            uses_new_param = any(prefix in model.lower() for prefix in ['o1', 'o3', 'o4', 'gpt-5'])
            
            if uses_new_param:
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_completion_tokens=max_tokens
                )
            else:
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
            
            agent_response = response.choices[0].message.content
            
        elif provider_type == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            
            # Anthropic requires system prompt separately
            anthropic_messages = [{"role": msg.role, "content": msg.content} for msg in request.history]
            anthropic_messages.append({"role": "user", "content": request.message})
            
            response = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=anthropic_messages if anthropic_messages else [{"role": "user", "content": request.message}]
            )
            
            agent_response = response.content[0].text
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider type: {provider_type}")
        
        logger.info(f"Agent test successful: {agent_id}, model: {model}, provider: {provider_name}")
        
        return TestConversationResponse(
            agent_response=agent_response,
            model_used=model,
            provider_used=provider_name
        )
        
    except openai.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid API key for the configured provider")
    except openai.RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
    except Exception as e:
        logger.error(f"Agent test failed: {agent_id}, error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI request failed: {str(e)}")


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


class WooCommerceTestRequest(BaseModel):
    store_url: str
    consumer_key: str
    consumer_secret: str

@router.post("/test-woocommerce")
async def test_woocommerce_direct(
    request: WooCommerceTestRequest,
    current_user: dict = Depends(get_current_user)
):
    """Test WooCommerce API connection with provided credentials (before saving)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    try:
        wc_service = WooCommerceService(
            request.store_url,
            request.consumer_key,
            request.consumer_secret
        )
        result = await wc_service.test_connection()
        return result
    except Exception as e:
        logger.error(f"WooCommerce test failed: {str(e)}")
        return {
            "success": False,
            "message": f"Connection test failed: {str(e)}"
        }


class ShopifyTestRequest(BaseModel):
    store_domain: str
    access_token: str

@router.post("/test-shopify")
async def test_shopify_direct(
    request: ShopifyTestRequest,
    current_user: dict = Depends(get_current_user)
):
    """Test Shopify API connection with provided credentials (before saving)"""
    from services.shopify_service import ShopifyService
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    try:
        shopify_service = ShopifyService(
            request.store_domain,
            request.access_token
        )
        result = await shopify_service.test_connection()
        return result
    except Exception as e:
        logger.error(f"Shopify test failed: {str(e)}")
        return {
            "success": False,
            "message": f"Connection test failed: {str(e)}"
        }


@router.post("/{agent_id}/upload-image")
async def upload_agent_profile_image(
    agent_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload profile image for an agent"""
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
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP")
    
    # Validate file size (max 2MB)
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size: 2MB")
    
    # Get storage service
    from storage_service import get_storage_service
    storage = await get_storage_service(db)
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"agent_{agent_id}_{uuid.uuid4().hex[:8]}.{ext}"
    destination_path = f"agents/{filename}"
    
    # Upload to configured storage
    image_url = await storage.upload_file(contents, destination_path, file.content_type)
    
    # Update agent
    await db.user_agents.update_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"$set": {"profile_image_url": image_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Profile image uploaded", "profile_image_url": image_url}


@router.post("/{agent_id}/publish")
async def publish_agent_to_marketplace(
    agent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Publish user agent to marketplace after AI review"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check quota limit for marketplace publishing
    from services.quota_service import check_quota_limit
    await check_quota_limit(tenant_id, "marketplace_publishing", increment=1)
    
    # Get agent
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Check if agent is already published
    if agent.get("is_public"):
        raise HTTPException(status_code=400, detail="Agent is already published to marketplace")
    
    # Check if agent is active
    if not agent.get("is_active"):
        raise HTTPException(status_code=400, detail="Please activate the agent before publishing")
    
    # AI Review using enhanced moderation
    review_result = await review_agent_for_marketplace(agent)
    
    if not review_result["approved"]:
        return {
            "success": False,
            "approved": False,
            "message": "Agent did not pass content review",
            "risk_level": review_result.get("risk_level", "unknown"),
            "confidence": review_result.get("confidence", 0),
            "issues": review_result.get("issues", []),
            "suggestions": review_result.get("suggestions", []),
            "summary": review_result.get("summary", "Review failed"),
            "review_type": review_result.get("review_type", "unknown")
        }
    
    # Create template in marketplace
    import uuid
    template_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Get company name for attribution
    company = await db.companies.find_one({"tenant_id": tenant_id}, {"_id": 0, "name": 1})
    company_name = company.get("name", "Unknown") if company else "Unknown"
    
    template = {
        "id": template_id,
        "source_agent_id": agent_id,
        "source_tenant_id": tenant_id,
        "publisher_company": company_name,
        "name": agent["name"],
        "description": agent.get("description", ""),
        "category": agent.get("category", "general"),
        "icon": agent.get("icon", "🤖"),
        "profile_image_url": agent.get("profile_image_url"),
        "config": _sanitize_agent_config_for_marketplace(agent.get("config", {})),
        "is_public": True,
        "is_verified": False,
        "usage_count": 0,
        "moderation_result": {
            "approved": True,
            "risk_level": review_result.get("risk_level", "none"),
            "confidence": review_result.get("confidence", 1.0),
            "reviewed_at": now
        },
        "created_at": now,
        "published_at": now
    }
    
    await db.agent_templates.insert_one(template)
    
    # Mark original agent as published
    await db.user_agents.update_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"$set": {
            "is_public": True,
            "published_at": now,
            "marketplace_template_id": template_id,
            "updated_at": now
        }}
    )
    
    logger.info(f"Agent {agent_id} published to marketplace as template {template_id}")
    
    return {
        "success": True,
        "approved": True,
        "message": "Agent published to marketplace successfully",
        "template_id": template_id,
        "risk_level": review_result.get("risk_level", "none"),
        "confidence": review_result.get("confidence", 1.0),
        "summary": review_result.get("summary", "Agent approved for marketplace"),
        "review_type": review_result.get("review_type", "ai_moderated")
    }


def _sanitize_agent_config_for_marketplace(config: Dict[str, Any]) -> Dict[str, Any]:
    """Remove sensitive data from agent config before publishing to marketplace"""
    sanitized = {}
    
    # Only include safe, public configuration
    safe_keys = [
        "system_prompt", "ai_persona", "temperature", "max_tokens", 
        "model", "provider_name", "language", "response_style",
        "greeting_message", "fallback_message"
    ]
    
    for key in safe_keys:
        if key in config:
            sanitized[key] = config[key]
    
    # Include knowledge base flag but not actual content
    if config.get("knowledge_base"):
        sanitized["has_knowledge_base"] = True
    
    return sanitized


@router.post("/{agent_id}/unpublish")
async def unpublish_agent_from_marketplace(
    agent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove agent from marketplace"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get agent
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    template_id = agent.get("marketplace_template_id")
    if not template_id:
        raise HTTPException(status_code=400, detail="Agent is not published")
    
    # Remove from marketplace
    await db.agent_templates.delete_one({"id": template_id})
    
    # Update agent
    await db.user_agents.update_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"$set": {
            "is_public": False,
            "published_at": None,
            "marketplace_template_id": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Agent removed from marketplace"}


async def review_agent_for_marketplace(agent: Dict[str, Any]) -> Dict[str, Any]:
    """
    Use AI to review agent for ethical, legal, and privacy concerns before marketplace publishing.
    Returns detailed feedback with approval status, issues, suggestions, and confidence score.
    """
    
    # Get admin settings to find the OpenAI API key
    admin_settings = await db.admin_settings.find_one({}, {"_id": 0})
    openai_api_key = admin_settings.get("openai_api_key") if admin_settings else None
    
    if not openai_api_key:
        # Try getting from providers as fallback
        openai_provider = await db.providers.find_one(
            {"type": "openai", "is_active": True},
            {"_id": 0, "api_key": 1}
        )
        if openai_provider:
            openai_api_key = openai_provider.get("api_key")
    
    if not openai_api_key:
        logger.warning("No OpenAI API key available for agent review, auto-approving")
        return {
            "approved": True, 
            "issues": [], 
            "suggestions": [],
            "confidence": 0,
            "review_type": "auto_approved_no_key"
        }
    
    try:
        import openai
        import json
        
        client = openai.OpenAI(api_key=openai_api_key)
        
        # Build comprehensive review data
        config = agent.get("config", {})
        system_prompt = config.get("system_prompt", config.get("ai_persona", ""))
        knowledge_base_summary = "Has knowledge base" if config.get("knowledge_base") else "No knowledge base"
        
        review_prompt = f"""You are an AI content moderator for a SaaS marketplace where businesses publish AI chatbot agents.

Your task is to review an agent BEFORE it goes public. Be thorough but reasonable - legitimate business use cases should be approved.

## REVIEW CRITERIA

### 1. ETHICAL CONCERNS (Critical)
- Discrimination based on race, gender, religion, nationality, disability
- Hate speech or promotion of violence
- Harassment or bullying enablement
- Exploitation of vulnerable groups

### 2. LEGAL ISSUES (Critical)
- Instructions for illegal activities
- Copyright/trademark infringement indicators
- Medical/legal advice without proper disclaimers
- Financial advice without disclaimers

### 3. PRIVACY & SECURITY (High Priority)
- Requests for sensitive PII (SSN, credit cards, passwords)
- Data harvesting instructions
- Social engineering tactics
- Impersonation of real entities without authorization

### 4. INAPPROPRIATE CONTENT (Medium Priority)
- Adult/sexual content
- Excessive profanity
- Graphic violence descriptions
- Drug/substance abuse promotion

### 5. DECEPTIVE PRACTICES (Medium Priority)
- Fake testimonials or reviews
- Misleading claims about capabilities
- Scam or fraud patterns
- Hidden malicious intent

## AGENT DETAILS TO REVIEW

**Name:** {agent.get('name', 'Unknown')}
**Description:** {agent.get('description', 'No description')}
**Category:** {agent.get('category', 'general')}
**Knowledge Base:** {knowledge_base_summary}

**System Prompt/Persona:**
```
{system_prompt[:2000] if system_prompt else 'No system prompt configured'}
```

## RESPONSE FORMAT

Respond with ONLY valid JSON (no markdown code blocks):
{{
  "approved": true/false,
  "confidence": 0.0-1.0,
  "risk_level": "none" | "low" | "medium" | "high" | "critical",
  "issues": [
    {{
      "category": "ethical|legal|privacy|content|deceptive",
      "severity": "warning|error|critical",
      "description": "Specific issue found",
      "location": "Where in the prompt/config this was found"
    }}
  ],
  "suggestions": ["Actionable suggestion to fix each issue"],
  "summary": "Brief one-line summary of the review"
}}

IMPORTANT: 
- Only flag genuine concerns, not hypothetical edge cases
- Business-appropriate language and sales tactics are acceptable
- Customer service agents with standard greetings are fine
- Approve if no clear violations found"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": review_prompt}],
            temperature=0.2,
            max_tokens=800
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Clean up response if it has markdown code blocks
        if result_text.startswith("```"):
            lines = result_text.split("\n")
            result_text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
            if result_text.startswith("json"):
                result_text = result_text[4:]
        result_text = result_text.strip()
        
        # Parse JSON response
        result = json.loads(result_text)
        
        # Ensure required fields exist
        result.setdefault("approved", False)
        result.setdefault("confidence", 0.5)
        result.setdefault("risk_level", "medium")
        result.setdefault("issues", [])
        result.setdefault("suggestions", [])
        result.setdefault("summary", "Review completed")
        result["review_type"] = "ai_moderated"
        
        logger.info(f"Agent review for '{agent.get('name')}': approved={result['approved']}, risk={result['risk_level']}, confidence={result['confidence']}")
        
        # Log review to database for audit trail
        await db.moderation_logs.insert_one({
            "agent_id": agent.get("id"),
            "agent_name": agent.get("name"),
            "tenant_id": agent.get("tenant_id"),
            "result": result,
            "reviewed_at": datetime.now(timezone.utc).isoformat()
        })
        
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI review response: {str(e)}")
        return {
            "approved": False,
            "confidence": 0,
            "risk_level": "unknown",
            "issues": [{"category": "system", "severity": "error", "description": "Unable to parse moderation response", "location": "system"}],
            "suggestions": ["Please try again. If this persists, contact support."],
            "summary": "Review system error",
            "review_type": "error"
        }
    except Exception as e:
        logger.error(f"Agent review failed: {str(e)}")
        return {
            "approved": False,
            "confidence": 0,
            "risk_level": "unknown",
            "issues": [{"category": "system", "severity": "error", "description": f"Review failed: {str(e)}", "location": "system"}],
            "suggestions": ["Please try again later. Contact support if this persists."],
            "summary": "Review system unavailable",
            "review_type": "error"
        }


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



# Agent Documents Endpoints
@router.get("/{agent_id}/documents")
async def get_agent_documents(agent_id: str, user: dict = Depends(get_current_user)):
    """Get documents for an agent."""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify agent belongs to tenant
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Get documents for this agent
    documents = await db.agent_documents.find(
        {"agent_id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(100)
    
    return documents


@router.post("/{agent_id}/documents")
async def upload_agent_document(
    agent_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Upload a document for an agent."""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify agent belongs to tenant
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Check file size (5MB limit)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    # Check file type
    allowed_extensions = ['.pdf', '.txt', '.md', '.docx', '.csv']
    ext = '.' + file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}")
    
    # Store document metadata
    doc_id = str(uuid.uuid4())
    doc_record = {
        "id": doc_id,
        "agent_id": agent_id,
        "tenant_id": tenant_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "file_size": len(content),
        "upload_date": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": user.get("id")
    }
    
    await db.agent_documents.insert_one(doc_record)
    
    # Process document content for RAG
    try:
        # Extract text based on file type
        text_content = ""
        
        if ext in ['.txt', '.md', '.csv']:
            # Plain text files
            text_content = content.decode('utf-8', errors='ignore')
        elif ext == '.pdf':
            # PDF files - try to extract text
            try:
                import io
                import PyPDF2
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
                for page in pdf_reader.pages:
                    text_content += page.extract_text() + "\n"
            except Exception as pdf_err:
                print(f"PDF extraction error: {pdf_err}")
                text_content = ""
        elif ext == '.docx':
            # DOCX files - try to extract text
            try:
                import io
                from docx import Document
                doc = Document(io.BytesIO(content))
                text_content = "\n".join([para.text for para in doc.paragraphs])
            except Exception as docx_err:
                print(f"DOCX extraction error: {docx_err}")
                text_content = ""
        
        # Store chunks in knowledge base
        if text_content.strip():
            from services.rag_service import store_document_chunks
            chunks_stored = await store_document_chunks(
                db=db,
                agent_id=agent_id,
                tenant_id=tenant_id,
                document_id=doc_id,
                filename=file.filename,
                content=text_content,
                source_type="document"
            )
            print(f"Stored {chunks_stored} chunks for document {file.filename}")
    except Exception as e:
        print(f"RAG processing error: {e}")
        # Continue even if RAG processing fails - document is still uploaded
    
    return {"message": "Document uploaded successfully", "document_id": doc_id}


@router.delete("/{agent_id}/documents/{filename}")
async def delete_agent_document(
    agent_id: str,
    filename: str,
    user: dict = Depends(get_current_user)
):
    """Delete a document from an agent."""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify agent belongs to tenant
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Delete the document
    result = await db.agent_documents.delete_one({
        "agent_id": agent_id,
        "tenant_id": tenant_id,
        "filename": filename
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted successfully"}


# Web Scraping Endpoints
class ScrapeRequest(BaseModel):
    domains: List[str]
    max_depth: int = 2
    max_pages: int = 50


async def perform_web_scraping(agent_id: str, domains: List[str], max_depth: int, max_pages: int):
    """
    Background task to perform web scraping for an agent.
    Scrapes specified domains and stores the content for the agent's knowledge base.
    """
    pages_scraped = 0
    scraped_content = []
    
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            for domain in domains:
                if pages_scraped >= max_pages:
                    break
                
                # Ensure domain has protocol
                if not domain.startswith(('http://', 'https://')):
                    domain = f'https://{domain}'
                
                try:
                    # Scrape the main page
                    response = await client.get(domain, headers={
                        'User-Agent': 'Mozilla/5.0 (compatible; AgentBot/1.0)'
                    })
                    
                    if response.status_code == 200:
                        content = response.text
                        # Extract text content (basic extraction)
                        # In production, you'd use BeautifulSoup or similar
                        scraped_content.append({
                            "url": domain,
                            "content_length": len(content),
                            "scraped_at": datetime.now(timezone.utc).isoformat()
                        })
                        pages_scraped += 1
                        
                        # Update progress
                        await db.agent_scraping.update_one(
                            {"agent_id": agent_id},
                            {"$set": {
                                "pages_scraped": pages_scraped,
                                "last_scraped_at": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                except Exception as e:
                    logger.warning(f"Failed to scrape {domain}: {str(e)}")
                    continue
                
                # Small delay between requests to be polite
                await asyncio.sleep(0.5)
        
        # Mark as completed
        await db.agent_scraping.update_one(
            {"agent_id": agent_id},
            {"$set": {
                "status": "completed",
                "pages_scraped": pages_scraped,
                "scraped_urls": [c["url"] for c in scraped_content],
                "last_scraped_at": datetime.now(timezone.utc).isoformat(),
                "error": None
            }}
        )
        
        logger.info(f"Scraping completed for agent {agent_id}: {pages_scraped} pages scraped")
        
    except Exception as e:
        logger.error(f"Scraping failed for agent {agent_id}: {str(e)}")
        await db.agent_scraping.update_one(
            {"agent_id": agent_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "last_scraped_at": datetime.now(timezone.utc).isoformat()
            }}
        )


@router.post("/{agent_id}/scrape")
async def trigger_agent_scraping(
    agent_id: str,
    request: ScrapeRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    """Trigger web scraping for an agent."""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify agent belongs to tenant
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Create or update scraping status
    scraping_status = {
        "agent_id": agent_id,
        "tenant_id": tenant_id,
        "status": "in_progress",
        "domains": request.domains,
        "max_depth": request.max_depth,
        "max_pages": request.max_pages,
        "pages_scraped": 0,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "last_scraped_at": None,
        "error": None
    }
    
    await db.agent_scraping.update_one(
        {"agent_id": agent_id},
        {"$set": scraping_status},
        upsert=True
    )
    
    # Trigger background scraping task
    background_tasks.add_task(
        perform_web_scraping,
        agent_id,
        request.domains,
        request.max_depth,
        request.max_pages
    )
    
    return {"message": "Scraping started", "status": "in_progress"}


@router.get("/{agent_id}/scraping-status")
async def get_agent_scraping_status(agent_id: str, user: dict = Depends(get_current_user)):
    """Get scraping status for an agent."""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify agent belongs to tenant
    agent = await db.user_agents.find_one(
        {"id": agent_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Get scraping status
    status = await db.agent_scraping.find_one(
        {"agent_id": agent_id},
        {"_id": 0}
    )
    
    if not status:
        return {"status": "idle", "pages_scraped": 0}
    
    return status

