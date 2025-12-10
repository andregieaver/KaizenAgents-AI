from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import base64

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-super-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

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

security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    tenant_id: Optional[str] = None
    created_at: str

class TenantCreate(BaseModel):
    name: str
    domain: Optional[str] = None

class TenantResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    domain: Optional[str] = None
    created_at: str

class SettingsUpdate(BaseModel):
    brand_name: Optional[str] = None
    brand_logo: Optional[str] = None
    primary_color: Optional[str] = None
    widget_position: Optional[Literal["bottom-right", "bottom-left"]] = None
    widget_theme: Optional[Literal["light", "dark", "auto"]] = None
    welcome_message: Optional[str] = None
    ai_persona: Optional[str] = None
    ai_tone: Optional[Literal["formal", "casual", "friendly"]] = None
    openai_api_key: Optional[str] = None
    ai_model: Optional[str] = None

class SettingsResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: str
    brand_name: str
    brand_logo: Optional[str] = None
    primary_color: str
    widget_position: str
    widget_theme: str
    welcome_message: str
    ai_persona: str
    ai_tone: str
    openai_api_key: Optional[str] = None
    ai_model: str
    updated_at: str

class ConversationCreate(BaseModel):
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    source: Literal["widget", "email", "api"] = "widget"

class ConversationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: str
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    status: str
    mode: str
    source: str
    assigned_agent_id: Optional[str] = None
    last_message: Optional[str] = None
    last_message_at: Optional[str] = None
    created_at: str
    updated_at: str

class MessageCreate(BaseModel):
    content: str
    author_type: Literal["customer", "agent"] = "customer"

class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    conversation_id: str
    author_type: str
    author_id: Optional[str] = None
    content: str
    created_at: str

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

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, tenant_id: Optional[str] = None) -> str:
    payload = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_tenant_settings(tenant_id: str) -> dict:
    settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
    return settings

# Super Admin Configuration
SUPER_ADMIN_EMAIL = "andre@humanweb.no"

def is_super_admin(user: dict) -> bool:
    """Check if user is super admin"""
    return user.get("email") == SUPER_ADMIN_EMAIL or user.get("role") == "super_admin"

async def get_super_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency that ensures user is super admin"""
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not is_super_admin(user):
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user

def can_manage_users(user: dict) -> bool:
    """Check if user can manage other users (owner or admin)"""
    return user.get("role") in ["owner", "admin"] or is_super_admin(user)

async def get_tenant_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency that ensures user can manage tenant users"""
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not can_manage_users(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============== AI SERVICE ==============

async def generate_ai_response(messages: List[dict], settings: dict) -> str:
    """Generate AI response using OpenAI via emergentintegrations"""
    try:
        openai_key = settings.get("openai_api_key")
        if not openai_key:
            return "I apologize, but the AI assistant is not configured yet. Please contact support."
        
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Build system message from settings
        persona = settings.get("ai_persona", "You are a helpful customer support assistant.")
        tone = settings.get("ai_tone", "friendly")
        brand_name = settings.get("brand_name", "our company")
        
        system_message = f"""{persona}
        
You work for {brand_name}. Respond in a {tone} tone.
Be concise and helpful. If you can't help with something, politely suggest contacting a human agent.
Do not make up information. If unsure, say so."""
        
        # Initialize chat
        chat = LlmChat(
            api_key=openai_key,
            session_id=str(uuid.uuid4()),
            system_message=system_message
        )
        
        model = settings.get("ai_model", "gpt-4o-mini")
        chat.with_model("openai", model)
        
        # Build conversation context (last 10 messages)
        context = ""
        for msg in messages[-10:]:
            role = "Customer" if msg.get("author_type") == "customer" else "Assistant"
            context += f"{role}: {msg.get('content')}\n"
        
        # Get the latest message
        latest_msg = messages[-1].get("content", "") if messages else ""
        
        user_message = UserMessage(text=f"Previous conversation:\n{context}\n\nPlease respond to the latest customer message.")
        
        response = await chat.send_message(user_message)
        return response
        
    except Exception as e:
        logger.error(f"AI generation error: {str(e)}")
        return "I apologize, but I'm having trouble processing your request. Please try again or contact support."

# ============== AUTH ROUTES ==============

@auth_router.post("/register", response_model=dict)
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

# ============== CONVERSATIONS ROUTES ==============

@conversations_router.get("", response_model=List[ConversationResponse])
@conversations_router.get("/", response_model=List[ConversationResponse])
async def list_conversations(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    query = {"tenant_id": tenant_id}
    if status:
        query["status"] = status
    
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
    mode: Literal["ai", "agent", "hybrid"],
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.conversations.find_one_and_update(
        {"id": conversation_id, "tenant_id": tenant_id},
        {
            "$set": {
                "mode": mode,
                "assigned_agent_id": current_user["id"] if mode == "agent" else None,
                "updated_at": now
            }
        },
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Remove _id before returning
    result.pop("_id", None)
    return result

@conversations_router.patch("/{conversation_id}/status", response_model=ConversationResponse)
async def update_conversation_status(
    conversation_id: str,
    status: Literal["open", "waiting", "resolved"],
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.conversations.find_one_and_update(
        {"id": conversation_id, "tenant_id": tenant_id},
        {"$set": {"status": status, "updated_at": now}},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    result.pop("_id", None)
    return result

# ============== WIDGET (PUBLIC) ROUTES ==============

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
    
    return {"messages": messages}

@widget_router.post("/messages/{conversation_id}")
async def send_widget_message(conversation_id: str, message_data: WidgetMessageCreate, token: str):
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
    
    return {
        "customer_message": {k: v for k, v in customer_message_doc.items() if k != "_id"},
        "ai_message": ai_message
    }

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
            "brand_name": settings.get("brand_name") if settings else None
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
    avatar_url: str,
    current_user: dict = Depends(get_current_user)
):
    """Update avatar URL (for simplicity, accepts URL; in production would handle file upload)"""
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
api_router.include_router(auth_router)
api_router.include_router(tenants_router)
api_router.include_router(conversations_router)
api_router.include_router(settings_router)
api_router.include_router(widget_router)
api_router.include_router(admin_router)
api_router.include_router(users_router)
api_router.include_router(profile_router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
