"""
Feature Gate Models for subscription-based API access control
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime


class RouteLimit(BaseModel):
    """Limits for a specific route on a specific plan"""
    enabled: bool = True
    rate_limit_per_hour: Optional[int] = None  # Max requests per hour
    rate_limit_per_day: Optional[int] = None   # Max requests per day
    quota_limit: Optional[int] = None          # Max items (e.g., max agents, max pages)
    custom_params: Dict[str, Any] = {}         # Additional custom parameters


class FeatureGateRoute(BaseModel):
    """A single route configuration across all plans"""
    route_path: str                           # e.g., "/api/agents/"
    route_method: str                         # e.g., "POST", "GET", "*"
    route_name: str                           # Human-readable name
    route_description: str                    # Description of what this route does
    category: str                             # e.g., "agents", "pages", "conversations"
    plans: Dict[str, RouteLimit]              # Plan name -> RouteLimit
    

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
