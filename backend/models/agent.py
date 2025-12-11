from pydantic import BaseModel, ConfigDict
from typing import Optional, List

class AgentCreate(BaseModel):
    name: str
    provider_id: str
    model: str
    system_prompt: str
    temperature: float = 0.7
    max_tokens: int = 2000
    is_marketplace: bool = False
    response_language: Optional[str] = None  # Language code (e.g., 'en', 'es', 'fr')
    force_language: bool = False  # Force language or auto-detect
    language_detection_method: Optional[str] = "browser"  # 'browser' or 'ip'

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    is_active: Optional[bool] = None
    is_marketplace: Optional[bool] = None
    response_language: Optional[str] = None
    force_language: Optional[bool] = None
    language_detection_method: Optional[str] = None

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
    response_language: Optional[str] = None
    force_language: bool = False
    language_detection_method: Optional[str] = "browser"
    created_at: str
    updated_at: str

class TestConversationRequest(BaseModel):
    message: str
    history: List[dict] = []
