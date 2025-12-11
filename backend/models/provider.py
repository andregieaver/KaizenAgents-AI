from pydantic import BaseModel, ConfigDict
from typing import Optional, Literal, List

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
