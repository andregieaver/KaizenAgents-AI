"""
Agent Tools API Routes
Manage tool configuration, execution, and history
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from uuid import uuid4

import sys
sys.path.append('/app/backend')
from server import db, get_current_user
from services.tool_registry import (
    TOOL_REGISTRY,
    TOOL_FEATURE_GATES,
    TOOLS_BY_CATEGORY,
    ToolCategory,
    get_tool_schema,
    get_all_tool_names,
    get_tools_by_feature
)
from services.tool_orchestrator import ToolOrchestrator

router = APIRouter(prefix="/agent-tools", tags=["agent-tools"])

# Initialize orchestrator
_orchestrator = None

def get_orchestrator() -> ToolOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = ToolOrchestrator(db)
    return _orchestrator


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class ToolConfigUpdate(BaseModel):
    enabled_tools: List[str]
    tool_settings: Optional[Dict[str, Any]] = None
    allowed_domains: Optional[List[str]] = None


class ToolExecuteRequest(BaseModel):
    tool_name: str
    params: Dict[str, Any] = {}
    session_id: Optional[str] = None


class SessionCreateRequest(BaseModel):
    pass  # No params needed for now


# =============================================================================
# TOOL CATALOG ENDPOINTS
# =============================================================================

@router.get("/available")
async def get_available_tools(
    current_user: dict = Depends(get_current_user)
):
    """Get all available tools with their schemas"""
    tools_by_category = {}
    
    for category in ToolCategory:
        tools = TOOLS_BY_CATEGORY.get(category, [])
        tools_by_category[category.value] = [
            {
                "name": tool["function"]["name"],
                "description": tool["function"]["description"],
                "parameters": tool["function"]["parameters"],
                "feature_key": tool.get("feature_key")
            }
            for tool in tools
        ]
    
    return {
        "tools_by_category": tools_by_category,
        "feature_gates": TOOL_FEATURE_GATES
    }


@router.get("/schema/{tool_name}")
async def get_tool_schema_endpoint(
    tool_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Get schema for a specific tool"""
    schema = get_tool_schema(tool_name)
    if not schema:
        raise HTTPException(status_code=404, detail=f"Tool not found: {tool_name}")
    
    return {
        "name": tool_name,
        "schema": schema["function"],
        "feature_key": schema.get("feature_key"),
        "category": schema.get("category")
    }


# =============================================================================
# AGENT TOOL CONFIGURATION
# =============================================================================

@router.get("/agents/{agent_id}/config")
async def get_agent_tool_config(
    agent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get tool configuration for an agent"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    config = await db.agent_tool_configs.find_one({
        "agent_id": agent_id,
        "tenant_id": tenant_id
    }, {"_id": 0})
    
    if not config:
        # Return default config
        config = {
            "agent_id": agent_id,
            "tenant_id": tenant_id,
            "enabled_tools": ["browse_website", "take_screenshot", "extract_text", "get_page_info"],
            "tool_settings": {
                "browser": {
                    "default_timeout": 30000,
                    "viewport": {"width": 1920, "height": 1080}
                }
            },
            "allowed_domains": ["*"]
        }
    
    return config


@router.put("/agents/{agent_id}/config")
async def update_agent_tool_config(
    agent_id: str,
    config: ToolConfigUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update tool configuration for an agent"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Validate tool names
    all_tools = get_all_tool_names()
    invalid_tools = [t for t in config.enabled_tools if t not in all_tools]
    if invalid_tools:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid tool names: {invalid_tools}"
        )
    
    now = datetime.now(timezone.utc)
    
    update_data = {
        "agent_id": agent_id,
        "tenant_id": tenant_id,
        "enabled_tools": config.enabled_tools,
        "updated_at": now.isoformat()
    }
    
    if config.tool_settings:
        update_data["tool_settings"] = config.tool_settings
    if config.allowed_domains:
        update_data["allowed_domains"] = config.allowed_domains
    
    await db.agent_tool_configs.update_one(
        {"agent_id": agent_id, "tenant_id": tenant_id},
        {
            "$set": update_data,
            "$setOnInsert": {
                "id": str(uuid4()),
                "created_at": now.isoformat()
            }
        },
        upsert=True
    )
    
    return {"message": "Tool configuration updated", "enabled_tools": config.enabled_tools}


# =============================================================================
# TOOL EXECUTION
# =============================================================================

@router.post("/execute")
async def execute_tool(
    request: ToolExecuteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Execute a tool directly (for testing/manual use)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get user's tier (default to starter)
    tenant_tier = current_user.get("tier", "starter")
    
    orchestrator = get_orchestrator()
    
    result = await orchestrator.execute_tool(
        tool_name=request.tool_name,
        params=request.params,
        tenant_id=tenant_id,
        agent_id="manual",  # Manual execution
        tenant_tier=tenant_tier,
        session_id=request.session_id
    )
    
    return result


@router.post("/sessions")
async def create_browser_session(
    current_user: dict = Depends(get_current_user)
):
    """Create a new browser session for multi-step operations"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    orchestrator = get_orchestrator()
    session_id = await orchestrator.create_session(tenant_id)
    
    return {"session_id": session_id}


@router.delete("/sessions/{session_id}")
async def close_browser_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Close a browser session"""
    orchestrator = get_orchestrator()
    await orchestrator.close_session(session_id)
    
    return {"message": "Session closed"}


# =============================================================================
# EXECUTION HISTORY
# =============================================================================

@router.get("/executions")
async def get_execution_history(
    agent_id: Optional[str] = None,
    tool_name: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get tool execution history"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    orchestrator = get_orchestrator()
    
    executions = await orchestrator.get_execution_history(
        tenant_id=tenant_id,
        agent_id=agent_id,
        tool_name=tool_name,
        status=status,
        limit=limit,
        skip=skip
    )
    
    return {"executions": executions, "count": len(executions)}


@router.get("/executions/{execution_id}")
async def get_execution_details(
    execution_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get details of a specific execution"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    execution = await db.tool_executions.find_one({
        "id": execution_id,
        "tenant_id": tenant_id
    }, {"_id": 0})
    
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    return execution


# =============================================================================
# USAGE STATS
# =============================================================================

@router.get("/usage")
async def get_usage_stats(
    days: int = Query(7, le=30),
    current_user: dict = Depends(get_current_user)
):
    """Get tool usage statistics"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    orchestrator = get_orchestrator()
    
    stats = await orchestrator.get_usage_stats(tenant_id, days)
    
    # Add current limits based on tier
    tenant_tier = current_user.get("tier", "starter")
    limits = {}
    for feature_key, gate in TOOL_FEATURE_GATES.items():
        tier_limits = gate.get("tier_limits", {})
        limits[feature_key] = tier_limits.get(tenant_tier, 0)
    
    return {
        **stats,
        "limits": limits,
        "tier": tenant_tier
    }


@router.get("/usage/current-hour")
async def get_current_hour_usage(
    current_user: dict = Depends(get_current_user)
):
    """Get usage for current hour (for rate limit display)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y-%m-%d")
    hour = now.hour
    
    usage = await db.tool_usage_tracking.find_one({
        "tenant_id": tenant_id,
        "date": date_str,
        "hour": hour
    }, {"_id": 0})
    
    if not usage:
        usage = {"tool_counts": {}, "total_executions": 0}
    
    # Add limits
    tenant_tier = current_user.get("tier", "starter")
    limits = {}
    for feature_key, gate in TOOL_FEATURE_GATES.items():
        tier_limits = gate.get("tier_limits", {})
        limits[feature_key] = tier_limits.get(tenant_tier, 0)
    
    return {
        "current_hour": {
            "date": date_str,
            "hour": hour,
            "tool_counts": usage.get("tool_counts", {}),
            "total_executions": usage.get("total_executions", 0)
        },
        "limits": limits,
        "tier": tenant_tier
    }
