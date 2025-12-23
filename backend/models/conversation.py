from pydantic import BaseModel, ConfigDict
from typing import Optional, Literal

class ConversationCreate(BaseModel):
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    source: Literal["widget", "email", "api"] = "widget"

class ConversationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: str
    customer_id: Optional[str] = None
    crm_customer_id: Optional[str] = None  # Link to CRM customer
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
