"""
Feature Gate Models for subscription-based quota and limit management
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime


class PlanLimit(BaseModel):
    """Limits for a specific feature on a specific plan"""
    enabled: bool = True
    limit_value: Optional[int] = None          # Quota limit (None = unlimited)
    limit_type: str = "quota"                  # "quota" or "usage"
    unit: Optional[str] = None                 # e.g., "agents", "seats", "tokens", "messages"
    

class FeatureQuota(BaseModel):
    """A single feature quota configuration across all plans"""
    feature_key: str                           # Unique key, e.g., "max_agents"
    feature_name: str                          # Human-readable name
    feature_description: str                   # Description of what this limits
    category: str                              # e.g., "agents", "team", "usage", "content"
    limit_type: str                            # "quota" (max items) or "usage" (consumption)
    unit: str                                  # e.g., "agents", "seats", "tokens", "pages"
    plans: Dict[str, PlanLimit]                # Plan name -> PlanLimit
    

class FeatureGateConfig(BaseModel):
    """Complete feature gate configuration"""
    model_config = ConfigDict(extra="ignore")
    id: str
    routes: List[FeatureGateRoute]
    plans: List[str]                          # Available plan names
    created_at: str
    updated_at: str


class FeatureGateUpdate(BaseModel):
    """Update request for feature gate configuration"""
    routes: List[FeatureGateRoute]


class UsageRecord(BaseModel):
    """Track API usage for rate limiting"""
    tenant_id: str
    route_path: str
    route_method: str
    timestamp: str
    hour_bucket: str   # e.g., "2025-12-16-15"
    day_bucket: str    # e.g., "2025-12-16"


class SubscriptionPlan(BaseModel):
    """User's subscription plan"""
    model_config = ConfigDict(extra="ignore")
    tenant_id: str
    plan_name: str     # "free", "basic", "pro", "enterprise"
    plan_display_name: str
    active: bool
    started_at: str
    expires_at: Optional[str] = None
