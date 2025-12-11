"""
Pydantic models for request/response validation
"""
from .user import UserCreate, UserLogin, UserResponse
from .tenant import TenantCreate, TenantResponse
from .settings import SettingsUpdate, SettingsResponse
from .conversation import ConversationCreate, ConversationResponse, MessageCreate, MessageResponse
from .provider import ProviderCreate, ProviderUpdate, ProviderResponse, ProviderErrorResponse
from .agent import AgentCreate, AgentUpdate, AgentResponse, TestConversationRequest
from .storage import StorageConfigCreate, StorageConfigResponse
from .agent_config import (
    CompanyAgentConfigUpdate,
    CompanyAgentConfigResponse,
    DocumentInfo,
    ScrapingTriggerRequest,
    ScrapingStatusResponse
)

__all__ = [
    "UserCreate", "UserLogin", "UserResponse",
    "TenantCreate", "TenantResponse",
    "SettingsUpdate", "SettingsResponse",
    "ConversationCreate", "ConversationResponse", "MessageCreate", "MessageResponse",
    "ProviderCreate", "ProviderUpdate", "ProviderResponse", "ProviderErrorResponse",
    "AgentCreate", "AgentUpdate", "AgentResponse", "TestConversationRequest",
    "StorageConfigCreate", "StorageConfigResponse",
    "CompanyAgentConfigUpdate", "CompanyAgentConfigResponse", "DocumentInfo",
    "ScrapingTriggerRequest", "ScrapingStatusResponse"
]
