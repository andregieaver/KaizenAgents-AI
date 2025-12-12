from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional, Literal, Dict, Any
import uuid
from datetime import datetime, timezone
import jwt
from datetime import timedelta

# Import from modular structure
from models import *
from middleware import get_current_user, get_super_admin_user, get_admin_or_owner_user
from middleware.database import db
from middleware.auth import create_token, hash_password, verify_password, is_super_admin, JWT_SECRET, JWT_ALGORITHM
from utils import mask_api_key, get_provider_models

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# Create the main app - redirect_slashes=False prevents 307 redirects that lose auth headers
app = FastAPI(title="AI Support Hub API", redirect_slashes=False)

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth", tags=["auth"])
tenants_router = APIRouter(prefix="/tenants", tags=["tenants"])
conversations_router = APIRouter(prefix="/conversations", tags=["conversations"])
settings_router = APIRouter(prefix="/settings", tags=["settings"])
widget_router = APIRouter(prefix="/widget", tags=["widget"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])
users_router = APIRouter(prefix="/users", tags=["users"])
profile_router = APIRouter(prefix="/profile", tags=["profile"])

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== ADDITIONAL RESPONSE MODELS (not yet extracted) ==============
# These models are specific to endpoints and will remain here for now

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

# ============== USER MANAGEMENT MODELS ==============

class UserInvite(BaseModel):
    email: EmailStr
    name: str
    role: Literal["admin", "agent", "viewer"] = "agent"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["owner", "admin", "agent", "viewer"]] = None

class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    avatar_url: Optional[str] = None
    created_at: str
    last_login: Optional[str] = None

# ============== PROFILE MODELS ==============

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class ProfileResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    avatar_url: Optional[str] = None
    tenant_id: Optional[str] = None
    tenant_name: Optional[str] = None
    created_at: str
    is_super_admin: bool = False

# ============== HELPERS ==============

async def get_tenant_settings(tenant_id: str) -> dict:
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    return settings

# ============== LEGACY ALIASES FOR BACKWARDS COMPATIBILITY ==============
# Alias for routes still using old name
get_tenant_admin_user = get_admin_or_owner_user

# ============== AI SERVICE ==============

async def generate_ai_response(messages: List[dict], settings: dict) -> str:
    """Generate AI response using company's configured agent"""
    try:
        # Get tenant_id from settings
        tenant_id = settings.get("tenant_id")
        if not tenant_id:
            return "I apologize, but the AI assistant is not configured yet. Please contact support."
        
        # Get company's agent configuration
        agent_config = await db.company_agent_configs.find_one({"company_id": tenant_id}, {"_id": 0})
        if not agent_config or not agent_config.get("agent_id"):
            return "I apologize, but no AI agent has been configured for your company yet. Please contact your administrator."
        
        # Get the agent
        agent = await db.agents.find_one({"id": agent_config["agent_id"], "is_active": True}, {"_id": 0})
        if not agent:
            return "I apologize, but the configured AI agent is not available. Please contact support."
        
        # Get the provider
        provider = await db.providers.find_one({"id": agent["provider_id"], "is_active": True}, {"_id": 0})
        if not provider:
            return "I apologize, but the AI provider is not available. Please contact support."
        
        # Check if company has any knowledge base (documents or domains)
        has_documents = len(agent_config.get("uploaded_docs", [])) > 0
        has_domains = len(agent_config.get("scraping_domains", [])) > 0
        has_knowledge_base = has_documents or has_domains
        
        # Build enhanced system prompt with STRICT knowledge base enforcement
        brand_name = settings.get("brand_name", "the company")
        
        # Build conversation history first to get latest message
        conversation_messages = []
        for msg in messages[-10:]:  # Last 10 messages for context
            role = "user" if msg.get("author_type") == "customer" else "assistant"
            conversation_messages.append({
                "role": role,
                "content": msg.get("content")
            })
        
        # Get the latest user message for RAG retrieval
        latest_message = conversation_messages[-1]["content"] if conversation_messages else "Hello"
        
        # Retrieve relevant context from RAG if knowledge base exists
        context = ""
        if has_knowledge_base:
            try:
                from rag_service import retrieve_relevant_chunks, format_context_for_agent
                
                # Retrieve relevant chunks using provider's API key
                relevant_chunks = await retrieve_relevant_chunks(
                    query=latest_message,
                    company_id=tenant_id,
                    db=db,
                    api_key=provider["api_key"],
                    top_k=5
                )
                
                if relevant_chunks:
                    context = format_context_for_agent(relevant_chunks)
                    logger.info(f"Retrieved {len(relevant_chunks)} relevant chunks for query")
                else:
                    logger.warning(f"No relevant chunks found for query: {latest_message}")
            except Exception as e:
                logger.error(f"RAG retrieval error: {str(e)}")
                # Continue without context if RAG fails
        
        # START WITH CRITICAL CONSTRAINTS (most important comes first)
        if not has_knowledge_base:
            # NO knowledge base uploaded - reject ALL questions
            base_prompt = f"""Your name is {agent['name']}. You are assisting customers for {brand_name}.

CRITICAL: There is NO knowledge base configured yet. You must respond to ALL customer questions with:
"I don't have access to any company documentation yet. Please contact our support team for assistance."

DO NOT answer any questions. DO NOT use general knowledge. DO NOT be helpful beyond this message.
Your ONLY job is to direct customers to human support."""
        else:
            # Knowledge base exists - inject retrieved context
            base_prompt = f"""Your name is {agent['name']}.

{context}

CRITICAL INSTRUCTIONS (MUST FOLLOW):
1. You may ONLY answer questions using the information provided above from the company's documents.
2. If the answer is not in the provided information, respond EXACTLY: "I don't have that information in my knowledge base. Please contact our support team for assistance."
3. NEVER use general knowledge, world facts, or information outside the provided documents.
4. NEVER mention or refer to the documents, files, or knowledge base in your response. Do not say things like "according to the documents", "based on the files I have", or "in my knowledge base". Simply provide the answer directly as if you naturally know the information.

{agent['system_prompt']}

You are assisting customers for {brand_name}."""
            
            # Add company-specific custom instructions
            if agent_config.get("custom_instructions"):
                base_prompt += f"\n\nCompany instructions:\n{agent_config['custom_instructions']}"
        
        # Remove the latest message from history for proper context building
        history = []
        if len(conversation_messages) > 1:
            for msg in conversation_messages[:-1]:
                history.append(msg)
        
        # Generate response based on provider type
        if provider["type"] == "openai":
            import openai
            client = openai.OpenAI(api_key=provider["api_key"])
            
            # Handle different model requirements
            model_lower = agent["model"].lower()
            newer_models = ["gpt-4o", "gpt-5", "o1", "o3"]
            uses_new_param = any(model_prefix in model_lower for model_prefix in newer_models)
            
            restrictive_models = ["gpt-5", "o1", "o3"]
            is_restrictive = any(model_prefix in model_lower for model_prefix in restrictive_models)
            
            # Build messages
            api_messages = [{"role": "system", "content": base_prompt}]
            api_messages.extend(history)
            api_messages.append({"role": "user", "content": latest_message})
            
            params = {
                "model": agent["model"],
                "messages": api_messages
            }
            
            # Add temperature if supported
            if not is_restrictive:
                params["temperature"] = agent["temperature"]
            
            # Add token limit
            if uses_new_param:
                params["max_completion_tokens"] = agent["max_tokens"]
            else:
                params["max_tokens"] = agent["max_tokens"]
            
            response = client.chat.completions.create(**params)
            return response.choices[0].message.content
        
        elif provider["type"] == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=provider["api_key"])
            
            # Build messages for Anthropic
            api_messages = list(history)
            api_messages.append({"role": "user", "content": latest_message})
            
            response = client.messages.create(
                model=agent["model"],
                max_tokens=agent["max_tokens"],
                temperature=agent["temperature"],
                system=base_prompt,
                messages=api_messages
            )
            return response.content[0].text
        
        else:
            return "I apologize, but the configured AI provider is not supported yet."
        
    except Exception as e:
        logger.error(f"AI generation error: {str(e)}")
        return "I apologize, but I'm having trouble processing your request. Please try again or contact support."

# ============== PUBLIC ROUTES ==============

@app.get("/api/public/platform-info")
async def get_public_platform_info():
    """Get public platform information (no auth required)"""
    try:
        settings = await db.platform_settings.find_one({}, {"_id": 0, "platform_name": 1, "platform_logo": 1})
        return {
            "platform_name": settings.get("platform_name", "AI Support Hub") if settings else "AI Support Hub",
            "platform_logo": settings.get("platform_logo") if settings else None
        }
    except Exception as e:
        logger.error(f"Error fetching public platform info: {str(e)}")
        return {"platform_name": "AI Support Hub", "platform_logo": None}

# ============== AUTH ROUTES ==============
# Moved to routes/auth.py

# @auth_router.post("/register", response_model=dict)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Create tenant for new user
    tenant_id = str(uuid.uuid4())
    tenant_doc = {
        "id": tenant_id,
        "name": f"{user_data.name}'s Workspace",
        "domain": None,
        "created_at": now
    }
    await db.tenants.insert_one(tenant_doc)
    
    # Create default settings for tenant
    settings_id = str(uuid.uuid4())
    settings_doc = {
        "id": settings_id,
        "tenant_id": tenant_id,
        "brand_name": f"{user_data.name}'s Support",
        "brand_logo": None,
        "primary_color": "#0047AB",
        "widget_position": "bottom-right",
        "widget_theme": "light",
        "welcome_message": "Hi! How can we help you today?",
        "ai_persona": "You are a helpful and friendly customer support assistant.",
        "ai_tone": "friendly",
        "openai_api_key": None,
        "ai_model": "gpt-4o-mini",
        "date_format": "MM/DD/YYYY",
        "time_format": "12h",
        "timezone": "UTC",
        "updated_at": now
    }
    await db.settings.insert_one(settings_doc)
    
    # Create user
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "role": "owner",
        "tenant_id": tenant_id,
        "created_at": now
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, tenant_id)
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user_data.email,
            "name": user_data.name,
            "role": "owner",
            "tenant_id": tenant_id,
            "created_at": now
        }
    }

@auth_router.post("/login", response_model=dict)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user.get("tenant_id"))
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "tenant_id": user.get("tenant_id"),
            "created_at": user["created_at"],
            "is_super_admin": is_super_admin(user)
        }
    }

@auth_router.get("/me", response_model=dict)
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "role": current_user["role"],
        "tenant_id": current_user.get("tenant_id"),
        "created_at": current_user["created_at"],
        "is_super_admin": is_super_admin(current_user)
    }

# ============== TENANT ROUTES ==============

@tenants_router.get("/current", response_model=TenantResponse)
async def get_current_tenant(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return tenant

@tenants_router.put("/current", response_model=TenantResponse)
async def update_current_tenant(tenant_data: TenantCreate, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    update_data = {k: v for k, v in tenant_data.model_dump().items() if v is not None}
    
    await db.tenants.update_one({"id": tenant_id}, {"$set": update_data})
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    
    return tenant

# ============== SETTINGS ROUTES ==============

@settings_router.get("", response_model=SettingsResponse)
@settings_router.get("/", response_model=SettingsResponse)
async def get_settings(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    # Mask the API key for security
    if settings.get("openai_api_key"):
        key = settings["openai_api_key"]
        settings["openai_api_key"] = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "****"
    
    return settings

@settings_router.put("", response_model=SettingsResponse)
@settings_router.put("/", response_model=SettingsResponse)
async def update_settings(settings_data: SettingsUpdate, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    update_data = {k: v for k, v in settings_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one({"tenant_id": tenant_id}, {"$set": update_data})
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    
    # Mask the API key for security
    if settings.get("openai_api_key"):
        key = settings["openai_api_key"]
        settings["openai_api_key"] = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "****"
    
    return settings

@settings_router.post("/brand-logo")
async def upload_brand_logo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload brand logo image file"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG")
    
    # Validate file size (max 5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size: 5MB")
    
    # Get storage service
    from storage_service import get_storage_service
    storage = await get_storage_service(db)
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"logo_{tenant_id}_{uuid.uuid4().hex[:8]}.{ext}"
    destination_path = f"logos/{filename}"
    
    # Upload to configured storage
    logo_url = await storage.upload_file(contents, destination_path, file.content_type)
    
    # Update settings
    await db.settings.update_one(
        {"tenant_id": tenant_id},
        {"$set": {"brand_logo": logo_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Brand logo uploaded", "brand_logo": logo_url}

# ============== CONVERSATIONS ROUTES ==============

@conversations_router.get("", response_model=List[ConversationResponse])
@conversations_router.get("/", response_model=List[ConversationResponse])
async def list_conversations(
    conversation_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    query = {"tenant_id": tenant_id}
    if conversation_status:
        query["status"] = conversation_status
    
    conversations = await db.conversations.find(query, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return conversations

@conversations_router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    conversation = await db.conversations.find_one(
        {"id": conversation_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conversation

@conversations_router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(conversation_id: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify conversation belongs to tenant
    conversation = await db.conversations.find_one(
        {"id": conversation_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = await db.messages.find(
        {"conversation_id": conversation_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    return messages

@conversations_router.get("/{conversation_id}/sentiment")
async def get_conversation_sentiment(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get engagement and tone analysis for a conversation"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    conversation = await db.conversations.find_one(
        {"id": conversation_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {
        "engagement": conversation.get("engagement_score", 5),
        "tone": conversation.get("tone_score", 0),  # -100 to 100, 0 is neutral
        "last_analyzed": conversation.get("sentiment_analyzed_at")
    }

@conversations_router.post("/{conversation_id}/analyze-sentiment")
async def analyze_conversation_sentiment(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Analyze conversation sentiment and update engagement/tone scores"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    conversation = await db.conversations.find_one(
        {"id": conversation_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get recent messages
    messages = await db.messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(15).to_list(15)
    messages.reverse()
    
    if not messages:
        return {"engagement": 5, "tone": 0}
    
    # Get agent config for AI provider
    agent_config = await db.company_agent_configs.find_one({"tenant_id": tenant_id}, {"_id": 0})
    agent = None
    if agent_config and agent_config.get("selected_agent_id"):
        agent = await db.agents.find_one({"id": agent_config["selected_agent_id"]}, {"_id": 0})
    
    # Analyze sentiment
    try:
        result = await analyze_sentiment(messages, agent)
        
        # Update conversation with new scores
        now = datetime.now(timezone.utc).isoformat()
        await db.conversations.update_one(
            {"id": conversation_id},
            {
                "$set": {
                    "engagement_score": result["engagement"],
                    "tone_score": result["tone"],
                    "sentiment_analyzed_at": now
                }
            }
        )
        
        return result
    except Exception as e:
        print(f"Error analyzing sentiment: {e}")
        return {"engagement": 5, "tone": 0}

async def analyze_sentiment(messages: list, agent: dict = None) -> dict:
    """Analyze conversation sentiment using AI"""
    
    # Build conversation text for analysis
    conversation_text = ""
    customer_messages = []
    for msg in messages:
        role = "Customer" if msg.get("author_type") == "customer" else "Agent"
        content = msg.get("content", "")
        conversation_text += f"{role}: {content}\n"
        if msg.get("author_type") == "customer":
            customer_messages.append(content)
    
    if not customer_messages:
        return {"engagement": 5, "tone": 0}
    
    system_prompt = """You are an expert conversation analyst. Analyze the following customer support conversation and provide two metrics:

1. ENGAGEMENT (1-10): How engaged is the customer in this conversation?
   - 1-3: Disengaged (short responses, seems distracted, delayed responses)
   - 4-6: Moderately engaged (normal conversation flow)
   - 7-10: Highly engaged (detailed responses, asking questions, showing interest)

2. TONE (-100 to 100): What is the emotional tone of the customer?
   - -100 to -50: Very negative (angry, frustrated, threatening)
   - -50 to -20: Negative (disappointed, annoyed, unhappy)
   - -20 to 20: Neutral
   - 20 to 50: Positive (satisfied, pleased)
   - 50 to 100: Very positive (happy, grateful, enthusiastic)

Respond ONLY with a JSON object in this exact format:
{"engagement": <number 1-10>, "tone": <number -100 to 100>}

Do not include any other text, explanation, or formatting."""

    user_prompt = f"""Analyze this conversation:

{conversation_text}

Focus on the CUSTOMER's messages and behavior. Provide the engagement and tone scores."""

    provider = agent.get("provider", "openai").lower() if agent else "openai"
    model = agent.get("model", "gpt-4o-mini") if agent else "gpt-4o-mini"
    
    try:
        if provider == "openai":
            from emergentintegrations.llm.openai import chat
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=model,
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.3
            )
        elif provider == "anthropic":
            from emergentintegrations.llm.anthropic import chat
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=model,
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.3
            )
        elif provider == "google":
            from emergentintegrations.llm.google import chat
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=model,
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.3
            )
        else:
            return {"engagement": 5, "tone": 0}
        
        # Parse JSON response
        import json
        # Try to extract JSON from the response
        response = response.strip()
        if response.startswith("```"):
            # Remove markdown code blocks
            response = response.split("```")[1]
            if response.startswith("json"):
                response = response[4:]
        
        result = json.loads(response)
        
        # Validate and clamp values
        engagement = max(1, min(10, int(result.get("engagement", 5))))
        tone = max(-100, min(100, int(result.get("tone", 0))))
        
        return {"engagement": engagement, "tone": tone}
        
    except Exception as e:
        print(f"Error in analyze_sentiment: {e}")
        return {"engagement": 5, "tone": 0}

@conversations_router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def add_agent_message(
    conversation_id: str,
    message_data: MessageCreate,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify conversation belongs to tenant
    conversation = await db.conversations.find_one(
        {"id": conversation_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    now = datetime.now(timezone.utc).isoformat()
    message_id = str(uuid.uuid4())
    
    message_doc = {
        "id": message_id,
        "conversation_id": conversation_id,
        "author_type": "agent",
        "author_id": current_user["id"],
        "content": message_data.content,
        "created_at": now
    }
    await db.messages.insert_one(message_doc)
    
    # Update conversation
    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {
                "last_message": message_data.content[:100],
                "last_message_at": now,
                "updated_at": now,
                "status": "waiting"
            }
        }
    )
    
    return {k: v for k, v in message_doc.items() if k != "_id"}

@conversations_router.patch("/{conversation_id}/mode", response_model=ConversationResponse)
async def update_conversation_mode(
    conversation_id: str,
    mode: Literal["ai", "agent", "assisted", "hybrid"],
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get current conversation to check if mode is actually changing
    current_conv = await db.conversations.find_one({"id": conversation_id, "tenant_id": tenant_id})
    if not current_conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    old_mode = current_conv.get("mode", "ai")
    
    # For assisted and agent modes, assign the current user as the agent
    assigned_agent_id = current_user["id"] if mode in ["agent", "assisted"] else None
    
    result = await db.conversations.find_one_and_update(
        {"id": conversation_id, "tenant_id": tenant_id},
        {
            "$set": {
                "mode": mode,
                "assigned_agent_id": assigned_agent_id,
                "updated_at": now
            }
        },
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Add system message if mode actually changed
    if old_mode != mode:
        mode_messages = {
            "ai": "You are now chatting with our AI assistant.",
            "agent": "A human support agent has joined the conversation.",
            "assisted": "A human support agent has joined the conversation.",
            "hybrid": "The conversation is now in hybrid mode."
        }
        
        system_message = {
            "id": str(uuid.uuid4()),
            "conversation_id": conversation_id,
            "content": mode_messages.get(mode, f"Conversation mode changed to {mode}."),
            "author_type": "system",
            "created_at": now
        }
        await db.messages.insert_one(system_message)
    
    # Remove _id before returning
    result.pop("_id", None)
    return result

@conversations_router.post("/{conversation_id}/suggestions")
async def get_ai_suggestions(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate AI response suggestions for assisted mode"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get conversation
    conversation = await db.conversations.find_one({"id": conversation_id, "tenant_id": tenant_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get recent messages for context
    messages = await db.messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    messages.reverse()  # Chronological order
    
    if not messages:
        return {"suggestions": []}
    
    # Get the last customer message
    last_customer_msg = None
    for msg in reversed(messages):
        if msg.get("author_type") == "customer":
            last_customer_msg = msg
            break
    
    if not last_customer_msg:
        return {"suggestions": []}
    
    # Get agent config for this tenant
    agent_config = await db.company_agent_configs.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not agent_config or not agent_config.get("selected_agent_id"):
        return {"suggestions": ["I'll look into this for you.", "Let me check that.", "Thank you for your patience."]}
    
    # Get the agent
    agent = await db.agents.find_one({"id": agent_config["selected_agent_id"]}, {"_id": 0})
    if not agent:
        return {"suggestions": ["I'll look into this for you.", "Let me check that.", "Thank you for your patience."]}
    
    # Get RAG context if available
    rag_context = ""
    try:
        from rag_service import get_rag_context
        rag_context = await get_rag_context(tenant_id, last_customer_msg["content"])
    except Exception as e:
        print(f"RAG context error: {e}")
    
    # Build conversation history for context
    conversation_history = ""
    for msg in messages[-6:]:  # Last 6 messages for context
        role = "Customer" if msg.get("author_type") == "customer" else "Agent"
        conversation_history += f"{role}: {msg.get('content', '')}\n"
    
    # Generate suggestions using AI
    try:
        suggestions = await generate_suggestions(
            agent=agent,
            customer_message=last_customer_msg["content"],
            conversation_history=conversation_history,
            rag_context=rag_context,
            custom_instructions=agent_config.get("custom_instructions", "")
        )
        return {"suggestions": suggestions}
    except Exception as e:
        print(f"Error generating suggestions: {e}")
        return {"suggestions": ["I'll help you with that.", "Let me check this for you.", "Thank you for reaching out."]}

async def generate_suggestions(agent: dict, customer_message: str, conversation_history: str, rag_context: str, custom_instructions: str) -> list:
    """Generate 3 AI response suggestions"""
    
    system_prompt = f"""You are an AI assistant helping a human support agent respond to customers.
Based on the conversation context, generate exactly 3 different response suggestions.
Each suggestion should be:
- Professional and helpful
- Concise (1-2 sentences max)
- Different in tone/approach from the others

{f'Knowledge base context: {rag_context}' if rag_context else ''}
{f'Custom instructions: {custom_instructions}' if custom_instructions else ''}

Respond with exactly 3 suggestions, one per line, numbered 1-3. Do not include any other text."""

    user_prompt = f"""Recent conversation:
{conversation_history}

Generate 3 response suggestions for the agent to reply to the customer's last message: "{customer_message}"
"""

    provider = agent.get("provider", "openai").lower()
    model = agent.get("model", "gpt-4o-mini")
    
    try:
        if provider == "openai":
            from emergentintegrations.llm.openai import chat
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=model,
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.7
            )
        elif provider == "anthropic":
            from emergentintegrations.llm.anthropic import chat
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=model,
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.7
            )
        elif provider == "google":
            from emergentintegrations.llm.google import chat
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=model,
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.7
            )
        else:
            return ["I'll help you with that.", "Let me look into this.", "Thank you for your patience."]
        
        # Parse response into 3 suggestions
        lines = response.strip().split('\n')
        suggestions = []
        for line in lines:
            # Remove numbering like "1.", "1)", "1:" etc.
            cleaned = line.strip()
            if cleaned:
                # Remove common prefixes
                for prefix in ['1.', '2.', '3.', '1)', '2)', '3)', '1:', '2:', '3:']:
                    if cleaned.startswith(prefix):
                        cleaned = cleaned[len(prefix):].strip()
                        break
                if cleaned:
                    suggestions.append(cleaned)
        
        # Ensure we have exactly 3 suggestions
        while len(suggestions) < 3:
            suggestions.append("Let me help you with that.")
        
        return suggestions[:3]
        
    except Exception as e:
        print(f"Error in generate_suggestions: {e}")
        return ["I'll help you with that.", "Let me look into this.", "Thank you for your patience."]

@conversations_router.patch("/{conversation_id}/status", response_model=ConversationResponse)
async def update_conversation_status(
    conversation_id: str,
    new_status: Literal["open", "waiting", "resolved"],
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.conversations.find_one_and_update(
        {"id": conversation_id, "tenant_id": tenant_id},
        {"$set": {"status": new_status, "updated_at": now}},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    result.pop("_id", None)
    return result

# ============== WIDGET (PUBLIC) ROUTES ==============

@app.get("/api/widget/{tenant_id}/settings")
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

@widget_router.post("/session", response_model=WidgetSessionResponse)
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
    
    conversation_doc = {
        "id": conversation_id,
        "tenant_id": tenant_id,
        "customer_id": customer_id,
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

@widget_router.get("/messages/{conversation_id}")
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

@widget_router.post("/messages/{conversation_id}")
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
        
        # Generate AI response
        ai_response = await generate_ai_response(recent_messages, settings or {})
        
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

@widget_router.get("/{tenant_id}/agent-info")
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

@widget_router.get("/config/{tenant_id}")
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

# ============== STATS ROUTE ==============

@api_router.get("/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get conversation counts
    total_conversations = await db.conversations.count_documents({"tenant_id": tenant_id})
    open_conversations = await db.conversations.count_documents({"tenant_id": tenant_id, "status": "open"})
    resolved_conversations = await db.conversations.count_documents({"tenant_id": tenant_id, "status": "resolved"})
    
    # Get recent conversations
    recent = await db.conversations.find(
        {"tenant_id": tenant_id}, {"_id": 0}
    ).sort("updated_at", -1).to_list(5)
    
    return {
        "total_conversations": total_conversations,
        "open_conversations": open_conversations,
        "resolved_conversations": resolved_conversations,
        "ai_handled_rate": 85,  # Placeholder
        "avg_response_time": "< 1 min",
        "recent_conversations": recent
    }

# ============== SUPER ADMIN ROUTES ==============

class PlatformSettingsUpdate(BaseModel):
    platform_name: Optional[str] = None
    platform_logo: Optional[str] = None
    maintenance_mode: Optional[bool] = None
    max_tenants: Optional[int] = None
    default_ai_model: Optional[str] = None
    announcement: Optional[str] = None

class TenantAdminUpdate(BaseModel):
    is_active: Optional[bool] = None
    max_conversations: Optional[int] = None
    features: Optional[List[str]] = None

@admin_router.get("/check")
async def check_super_admin(current_user: dict = Depends(get_current_user)):
    """Check if current user is super admin"""
    return {"is_super_admin": is_super_admin(current_user)}

@admin_router.get("/platform-stats")
async def get_platform_stats(admin_user: dict = Depends(get_super_admin_user)):
    """Get platform-wide statistics (super admin only)"""
    total_tenants = await db.tenants.count_documents({})
    total_users = await db.users.count_documents({})
    total_conversations = await db.conversations.count_documents({})
    total_messages = await db.messages.count_documents({})
    
    # Get active tenants (with conversations in last 7 days)
    from datetime import timedelta
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    active_conversations = await db.conversations.count_documents({"updated_at": {"$gte": week_ago}})
    
    # Get tenant breakdown
    tenants = await db.tenants.find({}, {"_id": 0}).to_list(100)
    tenant_stats = []
    for tenant in tenants:
        conv_count = await db.conversations.count_documents({"tenant_id": tenant["id"]})
        user_count = await db.users.count_documents({"tenant_id": tenant["id"]})
        tenant_stats.append({
            "id": tenant["id"],
            "name": tenant["name"],
            "conversations": conv_count,
            "users": user_count,
            "created_at": tenant["created_at"]
        })
    
    return {
        "total_tenants": total_tenants,
        "total_users": total_users,
        "total_conversations": total_conversations,
        "total_messages": total_messages,
        "active_conversations_7d": active_conversations,
        "tenants": tenant_stats
    }

@admin_router.get("/platform-settings")
async def get_platform_settings(admin_user: dict = Depends(get_super_admin_user)):
    """Get platform settings (super admin only)"""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    if not settings:
        # Return default settings
        settings = {
            "id": "platform",
            "platform_name": "AI Support Hub",
            "maintenance_mode": False,
            "max_tenants": 1000,
            "default_ai_model": "gpt-4o-mini",
            "announcement": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.platform_settings.insert_one(settings)
    return settings

@admin_router.put("/platform-settings")
async def update_platform_settings(
    settings_data: PlatformSettingsUpdate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Update platform settings (super admin only)"""
    update_data = {k: v for k, v in settings_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.platform_settings.update_one(
        {"id": "platform"},
        {"$set": update_data},
        upsert=True
    )
    
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    return settings

@admin_router.post("/platform-logo")
async def upload_platform_logo(
    file: UploadFile = File(...),
    admin_user: dict = Depends(get_super_admin_user)
):
    """Upload platform logo image file (super admin only)"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG")
    
    # Validate file size (max 5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size: 5MB")
    
    # Get storage service
    from storage_service import get_storage_service
    storage = await get_storage_service(db)
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"platform_logo_{uuid.uuid4().hex[:8]}.{ext}"
    destination_path = f"platform/{filename}"
    
    # Upload to configured storage
    logo_url = await storage.upload_file(contents, destination_path, file.content_type)
    
    # Update platform settings
    await db.platform_settings.update_one(
        {"id": "platform"},
        {"$set": {"platform_logo": logo_url, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"message": "Platform logo uploaded", "platform_logo": logo_url}

@admin_router.get("/tenants")
async def list_all_tenants(admin_user: dict = Depends(get_super_admin_user)):
    """List all tenants (super admin only)"""
    tenants = await db.tenants.find({}, {"_id": 0}).to_list(1000)
    
    # Enrich with stats
    enriched_tenants = []
    for tenant in tenants:
        settings = await db.settings.find_one({"tenant_id": tenant["id"]}, {"_id": 0})
        conv_count = await db.conversations.count_documents({"tenant_id": tenant["id"]})
        user_count = await db.users.count_documents({"tenant_id": tenant["id"]})
        
        enriched_tenants.append({
            **tenant,
            "conversation_count": conv_count,
            "user_count": user_count,
            "has_api_key": bool(settings and settings.get("openai_api_key")),
            "brand_name": settings.get("brand_name") if settings else None,
            "brand_logo": settings.get("brand_logo") if settings else None
        })
    
    return enriched_tenants

@admin_router.get("/tenants/{tenant_id}")
async def get_tenant_details(tenant_id: str, admin_user: dict = Depends(get_super_admin_user)):
    """Get detailed tenant info (super admin only)"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    users = await db.users.find({"tenant_id": tenant_id}, {"_id": 0, "password_hash": 0}).to_list(100)
    conversations = await db.conversations.find({"tenant_id": tenant_id}, {"_id": 0}).sort("updated_at", -1).to_list(50)
    
    return {
        "tenant": tenant,
        "settings": settings,
        "users": users,
        "recent_conversations": conversations,
        "stats": {
            "total_users": len(users),
            "total_conversations": await db.conversations.count_documents({"tenant_id": tenant_id}),
            "open_conversations": await db.conversations.count_documents({"tenant_id": tenant_id, "status": "open"}),
            "total_messages": await db.messages.count_documents({"conversation_id": {"$in": [c["id"] for c in conversations]}})
        }
    }

@admin_router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, admin_user: dict = Depends(get_super_admin_user)):
    """Delete a tenant and all associated data (super admin only)"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Delete all associated data
    conversations = await db.conversations.find({"tenant_id": tenant_id}, {"id": 1}).to_list(10000)
    conv_ids = [c["id"] for c in conversations]
    
    await db.messages.delete_many({"conversation_id": {"$in": conv_ids}})
    await db.conversations.delete_many({"tenant_id": tenant_id})
    await db.settings.delete_many({"tenant_id": tenant_id})
    await db.users.delete_many({"tenant_id": tenant_id})
    await db.tenants.delete_one({"id": tenant_id})
    
    return {"message": f"Tenant {tenant_id} and all associated data deleted"}

@admin_router.get("/users")
async def list_all_users(admin_user: dict = Depends(get_super_admin_user)):
    """List all users across all tenants (super admin only)"""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    # Enrich with tenant names
    enriched_users = []
    for user in users:
        tenant = await db.tenants.find_one({"id": user.get("tenant_id")}, {"_id": 0, "name": 1})
        enriched_users.append({
            **user,
            "tenant_name": tenant.get("name") if tenant else "No tenant",
            "is_super_admin": is_super_admin(user)
        })
    
    return enriched_users

@admin_router.post("/users/{user_id}/make-super-admin")
async def make_super_admin(user_id: str, admin_user: dict = Depends(get_super_admin_user)):
    """Grant super admin role to a user (super admin only)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one({"id": user_id}, {"$set": {"role": "super_admin"}})
    return {"message": f"User {user['email']} is now a super admin"}

@admin_router.post("/users/{user_id}/revoke-super-admin")
async def revoke_super_admin(user_id: str, admin_user: dict = Depends(get_super_admin_user)):
    """Revoke super admin role from a user (super admin only)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot revoke from the primary super admin
    if user.get("email") == SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Cannot revoke super admin from primary admin")
    
    await db.users.update_one({"id": user_id}, {"$set": {"role": "owner"}})
    return {"message": f"Super admin revoked from {user['email']}"}

# ============== TENANT USER MANAGEMENT ROUTES ==============

@users_router.get("", response_model=List[TeamMemberResponse])
@users_router.get("/", response_model=List[TeamMemberResponse])
async def list_team_members(current_user: dict = Depends(get_current_user)):
    """List all users in the current tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    users = await db.users.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", 1).to_list(100)
    
    return users

@users_router.post("/invite", response_model=TeamMemberResponse)
async def invite_user(
    user_data: UserInvite,
    admin_user: dict = Depends(get_tenant_admin_user)
):
    """Invite a new user to the tenant (admin only)"""
    tenant_id = admin_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    now = datetime.now(timezone.utc).isoformat()
    user_id = str(uuid.uuid4())
    
    # Generate a temporary password (user should reset)
    temp_password = str(uuid.uuid4())[:12]
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(temp_password),
        "name": user_data.name,
        "role": user_data.role,
        "tenant_id": tenant_id,
        "avatar_url": None,
        "created_at": now,
        "last_login": None,
        "invited_by": admin_user["id"],
        "requires_password_reset": True
    }
    await db.users.insert_one(user_doc)
    
    # Return user without sensitive data
    return {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "avatar_url": None,
        "created_at": now,
        "last_login": None,
        "temp_password": temp_password  # Return this once so admin can share with user
    }

@users_router.get("/{user_id}", response_model=TeamMemberResponse)
async def get_team_member(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific team member"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    user = await db.users.find_one(
        {"id": user_id, "tenant_id": tenant_id},
        {"_id": 0, "password_hash": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@users_router.patch("/{user_id}", response_model=TeamMemberResponse)
async def update_team_member(
    user_id: str,
    user_data: UserUpdate,
    admin_user: dict = Depends(get_tenant_admin_user)
):
    """Update a team member (admin only)"""
    tenant_id = admin_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Find the user
    user = await db.users.find_one({"id": user_id, "tenant_id": tenant_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot change owner's role if you're not owner
    if user.get("role") == "owner" and admin_user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Cannot modify owner")
    
    # Cannot make yourself non-admin
    if user_id == admin_user["id"] and user_data.role and user_data.role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Cannot demote yourself")
    
    update_data = {k: v for k, v in user_data.model_dump().items() if v is not None}
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0}
    )
    return updated_user

@users_router.delete("/{user_id}")
async def remove_team_member(
    user_id: str,
    admin_user: dict = Depends(get_tenant_admin_user)
):
    """Remove a user from the tenant (admin only)"""
    tenant_id = admin_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Find the user
    user = await db.users.find_one({"id": user_id, "tenant_id": tenant_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cannot remove yourself
    if user_id == admin_user["id"]:
        raise HTTPException(status_code=403, detail="Cannot remove yourself")
    
    # Cannot remove owner
    if user.get("role") == "owner":
        raise HTTPException(status_code=403, detail="Cannot remove tenant owner")
    
    await db.users.delete_one({"id": user_id})
    return {"message": f"User {user['email']} removed from team"}

# ============== PROVIDER MANAGEMENT ROUTES ==============

@admin_router.post("/providers", response_model=ProviderResponse)
async def create_provider(
    provider_data: ProviderCreate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Create or update AI provider configuration"""
    provider_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if provider type already exists
    existing = await db.providers.find_one({"type": provider_data.type})
    if existing:
        # Update existing provider
        await db.providers.update_one(
            {"type": provider_data.type},
            {"$set": {
                "name": provider_data.name,
                "api_key": provider_data.api_key,
                "base_url": provider_data.base_url,
                "is_active": True,
                "updated_at": now
            }}
        )
        provider_id = existing["id"]
    else:
        # Create new provider
        provider_doc = {
            "id": provider_id,
            "name": provider_data.name,
            "type": provider_data.type,
            "api_key": provider_data.api_key,
            "base_url": provider_data.base_url,
            "is_active": True,
            "total_calls": 0,
            "total_tokens": 0,
            "total_cost": 0.0,
            "models": [],
            "created_at": now,
            "updated_at": now
        }
        await db.providers.insert_one(provider_doc)
    
    # Return provider with masked key
    provider = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if provider and provider.get("api_key"):
        key = provider["api_key"]
        provider["masked_api_key"] = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "****"
        del provider["api_key"]
    
    return {**provider, "last_error": None}

@admin_router.get("/providers", response_model=List[ProviderResponse])
async def list_providers(admin_user: dict = Depends(get_super_admin_user)):
    """List all AI providers"""
    providers = await db.providers.find({}, {"_id": 0}).to_list(100)
    
    # Mask API keys and get last error
    result = []
    for provider in providers:
        if provider.get("api_key"):
            key = provider["api_key"]
            provider["masked_api_key"] = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "****"
            del provider["api_key"]
        
        # Get last error
        last_error_doc = await db.provider_errors.find_one(
            {"provider_id": provider["id"]},
            {"_id": 0, "error_message": 1},
            sort=[("timestamp", -1)]
        )
        provider["last_error"] = last_error_doc.get("error_message") if last_error_doc else None
        
        result.append(provider)
    
    return result

@admin_router.post("/providers/{provider_id}/test")
async def test_provider_connection(
    provider_id: str,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Test provider API connection"""
    provider = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    try:
        # Test connection based on provider type
        if provider["type"] == "openai":
            import openai
            client = openai.OpenAI(api_key=provider["api_key"])
            models = client.models.list()
            return {"status": "success", "message": "Connection successful", "models_count": len(list(models))}
        
        elif provider["type"] == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=provider["api_key"])
            # Test with a simple message
            message = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=10,
                messages=[{"role": "user", "content": "Test"}]
            )
            return {"status": "success", "message": "Connection successful"}
        
        elif provider["type"] == "google":
            # Test Google AI connection
            return {"status": "success", "message": "Connection test not implemented for Google"}
        
        return {"status": "error", "message": "Unknown provider type"}
        
    except Exception as e:
        # Log error
        error_doc = {
            "id": str(uuid.uuid4()),
            "provider_id": provider_id,
            "error_message": str(e),
            "error_type": type(e).__name__,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.provider_errors.insert_one(error_doc)
        
        return {"status": "error", "message": str(e)}

@admin_router.post("/providers/{provider_id}/scan-models")
async def scan_provider_models(
    provider_id: str,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Scan and update available models for provider"""
    provider = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    try:
        models = []
        
        if provider["type"] == "openai":
            import openai
            client = openai.OpenAI(api_key=provider["api_key"])
            models_list = client.models.list()
            models = [model.id for model in models_list if "gpt" in model.id.lower()]
        
        elif provider["type"] == "anthropic":
            # Anthropic doesn't have a list models API, hardcode known models
            models = [
                "claude-3-5-sonnet-20241022",
                "claude-3-5-haiku-20241022",
                "claude-3-opus-20240229",
                "claude-3-sonnet-20240229",
                "claude-3-haiku-20240307"
            ]
        
        elif provider["type"] == "google":
            # Google AI hardcoded models
            models = [
                "gemini-2.0-flash-exp",
                "gemini-1.5-pro",
                "gemini-1.5-flash"
            ]
        
        # Update provider with models
        await db.providers.update_one(
            {"id": provider_id},
            {"$set": {"models": models, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"status": "success", "models": models, "count": len(models)}
        
    except Exception as e:
        # Log error
        error_doc = {
            "id": str(uuid.uuid4()),
            "provider_id": provider_id,
            "error_message": str(e),
            "error_type": type(e).__name__,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.provider_errors.insert_one(error_doc)
        
        raise HTTPException(status_code=500, detail=str(e))

@admin_router.get("/providers/{provider_id}/errors", response_model=List[ProviderErrorResponse])
async def get_provider_errors(
    provider_id: str,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Get error log for provider"""
    errors = await db.provider_errors.find(
        {"provider_id": provider_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(50).to_list(50)
    
    return errors

@admin_router.delete("/providers/{provider_id}")
async def delete_provider(
    provider_id: str,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Soft delete provider"""
    result = await db.providers.update_one(
        {"id": provider_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    return {"status": "success", "message": "Provider deactivated"}

# ============== AGENT MANAGEMENT ROUTES ==============

@admin_router.post("/agents", response_model=AgentResponse)
async def create_agent(
    agent_data: AgentCreate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Create new AI agent persona"""
    agent_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Verify provider exists
    provider = await db.providers.find_one({"id": agent_data.provider_id, "is_active": True}, {"_id": 0})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found or inactive")
    
    # Create agent
    agent_doc = {
        "id": agent_id,
        "name": agent_data.name,
        "avatar_url": None,
        "provider_id": agent_data.provider_id,
        "model": agent_data.model,
        "system_prompt": agent_data.system_prompt,
        "temperature": agent_data.temperature,
        "max_tokens": agent_data.max_tokens,
        "version": 1,
        "is_active": True,
        "is_marketplace": agent_data.is_marketplace,
        "created_at": now,
        "updated_at": now,
        "created_by": admin_user["id"]
    }
    await db.agents.insert_one(agent_doc)
    
    # Create initial version
    version_doc = {
        "id": str(uuid.uuid4()),
        "agent_id": agent_id,
        "version": 1,
        "config": {
            "model": agent_data.model,
            "system_prompt": agent_data.system_prompt,
            "temperature": agent_data.temperature,
            "max_tokens": agent_data.max_tokens
        },
        "created_at": now,
        "created_by": admin_user["id"]
    }
    await db.agent_versions.insert_one(version_doc)
    
    # Return agent with provider name
    agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
    agent["provider_name"] = provider["name"]
    
    return agent

@admin_router.get("/agents", response_model=List[AgentResponse])
async def list_agents(admin_user: dict = Depends(get_super_admin_user)):
    """List all AI agents"""
    agents = await db.agents.find({}, {"_id": 0}).to_list(100)
    
    # Enrich with provider names
    result = []
    for agent in agents:
        provider = await db.providers.find_one({"id": agent["provider_id"]}, {"_id": 0, "name": 1})
        agent["provider_name"] = provider["name"] if provider else "Unknown"
        result.append(agent)
    
    return result

@admin_router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Get agent details"""
    agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    provider = await db.providers.find_one({"id": agent["provider_id"]}, {"_id": 0, "name": 1})
    agent["provider_name"] = provider["name"] if provider else "Unknown"
    
    return agent

@admin_router.put("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    agent_data: AgentUpdate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Update agent (creates new version)"""
    agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = {k: v for k, v in agent_data.model_dump().items() if v is not None}
    
    # Check if config changed (model, system_prompt, temperature, max_tokens)
    config_fields = ['model', 'system_prompt', 'temperature', 'max_tokens']
    config_changed = any(field in update_data for field in config_fields)
    
    if config_changed:
        # Increment version
        new_version = agent["version"] + 1
        update_data["version"] = new_version
        
        # Create version snapshot
        version_doc = {
            "id": str(uuid.uuid4()),
            "agent_id": agent_id,
            "version": new_version,
            "config": {
                "model": update_data.get("model", agent["model"]),
                "system_prompt": update_data.get("system_prompt", agent["system_prompt"]),
                "temperature": update_data.get("temperature", agent["temperature"]),
                "max_tokens": update_data.get("max_tokens", agent["max_tokens"])
            },
            "created_at": now,
            "created_by": admin_user["id"]
        }
        await db.agent_versions.insert_one(version_doc)
    
    update_data["updated_at"] = now
    
    await db.agents.update_one({"id": agent_id}, {"$set": update_data})
    
    # Return updated agent
    agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
    provider = await db.providers.find_one({"id": agent["provider_id"]}, {"_id": 0, "name": 1})
    agent["provider_name"] = provider["name"] if provider else "Unknown"
    
    return agent

@admin_router.post("/agents/{agent_id}/avatar")
async def upload_agent_avatar(
    agent_id: str,
    file: UploadFile = File(...),
    admin_user: dict = Depends(get_super_admin_user)
):
    """Upload agent avatar image"""
    agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    # Validate file size (5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size: 5MB")
    
    # Get storage service
    from storage_service import get_storage_service
    storage = await get_storage_service(db)
    
    # Generate filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"agent_{agent_id}_{uuid.uuid4().hex[:8]}.{ext}"
    destination_path = f"agents/{filename}"
    
    # Upload to configured storage
    storage_url = await storage.upload_file(contents, destination_path, file.content_type)
    
    # For GCS storage, store a proxy path instead of the direct GCS URL
    if storage_url.startswith('https://storage.googleapis.com/'):
        avatar_url = f"/api/media/agents/{filename}"
    else:
        avatar_url = storage_url
    
    # Update agent
    await db.agents.update_one(
        {"id": agent_id},
        {"$set": {"avatar_url": avatar_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"avatar_url": avatar_url}

@admin_router.get("/agents/{agent_id}/versions")
async def get_agent_versions(
    agent_id: str,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Get agent version history"""
    versions = await db.agent_versions.find(
        {"agent_id": agent_id},
        {"_id": 0}
    ).sort("version", -1).to_list(100)
    
    return versions

@admin_router.post("/agents/{agent_id}/rollback/{version}")
async def rollback_agent_version(
    agent_id: str,
    version: int,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Rollback agent to specific version"""
    agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Get version config
    version_doc = await db.agent_versions.find_one(
        {"agent_id": agent_id, "version": version},
        {"_id": 0}
    )
    if not version_doc:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Apply version config
    config = version_doc["config"]
    now = datetime.now(timezone.utc).isoformat()
    new_version = agent["version"] + 1
    
    await db.agents.update_one(
        {"id": agent_id},
        {"$set": {
            "model": config["model"],
            "system_prompt": config["system_prompt"],
            "temperature": config["temperature"],
            "max_tokens": config["max_tokens"],
            "version": new_version,
            "updated_at": now
        }}
    )
    
    # Create new version entry for rollback
    rollback_version_doc = {
        "id": str(uuid.uuid4()),
        "agent_id": agent_id,
        "version": new_version,
        "config": config,
        "created_at": now,
        "created_by": admin_user["id"],
        "is_rollback": True,
        "rolled_back_from": version
    }
    await db.agent_versions.insert_one(rollback_version_doc)
    
    return {"status": "success", "message": f"Rolled back to version {version}", "new_version": new_version}

@admin_router.post("/agents/{agent_id}/test")
async def test_agent_conversation(
    agent_id: str,
    request: TestConversationRequest,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Test agent in sandbox with conversation history support - IMPORTANT: This is for TESTING ONLY.
    In production, agents are limited to company knowledge base via company_agent_configs."""
    agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    provider = await db.providers.find_one({"id": agent["provider_id"]}, {"_id": 0})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    try:
        # Generate AI response based on provider type
        if provider["type"] == "openai":
            import openai
            client = openai.OpenAI(api_key=provider["api_key"])
            
            # Newer models have different parameter requirements
            model_lower = agent["model"].lower()
            newer_models = ["gpt-4o", "gpt-5", "o1", "o3"]
            uses_new_param = any(model_prefix in model_lower for model_prefix in newer_models)
            
            # GPT-5 and o-series models have more restrictions
            restrictive_models = ["gpt-5", "o1", "o3"]
            is_restrictive = any(model_prefix in model_lower for model_prefix in restrictive_models)
            
            # Build STRICT system prompt (same as production widget)
            enhanced_prompt = f"""Your name is {agent['name']}.

CRITICAL INSTRUCTIONS FOR TESTING:
This is a test environment. In production, you will ONLY answer from company documentation.

SIMULATE STRICT KNOWLEDGE BASE BEHAVIOR:
1. You may ONLY answer questions that would typically be found in company documentation (products, services, policies, FAQs).
2. For general knowledge questions (world facts, celebrities, history, geography, etc.), respond EXACTLY: "I don't have that information in my knowledge base. Please contact our support team for assistance."
3. NEVER answer questions about topics unrelated to a typical company's operations.
4. Format your responses with proper line breaks and paragraphs for readability.

{agent['system_prompt']}"""
            
            # Build messages with conversation history
            messages = [{"role": "system", "content": enhanced_prompt}]
            messages.extend(request.history)
            messages.append({"role": "user", "content": request.message})
            
            params = {
                "model": agent["model"],
                "messages": messages
            }
            
            # Only add temperature for models that support it
            if not is_restrictive:
                params["temperature"] = agent["temperature"]
            
            # Use appropriate token limit parameter based on model
            if uses_new_param:
                params["max_completion_tokens"] = agent["max_tokens"]
            else:
                params["max_tokens"] = agent["max_tokens"]
            
            response = client.chat.completions.create(**params)
            reply = response.choices[0].message.content
        
        elif provider["type"] == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=provider["api_key"])
            
            # Build STRICT system prompt (same as production widget)
            enhanced_prompt = f"""Your name is {agent['name']}.

CRITICAL INSTRUCTIONS FOR TESTING:
This is a test environment. In production, you will ONLY answer from company documentation.

SIMULATE STRICT KNOWLEDGE BASE BEHAVIOR:
1. You may ONLY answer questions that would typically be found in company documentation (products, services, policies, FAQs).
2. For general knowledge questions (world facts, celebrities, history, geography, etc.), respond EXACTLY: "I don't have that information in my knowledge base. Please contact our support team for assistance."
3. NEVER answer questions about topics unrelated to a typical company's operations.
4. Format your responses with proper line breaks and paragraphs for readability.

{agent['system_prompt']}"""
            
            # Build messages with conversation history
            messages = list(request.history)
            messages.append({"role": "user", "content": request.message})
            
            response = client.messages.create(
                model=agent["model"],
                max_tokens=agent["max_tokens"],
                temperature=agent["temperature"],
                system=enhanced_prompt,
                messages=messages
            )
            reply = response.content[0].text
        
        elif provider["type"] == "google":
            # Placeholder for Google AI
            reply = "Google AI integration pending"
        
        else:
            raise HTTPException(status_code=400, detail="Unknown provider type")
        
        return {
            "status": "success",
            "user_message": request.message,
            "agent_response": reply,
            "agent_name": agent["name"],
            "model": agent["model"]
        }
        
    except Exception as e:
        # Log error
        error_doc = {
            "id": str(uuid.uuid4()),
            "provider_id": provider["id"],
            "error_message": str(e),
            "error_type": type(e).__name__,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.provider_errors.insert_one(error_doc)
        
        raise HTTPException(status_code=500, detail=str(e))

@admin_router.delete("/agents/{agent_id}")
async def delete_agent(
    agent_id: str,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Soft delete agent"""
    result = await db.agents.update_one(
        {"id": agent_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return {"status": "success", "message": "Agent deactivated"}

# ============== COMPANY AGENT CONFIGURATION ROUTES ==============

@settings_router.get("/agent-config", response_model=CompanyAgentConfigResponse)
async def get_company_agent_config(current_user: dict = Depends(get_current_user)):
    """Get company's agent configuration"""
    if not current_user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="User not associated with a company")
    
    company_id = current_user["tenant_id"]
    config = await db.company_agent_configs.find_one({"company_id": company_id}, {"_id": 0})
    
    if not config:
        # Create default config
        config_id = str(uuid.uuid4())
        config = {
            "id": config_id,
            "company_id": company_id,
            "agent_id": None,
            "custom_instructions": None,
            "uploaded_docs": [],
            "scraping_domains": [],
            "is_active": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.company_agent_configs.insert_one(config)
    
    # Get agent name if agent is selected
    agent_name = None
    if config.get("agent_id"):
        agent = await db.agents.find_one({"id": config["agent_id"]}, {"_id": 0, "name": 1})
        agent_name = agent.get("name") if agent else None
    
    config["agent_name"] = agent_name
    return config

@settings_router.patch("/agent-config")
async def update_company_agent_config(
    config_update: CompanyAgentConfigUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update company's agent configuration"""
    if not current_user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="User not associated with a company")
    
    company_id = current_user["tenant_id"]
    
    # Verify agent exists if provided
    if config_update.agent_id:
        agent = await db.agents.find_one({"id": config_update.agent_id, "is_active": True}, {"_id": 0})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found or inactive")
    
    # Build update document
    update_data = {}
    if config_update.agent_id is not None:
        update_data["agent_id"] = config_update.agent_id
    if config_update.custom_instructions is not None:
        update_data["custom_instructions"] = config_update.custom_instructions
    if config_update.scraping_domains is not None:
        update_data["scraping_domains"] = config_update.scraping_domains
    if config_update.scraping_max_depth is not None:
        update_data["scraping_max_depth"] = config_update.scraping_max_depth
    if config_update.scraping_max_pages is not None:
        update_data["scraping_max_pages"] = config_update.scraping_max_pages
    if config_update.response_language is not None:
        update_data["response_language"] = config_update.response_language
    if config_update.language_mode is not None:
        update_data["language_mode"] = config_update.language_mode
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Update or create config
    result = await db.company_agent_configs.update_one(
        {"company_id": company_id},
        {"$set": update_data},
        upsert=True
    )
    
    return {"status": "success", "message": "Configuration updated"}

@settings_router.post("/agent-config/upload-doc")
async def upload_company_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload company documentation for RAG with immediate processing"""
    if not current_user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="User not associated with a company")
    
    company_id = current_user["tenant_id"]
    
    # Validate file type
    allowed_types = [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/csv"
    ]
    allowed_extensions = [".pdf", ".txt", ".md", ".docx", ".csv"]
    
    file_ext = Path(file.filename).suffix.lower() if file.filename else ""
    if file.content_type not in allowed_types and file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: PDF, TXT, MD, DOCX, CSV"
        )
    
    # Validate file size (5MB)
    contents = await file.read()
    file_size = len(contents)
    if file_size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size: 5MB")
    
    # Get storage service
    from storage_service import get_storage_service
    storage = await get_storage_service(db)
    
    # Generate unique document ID and filename
    doc_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{file.filename}"
    destination_path = f"company_docs/{company_id}/{safe_filename}"
    
    # Upload to configured storage
    doc_url = await storage.upload_file(contents, destination_path, file.content_type)
    
    # For RAG processing, we need a local temp file
    import tempfile
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix)
    temp_file.write(contents)
    temp_file.close()
    filepath = temp_file.name
    
    # Get company's agent to find the provider API key
    config = await db.company_agent_configs.find_one({"company_id": company_id}, {"_id": 0})
    if not config or not config.get("agent_id"):
        raise HTTPException(
            status_code=400,
            detail="Please configure an AI agent before uploading documents"
        )
    
    agent = await db.agents.find_one({"id": config["agent_id"]}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Configured agent not found")
    
    provider = await db.providers.find_one({"id": agent["provider_id"]}, {"_id": 0})
    if not provider or provider.get("type") != "openai":
        raise HTTPException(
            status_code=400,
            detail="RAG currently only supports OpenAI providers. Please configure an OpenAI agent."
        )
    
    # Process document with RAG (extract text, chunk, embed)
    try:
        from rag_service import process_document
        
        chunk_docs = process_document(
            filepath=str(filepath),
            filename=file.filename,
            company_id=company_id,
            doc_id=doc_id,
            api_key=provider["api_key"]
        )
        
        # Store chunks with embeddings in MongoDB
        if chunk_docs:
            await db.document_chunks.insert_many(chunk_docs)
        
        chunks_count = len(chunk_docs)
        
    except Exception as e:
        # Clean up temp file if processing fails
        import os
        if os.path.exists(filepath):
            os.unlink(filepath)
        # Also delete from storage
        await storage.delete_file(doc_url)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process document: {str(e)}"
        )
    finally:
        # Clean up temp file
        import os
        if os.path.exists(filepath):
            os.unlink(filepath)
    
    # Create document info
    doc_info = {
        "id": doc_id,
        "filename": file.filename,
        "filepath": doc_url,  # Use storage URL
        "upload_date": datetime.now(timezone.utc).isoformat(),
        "file_size": file_size,
        "chunks_count": chunks_count,
        "status": "processed"
    }
    
    # Add to company config
    await db.company_agent_configs.update_one(
        {"company_id": company_id},
        {
            "$push": {"uploaded_docs": doc_info},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    return {"status": "success", "document": doc_info, "chunks_processed": chunks_count}

@settings_router.delete("/agent-config/docs/{filename}")
async def delete_company_document(
    filename: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete company documentation and associated embeddings"""
    if not current_user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="User not associated with a company")
    
    company_id = current_user["tenant_id"]
    
    # Get current config
    config = await db.company_agent_configs.find_one({"company_id": company_id}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    # Find document
    doc_to_delete = None
    for doc in config.get("uploaded_docs", []):
        if doc["filename"] == filename:
            doc_to_delete = doc
            break
    
    if not doc_to_delete:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete associated chunks and embeddings from MongoDB
    doc_id = doc_to_delete.get("id")
    if doc_id:
        result = await db.document_chunks.delete_many({
            "company_id": company_id,
            "document_id": doc_id
        })
        logger.info(f"Deleted {result.deleted_count} chunks for document {filename}")
    
    # Delete file from filesystem
    filepath_parts = doc_to_delete["filepath"].split("/")
    safe_filename = filepath_parts[-1]
    file_path = UPLOADS_DIR / "company_docs" / company_id / safe_filename
    
    if file_path.exists():
        file_path.unlink()
    
    # Remove from database
    await db.company_agent_configs.update_one(
        {"company_id": company_id},
        {
            "$pull": {"uploaded_docs": {"filename": filename}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"status": "success", "message": "Document deleted"}

# ============== WEB SCRAPING ROUTES ==============

@settings_router.post("/agent-config/scrape")
async def trigger_web_scraping(
    scrape_request: ScrapingTriggerRequest,
    current_user: dict = Depends(get_current_user)
):
    """Trigger web scraping for configured domains"""
    if not current_user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="User not associated with a company")
    
    company_id = current_user["tenant_id"]
    
    # Get company config
    config = await db.company_agent_configs.find_one({"company_id": company_id}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    domains = config.get("scraping_domains", [])
    if not domains:
        raise HTTPException(status_code=400, detail="No domains configured for scraping")
    
    # Check if already scraping
    scraping_status = config.get("scraping_status")
    if scraping_status == "in_progress":
        raise HTTPException(status_code=409, detail="Scraping already in progress")
    
    # Get scraping settings
    max_depth = config.get("scraping_max_depth", 2)
    max_pages = config.get("scraping_max_pages", 50)
    
    # Get OpenAI API key for embeddings
    openai_provider = await db.providers.find_one({"type": "openai", "is_active": True}, {"_id": 0})
    if not openai_provider:
        raise HTTPException(status_code=400, detail="OpenAI provider not configured")
    
    openai_key = openai_provider["api_key"]
    
    # Update status to in_progress
    await db.company_agent_configs.update_one(
        {"company_id": company_id},
        {
            "$set": {
                "scraping_status": "in_progress",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    try:
        # Import scraping service
        from scraping_service import scrape_domains, prepare_scraped_content_for_rag
        from rag_service import process_web_content
        
        logger.info(f"Starting web scraping for company {company_id}: {domains}")
        
        # Scrape domains
        scraped_data = scrape_domains(domains, max_depth=max_depth, max_pages_per_domain=max_pages)
        
        # Prepare documents
        documents = prepare_scraped_content_for_rag(scraped_data, company_id)
        
        total_pages = len(documents)
        total_chunks = 0
        
        # Process each document: chunk and generate embeddings
        for doc in documents:
            try:
                # Check if this content already exists (by content_hash)
                existing = await db.document_chunks.find_one({
                    "company_id": company_id,
                    "source_type": "web",
                    "content_hash": doc["content_hash"]
                })
                
                if existing and not scrape_request.force_refresh:
                    logger.info(f"Skipping {doc['source_url']} (already exists)")
                    continue
                
                # Delete old chunks if force refresh
                if existing and scrape_request.force_refresh:
                    await db.document_chunks.delete_many({
                        "company_id": company_id,
                        "source_type": "web",
                        "content_hash": doc["content_hash"]
                    })
                
                # Process web content into chunks with embeddings
                chunk_docs = process_web_content(
                    content=doc["content"],
                    source_url=doc["source_url"],
                    title=doc["title"],
                    company_id=company_id,
                    content_hash=doc["content_hash"],
                    api_key=openai_key
                )
                
                # Insert chunks into database
                if chunk_docs:
                    await db.document_chunks.insert_many(chunk_docs)
                    total_chunks += len(chunk_docs)
                    logger.info(f"Processed {doc['source_url']}: {len(chunk_docs)} chunks")
            
            except Exception as e:
                logger.error(f"Error processing {doc['source_url']}: {e}")
                continue
        
        # Update config with success status
        await db.company_agent_configs.update_one(
            {"company_id": company_id},
            {
                "$set": {
                    "scraping_status": "completed",
                    "last_scraped_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "status": "success",
            "pages_scraped": total_pages,
            "chunks_created": total_chunks,
            "domains": domains
        }
    
    except Exception as e:
        logger.error(f"Scraping failed for company {company_id}: {e}")
        
        # Update status to failed
        await db.company_agent_configs.update_one(
            {"company_id": company_id},
            {
                "$set": {
                    "scraping_status": "failed",
                    "scraping_error": str(e),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")

@settings_router.get("/agent-config/scrape-status", response_model=ScrapingStatusResponse)
async def get_scraping_status(current_user: dict = Depends(get_current_user)):
    """Get current scraping status"""
    if not current_user.get("tenant_id"):
        raise HTTPException(status_code=400, detail="User not associated with a company")
    
    company_id = current_user["tenant_id"]
    
    # Get company config
    config = await db.company_agent_configs.find_one({"company_id": company_id}, {"_id": 0})
    if not config:
        return ScrapingStatusResponse(
            status="idle",
            pages_scraped=0,
            domains=[]
        )
    
    # Count scraped pages
    pages_count = await db.document_chunks.count_documents({
        "company_id": company_id,
        "source_type": "web"
    })
    
    # Get unique pages (by content_hash)
    unique_pages = await db.document_chunks.distinct(
        "content_hash",
        {"company_id": company_id, "source_type": "web"}
    )
    
    return ScrapingStatusResponse(
        status=config.get("scraping_status", "idle"),
        pages_scraped=len(unique_pages),
        last_scraped_at=config.get("last_scraped_at"),
        error_message=config.get("scraping_error"),
        domains=config.get("scraping_domains", [])
    )

# ============== ANALYTICS ROUTES ==============

analytics_router = APIRouter(prefix="/analytics", tags=["analytics"])

@analytics_router.get("/overview")
async def get_analytics_overview(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get analytics overview for the tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    from datetime import timedelta
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Total conversations
    total_conversations = await db.conversations.count_documents({"tenant_id": tenant_id})
    
    # Conversations in period
    period_conversations = await db.conversations.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": cutoff_date}
    })
    
    # By status
    open_count = await db.conversations.count_documents({"tenant_id": tenant_id, "status": "open"})
    waiting_count = await db.conversations.count_documents({"tenant_id": tenant_id, "status": "waiting"})
    resolved_count = await db.conversations.count_documents({"tenant_id": tenant_id, "status": "resolved"})
    
    # By mode
    ai_mode_count = await db.conversations.count_documents({"tenant_id": tenant_id, "mode": "ai"})
    agent_mode_count = await db.conversations.count_documents({"tenant_id": tenant_id, "mode": "agent"})
    assisted_mode_count = await db.conversations.count_documents({"tenant_id": tenant_id, "mode": "assisted"})
    
    # Total messages
    conversation_ids = await db.conversations.distinct("id", {"tenant_id": tenant_id})
    total_messages = await db.messages.count_documents({"conversation_id": {"$in": conversation_ids}})
    
    # Messages by type
    customer_messages = await db.messages.count_documents({
        "conversation_id": {"$in": conversation_ids},
        "author_type": "customer"
    })
    ai_messages = await db.messages.count_documents({
        "conversation_id": {"$in": conversation_ids},
        "author_type": "ai"
    })
    agent_messages = await db.messages.count_documents({
        "conversation_id": {"$in": conversation_ids},
        "author_type": "agent"
    })
    
    # Average messages per conversation
    avg_messages = total_messages / total_conversations if total_conversations > 0 else 0
    
    # Transfer requests
    total_transfers = await db.transfer_requests.count_documents({"tenant_id": tenant_id})
    accepted_transfers = await db.transfer_requests.count_documents({"tenant_id": tenant_id, "status": "accepted"})
    
    return {
        "total_conversations": total_conversations,
        "period_conversations": period_conversations,
        "by_status": {
            "open": open_count,
            "waiting": waiting_count,
            "resolved": resolved_count
        },
        "by_mode": {
            "ai": ai_mode_count,
            "agent": agent_mode_count,
            "assisted": assisted_mode_count
        },
        "messages": {
            "total": total_messages,
            "customer": customer_messages,
            "ai": ai_messages,
            "agent": agent_messages,
            "avg_per_conversation": round(avg_messages, 1)
        },
        "transfers": {
            "total": total_transfers,
            "accepted": accepted_transfers,
            "acceptance_rate": round(accepted_transfers / total_transfers * 100, 1) if total_transfers > 0 else 0
        }
    }

@analytics_router.get("/trends")
async def get_analytics_trends(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get conversation trends over time"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    from datetime import timedelta
    
    trends = []
    for i in range(days, -1, -1):
        date = datetime.now(timezone.utc) - timedelta(days=i)
        date_start = date.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        date_end = date.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        
        count = await db.conversations.count_documents({
            "tenant_id": tenant_id,
            "created_at": {"$gte": date_start, "$lte": date_end}
        })
        
        trends.append({
            "date": date.strftime("%Y-%m-%d"),
            "conversations": count
        })
    
    return {"trends": trends}

@analytics_router.get("/agent-performance")
async def get_agent_performance(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get agent performance metrics"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    from datetime import timedelta
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Get all agents for this tenant
    agents = await db.users.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    
    agent_stats = []
    for agent in agents:
        # Conversations handled (assigned to this agent)
        conversations_handled = await db.conversations.count_documents({
            "tenant_id": tenant_id,
            "assigned_agent_id": agent["id"],
            "created_at": {"$gte": cutoff_date}
        })
        
        # Messages sent by this agent
        conversation_ids = await db.conversations.distinct("id", {"tenant_id": tenant_id})
        messages_sent = await db.messages.count_documents({
            "conversation_id": {"$in": conversation_ids},
            "author_id": agent["id"],
            "author_type": "agent"
        })
        
        # Transfers accepted
        transfers_accepted = await db.transfer_requests.count_documents({
            "tenant_id": tenant_id,
            "accepted_by": agent["id"]
        })
        
        agent_stats.append({
            "id": agent["id"],
            "name": agent.get("name", "Unknown"),
            "email": agent.get("email", ""),
            "avatar_url": agent.get("avatar_url"),
            "conversations_handled": conversations_handled,
            "messages_sent": messages_sent,
            "transfers_accepted": transfers_accepted,
            "is_available": agent.get("is_available", False)
        })
    
    # Sort by conversations handled
    agent_stats.sort(key=lambda x: x["conversations_handled"], reverse=True)
    
    return {"agents": agent_stats}

@analytics_router.get("/sentiment-summary")
async def get_sentiment_summary(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get sentiment analysis summary"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    from datetime import timedelta
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Get conversations with sentiment data
    conversations = await db.conversations.find({
        "tenant_id": tenant_id,
        "created_at": {"$gte": cutoff_date},
        "engagement_score": {"$exists": True}
    }, {"_id": 0, "engagement_score": 1, "tone_score": 1}).to_list(1000)
    
    if not conversations:
        return {
            "avg_engagement": 5,
            "avg_tone": 0,
            "sentiment_distribution": {
                "very_negative": 0,
                "negative": 0,
                "neutral": 0,
                "positive": 0,
                "very_positive": 0
            },
            "engagement_distribution": {
                "low": 0,
                "medium": 0,
                "high": 0
            }
        }
    
    # Calculate averages
    total_engagement = sum(c.get("engagement_score", 5) for c in conversations)
    total_tone = sum(c.get("tone_score", 0) for c in conversations)
    count = len(conversations)
    
    # Sentiment distribution
    sentiment_dist = {"very_negative": 0, "negative": 0, "neutral": 0, "positive": 0, "very_positive": 0}
    engagement_dist = {"low": 0, "medium": 0, "high": 0}
    
    for c in conversations:
        tone = c.get("tone_score", 0)
        engagement = c.get("engagement_score", 5)
        
        if tone < -50:
            sentiment_dist["very_negative"] += 1
        elif tone < -20:
            sentiment_dist["negative"] += 1
        elif tone <= 20:
            sentiment_dist["neutral"] += 1
        elif tone <= 50:
            sentiment_dist["positive"] += 1
        else:
            sentiment_dist["very_positive"] += 1
        
        if engagement <= 3:
            engagement_dist["low"] += 1
        elif engagement <= 6:
            engagement_dist["medium"] += 1
        else:
            engagement_dist["high"] += 1
    
    return {
        "avg_engagement": round(total_engagement / count, 1),
        "avg_tone": round(total_tone / count, 1),
        "sentiment_distribution": sentiment_dist,
        "engagement_distribution": engagement_dist,
        "total_analyzed": count
    }

api_router.include_router(analytics_router)

# ============== RATE LIMITING ROUTES ==============

rate_limiting_router = APIRouter(prefix="/rate-limits", tags=["rate-limiting"])

class RateLimitConfig(BaseModel):
    tenant_id: str
    limits: Dict[str, int]  # {minute: X, hour: Y, day: Z}

class RateLimitResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tenant_id: str
    limits: Dict[str, int]
    usage: Optional[Dict[str, Any]] = None

@rate_limiting_router.get("/")
async def get_all_rate_limits(current_user: dict = Depends(get_super_admin_user)):
    """Get all rate limit configurations (Super Admin only)"""
    from middleware.rate_limiter import rate_limiter
    
    # Get all tenants
    tenants = await db.tenants.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
    
    # Get all custom limits
    all_limits = await rate_limiter.get_all_tenant_limits()
    
    # Build response with usage stats
    result = []
    for tenant in tenants:
        tenant_id = tenant["id"]
        limits = all_limits.get(tenant_id, rate_limiter.default_limits)
        usage = await rate_limiter.get_usage_stats(tenant_id)
        
        result.append({
            "tenant_id": tenant_id,
            "tenant_name": tenant.get("name", "Unknown"),
            "limits": limits,
            "usage": usage
        })
    
    return {"rate_limits": result}

@rate_limiting_router.get("/{tenant_id}")
async def get_tenant_rate_limit(
    tenant_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Get rate limit configuration for a specific tenant (Super Admin only)"""
    from middleware.rate_limiter import rate_limiter
    
    # Verify tenant exists
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    limits = await rate_limiter.get_tenant_limit(tenant_id)
    usage = await rate_limiter.get_usage_stats(tenant_id)
    
    return {
        "tenant_id": tenant_id,
        "tenant_name": tenant.get("name"),
        "limits": limits,
        "usage": usage
    }

@rate_limiting_router.put("/{tenant_id}")
async def update_tenant_rate_limit(
    tenant_id: str,
    config: RateLimitConfig,
    current_user: dict = Depends(get_super_admin_user)
):
    """Update rate limit configuration for a tenant (Super Admin only)"""
    from middleware.rate_limiter import rate_limiter
    
    # Verify tenant exists
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Validate limits
    if not all(k in ["minute", "hour", "day"] for k in config.limits.keys()):
        raise HTTPException(
            status_code=400,
            detail="Invalid limit keys. Use 'minute', 'hour', 'day'"
        )
    
    if not all(v > 0 for v in config.limits.values()):
        raise HTTPException(status_code=400, detail="Limits must be positive")
    
    # Update limits
    await rate_limiter.set_tenant_limit(tenant_id, config.limits)
    
    # Store in database for persistence
    await db.rate_limits.update_one(
        {"tenant_id": tenant_id},
        {"$set": {"tenant_id": tenant_id, "limits": config.limits, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {
        "message": "Rate limits updated successfully",
        "tenant_id": tenant_id,
        "limits": config.limits
    }

@rate_limiting_router.delete("/{tenant_id}")
async def reset_tenant_rate_limit(
    tenant_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Reset tenant to default rate limits (Super Admin only)"""
    from middleware.rate_limiter import rate_limiter
    
    # Remove custom limits (will use defaults)
    if tenant_id in rate_limiter.tenant_limits:
        del rate_limiter.tenant_limits[tenant_id]
    
    # Remove from database
    await db.rate_limits.delete_one({"tenant_id": tenant_id})
    
    return {
        "message": "Rate limits reset to defaults",
        "tenant_id": tenant_id,
        "limits": rate_limiter.default_limits
    }

@rate_limiting_router.get("/{tenant_id}/usage")
async def get_tenant_usage(
    tenant_id: str,
    current_user: dict = Depends(get_super_admin_user)
):
    """Get current usage statistics for a tenant (Super Admin only)"""
    from middleware.rate_limiter import rate_limiter
    
    usage = await rate_limiter.get_usage_stats(tenant_id)
    limits = await rate_limiter.get_tenant_limit(tenant_id)
    
    return {
        "tenant_id": tenant_id,
        "usage": usage,
        "limits": limits
    }

api_router.include_router(rate_limiting_router)

# ============== AGENT AVAILABILITY & TRANSFER ROUTES ==============

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

@transfer_router.get("/pending")
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

@transfer_router.post("/{transfer_id}/accept")
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

@transfer_router.post("/{transfer_id}/decline")
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

# ============== STORAGE CONFIGURATION ROUTES ==============

@admin_router.get("/storage-config", response_model=StorageConfigResponse)
async def get_storage_config(admin_user: dict = Depends(get_super_admin_user)):
    """Get storage configuration (Super Admin only)"""
    config = await db.storage_config.find_one({}, {"_id": 0})
    
    if not config:
        return {
            "storage_type": "local",
            "gcs_bucket_name": None,
            "gcs_region": None,
            "gcs_configured": False,
            "updated_at": None
        }
    
    return {
        "storage_type": config.get("storage_type", "local"),
        "gcs_bucket_name": config.get("gcs_bucket_name"),
        "gcs_region": config.get("gcs_region"),
        "gcs_configured": bool(config.get("gcs_service_account_json")),
        "updated_at": config.get("updated_at")
    }

@admin_router.post("/storage-config")
async def update_storage_config(
    config: StorageConfigCreate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Update storage configuration (Super Admin only)"""
    
    # Validate GCS configuration
    if config.storage_type == "gcs":
        if not config.gcs_service_account_json or not config.gcs_bucket_name:
            raise HTTPException(
                status_code=400,
                detail="GCS requires service account JSON and bucket name"
            )
        
        # Validate JSON format
        try:
            import json
            json.loads(config.gcs_service_account_json)
        except:
            raise HTTPException(status_code=400, detail="Invalid service account JSON")
    
    # Prepare config document
    config_doc = {
        "storage_type": config.storage_type,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin_user["id"]
    }
    
    if config.storage_type == "gcs":
        config_doc.update({
            "gcs_service_account_json": config.gcs_service_account_json,
            "gcs_bucket_name": config.gcs_bucket_name,
            "gcs_region": config.gcs_region or "us-central1"
        })
    
    # Upsert configuration (only one config document)
    await db.storage_config.update_one(
        {},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"status": "success", "message": "Storage configuration updated"}

@admin_router.post("/storage-config/test-gcs")
async def test_gcs_connection(admin_user: dict = Depends(get_super_admin_user)):
    """Test GCS connection with current configuration"""
    config = await db.storage_config.find_one({}, {"_id": 0})
    
    if not config or config.get("storage_type") != "gcs":
        raise HTTPException(status_code=400, detail="GCS not configured")
    
    try:
        from google.cloud import storage
        import json
        import tempfile
        
        # Create credentials from JSON
        service_account_info = json.loads(config["gcs_service_account_json"])
        
        # Test connection
        client = storage.Client.from_service_account_info(service_account_info)
        bucket = client.bucket(config["gcs_bucket_name"])
        
        # Check if bucket exists and is accessible
        exists = bucket.exists()
        
        if exists:
            return {
                "status": "success",
                "message": f"Successfully connected to bucket: {config['gcs_bucket_name']}",
                "bucket_exists": True
            }
        else:
            return {
                "status": "warning",
                "message": f"Bucket '{config['gcs_bucket_name']}' does not exist. You may need to create it.",
                "bucket_exists": False
            }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"GCS connection failed: {str(e)}"
        )

# ============== PROFILE ROUTES ==============

@profile_router.get("", response_model=ProfileResponse)
@profile_router.get("/", response_model=ProfileResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's profile"""
    tenant = None
    if current_user.get("tenant_id"):
        tenant = await db.tenants.find_one({"id": current_user["tenant_id"]}, {"_id": 0})
    
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "role": current_user["role"],
        "avatar_url": current_user.get("avatar_url"),
        "tenant_id": current_user.get("tenant_id"),
        "tenant_name": tenant.get("name") if tenant else None,
        "created_at": current_user["created_at"],
        "is_super_admin": is_super_admin(current_user)
    }

@profile_router.put("", response_model=ProfileResponse)
@profile_router.put("/", response_model=ProfileResponse)
async def update_profile(
    profile_data: ProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update current user's profile"""
    update_data = {k: v for k, v in profile_data.model_dump().items() if v is not None}
    
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    # Fetch updated user
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    tenant = None
    if updated_user.get("tenant_id"):
        tenant = await db.tenants.find_one({"id": updated_user["tenant_id"]}, {"_id": 0})
    
    return {
        "id": updated_user["id"],
        "email": updated_user["email"],
        "name": updated_user["name"],
        "role": updated_user["role"],
        "avatar_url": updated_user.get("avatar_url"),
        "tenant_id": updated_user.get("tenant_id"),
        "tenant_name": tenant.get("name") if tenant else None,
        "created_at": updated_user["created_at"],
        "is_super_admin": is_super_admin(updated_user)
    }

@profile_router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_user)
):
    """Change current user's password"""
    # Verify current password
    user_with_hash = await db.users.find_one({"id": current_user["id"]})
    if not verify_password(password_data.current_password, user_with_hash["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    new_hash = hash_password(password_data.new_password)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password_hash": new_hash, "requires_password_reset": False}}
    )
    
    return {"message": "Password changed successfully"}

@profile_router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload avatar image file"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, GIF, WebP")
    
    # Validate file size (max 5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size: 5MB")
    
    # Get storage service
    from storage_service import get_storage_service
    storage = await get_storage_service(db)
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    destination_path = f"avatars/{filename}"
    
    # Upload to configured storage
    storage_url = await storage.upload_file(contents, destination_path, file.content_type)
    
    # For GCS storage, store a proxy path instead of the direct GCS URL
    # This allows us to serve images through our backend for proper access control
    if storage_url.startswith('https://storage.googleapis.com/'):
        avatar_url = f"/api/media/avatars/{filename}"
    else:
        avatar_url = storage_url
    
    # Update user
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"avatar_url": avatar_url}}
    )
    
    return {"message": "Avatar uploaded", "avatar_url": avatar_url}

@profile_router.post("/avatar-url")
async def update_avatar_url(
    avatar_url: str,
    current_user: dict = Depends(get_current_user)
):
    """Update avatar via URL"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"avatar_url": avatar_url}}
    )
    
    return {"message": "Avatar updated", "avatar_url": avatar_url}

# ============== HEALTH CHECK ==============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/")
async def root():
    return {"message": "AI Support Hub API"}

# Include all routers
# Import modularized routes
from routes.auth import router as auth_router_new
from routes.rate_limits import router as rate_limits_router_new

# Use modularized routers
api_router.include_router(auth_router_new)
api_router.include_router(rate_limits_router_new)

# Include inline routers (to be refactored)
api_router.include_router(tenants_router)
api_router.include_router(conversations_router)
api_router.include_router(settings_router)
api_router.include_router(widget_router)
api_router.include_router(admin_router)
api_router.include_router(users_router)
api_router.include_router(profile_router)

app.include_router(api_router)

# Mount uploads directory for serving avatar images
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Media proxy endpoint for GCS files
@app.get("/api/media/{path:path}")
async def proxy_media(path: str):
    """Proxy media files from GCS storage"""
    from storage_service import get_storage_service
    from fastapi.responses import StreamingResponse
    import io
    
    storage = await get_storage_service(db)
    
    if storage.storage_type != "gcs":
        # For local storage, redirect to uploads
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        blob = storage.bucket.blob(path)
        if not blob.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        content = blob.download_as_bytes()
        content_type = blob.content_type or "application/octet-stream"
        
        return StreamingResponse(
            io.BytesIO(content),
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=31536000",
                "Access-Control-Allow-Origin": "*"
            }
        )
    except Exception as e:
        print(f"Error proxying media: {str(e)}")
        raise HTTPException(status_code=404, detail="File not found")

# Import rate limiter before adding middleware
from middleware.rate_limiter import rate_limiter

# Add rate limiting middleware (applied first, runs last)
@app.middleware("http")
async def rate_limit_check(request: Request, call_next):
    """Rate limiting middleware - must come first to run after auth context is set"""
    # Skip rate limiting for certain paths
    skip_paths = ["/api/auth/login", "/api/auth/register", "/docs", "/openapi.json", "/api/media"]
    
    if any(request.url.path.startswith(path) for path in skip_paths):
        response = await call_next(request)
        return response
    
    # Get tenant_id from request state (set by auth middleware)
    tenant_id = getattr(request.state, "tenant_id", None)
    
    if not tenant_id:
        # If no tenant_id, allow request (e.g., public endpoints)
        response = await call_next(request)
        return response
    
    # Check rate limit
    allowed, info = await rate_limiter.check_rate_limit(tenant_id)
    
    if not allowed:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "detail": {
                    "message": f"Rate limit exceeded for {info['exceeded_window']}",
                    "usage": info["usage"]
                }
            }
        )
    
    # Add rate limit info to response headers
    response = await call_next(request)
    usage = info["usage"]
    
    # Add headers for minute window
    if "minute" in usage:
        response.headers["X-RateLimit-Limit-Minute"] = str(usage["minute"]["limit"])
        response.headers["X-RateLimit-Remaining-Minute"] = str(usage["minute"]["remaining"])
    
    return response

# Add middleware to set tenant_id in request state (applied second, runs first)
@app.middleware("http")
async def set_tenant_context(request: Request, call_next):
    """Set tenant_id in request state for downstream middleware"""
    # Try to extract tenant_id from auth token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            request.state.tenant_id = payload.get("tenant_id")
        except:
            pass
    
    response = await call_next(request)
    return response

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_load_rate_limits():
    """Load rate limits from database on startup"""
    from middleware.rate_limiter import rate_limiter
    
    # Load saved rate limits
    saved_limits = await db.rate_limits.find({}, {"_id": 0}).to_list(1000)
    for limit_config in saved_limits:
        tenant_id = limit_config.get("tenant_id")
        limits = limit_config.get("limits", {})
        if tenant_id and limits:
            await rate_limiter.set_tenant_limit(tenant_id, limits)
    
    logger.info(f"Loaded {len(saved_limits)} rate limit configurations")

@app.on_event("shutdown")
async def shutdown_db_client():
    from middleware.database import client
    client.close()
