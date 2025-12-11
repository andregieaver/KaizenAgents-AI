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

class TestConversationRequest(BaseModel):
    message: str
    history: List[dict] = []
