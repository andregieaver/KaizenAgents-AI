"""Orchestration models for Mother/Child agent architecture"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any


class OrchestrationPolicy(BaseModel):
    """Policy settings for orchestration behavior"""
    max_delegation_depth: int = 1  # How many levels of delegation allowed
    require_confirmation: bool = False  # Whether to confirm before executing
    fallback_to_mother: bool = True  # If no child matches, mother handles directly
    timeout_seconds: int = 30  # Timeout for child agent execution


class OrchestrationConfig(BaseModel):
    """Orchestration configuration for a company"""
    enabled: bool = False
    mother_admin_agent_id: Optional[str] = None
    allowed_child_agent_ids: List[str] = []
    policy: OrchestrationPolicy = OrchestrationPolicy()


class OrchestrationConfigUpdate(BaseModel):
    """Update model for orchestration configuration"""
    enabled: Optional[bool] = None
    mother_admin_agent_id: Optional[str] = None
    allowed_child_agent_ids: Optional[List[str]] = None
    policy: Optional[Dict[str, Any]] = None


class ChildAgentOrchestrationUpdate(BaseModel):
    """Update model for child agent orchestration settings"""
    orchestration_enabled: Optional[bool] = None
    tags: Optional[List[str]] = None


class OrchestrationAction(BaseModel):
    """A single action requested or executed during orchestration"""
    child_agent_id: str
    child_agent_name: str
    action_type: str  # e.g., 'woocommerce_query', 'knowledge_search'
    parameters: Dict[str, Any] = {}
    result: Optional[Dict[str, Any]] = None
    status: str = "pending"  # pending, executing, completed, failed
    error_message: Optional[str] = None


class OrchestrationRunCreate(BaseModel):
    """Create model for orchestration run audit log"""
    tenant_id: str
    conversation_id: str
    mother_admin_agent_id: str
    user_prompt: str


class OrchestrationRunResponse(BaseModel):
    """Response model for orchestration run audit log"""
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: str
    conversation_id: str
    mother_admin_agent_id: str
    user_prompt: str
    requested_actions: List[Dict[str, Any]] = []
    executed_actions: List[Dict[str, Any]] = []
    final_response: Optional[str] = None
    status: str = "pending"  # pending, processing, completed, failed
    created_at: str
    completed_at: Optional[str] = None


class AvailableChildAgent(BaseModel):
    """Information about a child agent available for orchestration"""
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: str
    category: str
    tags: List[str] = []
    capabilities: List[str] = []  # Derived from config (e.g., has_woocommerce)


class OrchestrationStatusResponse(BaseModel):
    """Current orchestration status for a tenant"""
    model_config = ConfigDict(extra="ignore")
    enabled: bool
    mother_agent_id: Optional[str] = None
    mother_agent_name: Optional[str] = None
    available_children_count: int = 0
    allowed_children_count: int = 0
    recent_runs_count: int = 0
