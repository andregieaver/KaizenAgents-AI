from pydantic import BaseModel, ConfigDict
from typing import Optional

class TenantCreate(BaseModel):
    name: str
    domain: Optional[str] = None

class TenantResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    domain: Optional[str] = None
    created_at: str
