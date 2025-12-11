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
    date_format: Optional[str] = None
    time_format: Optional[Literal["12h", "24h"]] = None
    timezone: Optional[str] = None

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
    date_format: str
    time_format: str
    timezone: str
    updated_at: str

class ConversationCreate(BaseModel):
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    source: Literal["widget", "email", "api"] = "widget"

# ============== PROVIDER MODELS ==============

class ProviderCreate(BaseModel):
    name: str
    type: Literal["openai", "anthropic", "google"]
    api_key: str
    base_url: Optional[str] = None

class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    is_active: Optional[bool] = None

class ProviderResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    type: str
    is_active: bool
    masked_api_key: Optional[str] = None
    total_calls: int
    total_tokens: int
    total_cost: float
    last_error: Optional[str] = None
    models: List[str] = []
    created_at: str
    updated_at: str

class ProviderErrorResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    provider_id: str
    error_message: str
    error_type: str
    timestamp: str

# ============== AGENT MODELS ==============

class AgentCreate(BaseModel):
    name: str
    provider_id: str
    model: str
    system_prompt: str
    temperature: float = 0.7
    max_tokens: int = 2000
    is_marketplace: bool = False

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    is_active: Optional[bool] = None
    is_marketplace: Optional[bool] = None

class AgentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    avatar_url: Optional[str] = None
    provider_id: str
    provider_name: str
    model: str
    system_prompt: str
    temperature: float
    max_tokens: int
    version: int
    is_active: bool
    is_marketplace: bool
    created_at: str
    updated_at: str

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
        
        user_message = UserMessage(text=f"Previous conversation:\n{context}\n\nPlease respond to the latest customer message.")
        
        response = await chat.send_message(user_message)
        return response
        
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
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"logo_{tenant_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Generate URL (relative to API)
    logo_url = f"/api/uploads/{filename}"
    
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
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"platform_logo_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Generate URL (relative to API)
    logo_url = f"/api/uploads/{filename}"
    
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
    
    # Generate filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"agent_{agent_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Update agent
    avatar_url = f"/api/uploads/{filename}"
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
    message: str = "Hello, can you help me?",
    admin_user: dict = Depends(get_super_admin_user)
):
    """Test agent in sandbox (ephemeral)"""
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
            
            params = {
                "model": agent["model"],
                "messages": [
                    {"role": "system", "content": agent["system_prompt"]},
                    {"role": "user", "content": message}
                ]
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
            response = client.messages.create(
                model=agent["model"],
                max_tokens=agent["max_tokens"],
                temperature=agent["temperature"],
                system=agent["system_prompt"],
                messages=[{"role": "user", "content": message}]
            )
            reply = response.content[0].text
        
        elif provider["type"] == "google":
            # Placeholder for Google AI
            reply = "Google AI integration pending"
        
        else:
            raise HTTPException(status_code=400, detail="Unknown provider type")
        
        return {
            "status": "success",
            "user_message": message,
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
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Generate URL (relative to API)
    avatar_url = f"/api/uploads/{filename}"
    
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
api_router.include_router(auth_router)
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
