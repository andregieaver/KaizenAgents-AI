from pydantic import BaseModel, ConfigDict
from typing import Optional, Literal

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
