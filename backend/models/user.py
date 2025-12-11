from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional

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
