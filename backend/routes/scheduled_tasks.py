"""
Scheduled Tasks API Routes
Manage scheduled tasks for AI agents
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime, timezone

import sys
sys.path.append('/app/backend')
from server import db, get_current_user
from services.task_scheduler_service import get_scheduler_service
from services.tool_registry import TOOL_REGISTRY, TOOL_FEATURE_GATES

router = APIRouter(prefix="/scheduled-tasks", tags=["scheduled-tasks"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class ScheduleConfig(BaseModel):
    type: Literal["cron", "interval", "one_time"] = Field(..., description="Schedule type")
    cron_expression: Optional[str] = Field(None, description="Cron expression (for type=cron)")
    interval_minutes: Optional[int] = Field(None, description="Interval in minutes (for type=interval)")
    run_at: Optional[str] = Field(None, description="ISO datetime to run (for type=one_time)")
    timezone: str = Field(default="UTC", description="Timezone for the schedule")


class OnCompleteAction(BaseModel):
    action: Literal["send_notification", "run_tool", "webhook"] = Field(..., description="Action type")
    params: Dict[str, Any] = Field(default_factory=dict, description="Action parameters")


class TaskCreate(BaseModel):
    name: str = Field(..., description="Task name")
    description: Optional[str] = Field(None, description="Task description")
    agent_id: str = Field(..., description="Agent ID that will execute the task")
    tool_name: str = Field(..., description="Tool to execute")
    tool_params: Dict[str, Any] = Field(default_factory=dict, description="Tool parameters")
    schedule: ScheduleConfig = Field(..., description="Schedule configuration")
    enabled: bool = Field(default=True, description="Whether task is enabled")
    on_complete: Optional[OnCompleteAction] = Field(None, description="Post-completion action")


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tool_name: Optional[str] = None
    tool_params: Optional[Dict[str, Any]] = None
    schedule: Optional[ScheduleConfig] = None
    enabled: Optional[bool] = None
    on_complete: Optional[OnCompleteAction] = None


class TaskResponse(BaseModel):
    id: str
    tenant_id: str
    agent_id: str
    name: str
    description: Optional[str] = None
    tool_name: str
    tool_params: Dict[str, Any]
    schedule: Dict[str, Any]
    enabled: bool
    on_complete: Optional[Dict[str, Any]] = None
    last_execution: Optional[Dict[str, Any]] = None
    next_run: Optional[str] = None
    execution_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    created_at: str
    updated_at: str


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def check_task_quota(tenant_id: str, tenant_tier: str) -> Dict[str, Any]:
    """Check if tenant can create more tasks"""
    gate = TOOL_FEATURE_GATES.get("agent_scheduled_tasks", {})
    tier_limits = gate.get("tier_limits", {})
    limit = tier_limits.get(tenant_tier, 0)
    
    if limit == 0:
        return {
            "allowed": False,
            "reason": f"Scheduled tasks not available on {tenant_tier} plan"
        }
    
    # Count existing tasks
    scheduler = await get_scheduler_service(db)
    existing_tasks = await scheduler.list_tasks(tenant_id)
    current_count = len(existing_tasks)
    
    if current_count >= limit:
        return {
            "allowed": False,
            "reason": f"Task limit reached. Limit: {limit}, Current: {current_count}"
        }
    
    return {"allowed": True, "remaining": limit - current_count}


# =============================================================================
# CRUD ENDPOINTS
# =============================================================================

@router.get("", response_model=List[TaskResponse])
@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    agent_id: Optional[str] = Query(None, description="Filter by agent ID"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """List all scheduled tasks for the tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    scheduler = await get_scheduler_service(db)
    tasks = await scheduler.list_tasks(
        tenant_id=tenant_id,
        agent_id=agent_id,
        enabled=enabled,
        limit=limit,
        skip=skip
    )
    return tasks


@router.post("", response_model=TaskResponse)
@router.post("/", response_model=TaskResponse)
async def create_task(
    task_data: TaskCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new scheduled task"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check quota
    tenant_tier = current_user.get("tier", "starter")
    quota_check = await check_task_quota(tenant_id, tenant_tier)
    if not quota_check["allowed"]:
        raise HTTPException(status_code=403, detail=quota_check["reason"])
    
    # Validate tool exists
    if task_data.tool_name not in TOOL_REGISTRY:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown tool: {task_data.tool_name}"
        )
    
    # Validate schedule
    schedule = task_data.schedule
    if schedule.type == "cron" and not schedule.cron_expression:
        raise HTTPException(
            status_code=400,
            detail="cron_expression required for cron schedule"
        )
    if schedule.type == "interval" and not schedule.interval_minutes:
        raise HTTPException(
            status_code=400,
            detail="interval_minutes required for interval schedule"
        )
    if schedule.type == "one_time" and not schedule.run_at:
        raise HTTPException(
            status_code=400,
            detail="run_at required for one_time schedule"
        )
    
    scheduler = await get_scheduler_service(db)
    
    # Check for duplicate name
    existing = await scheduler.get_task_by_name(task_data.name, tenant_id)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Task with name '{task_data.name}' already exists"
        )
    
    task = await scheduler.create_task(
        tenant_id=tenant_id,
        agent_id=task_data.agent_id,
        name=task_data.name,
        description=task_data.description,
        tool_name=task_data.tool_name,
        tool_params=task_data.tool_params,
        schedule_type=schedule.type,
        schedule_config={
            "cron_expression": schedule.cron_expression,
            "interval_minutes": schedule.interval_minutes,
            "run_at": schedule.run_at
        },
        timezone_str=schedule.timezone,
        enabled=task_data.enabled,
        on_complete=task_data.on_complete.model_dump() if task_data.on_complete else None
    )
    
    return task


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific task by ID"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    scheduler = await get_scheduler_service(db)
    task = await scheduler.get_task(task_id, tenant_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    updates: TaskUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a task"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    scheduler = await get_scheduler_service(db)
    
    # Verify task exists
    existing = await scheduler.get_task(task_id, tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Build update dict
    update_data = {}
    if updates.name is not None:
        update_data["name"] = updates.name
    if updates.description is not None:
        update_data["description"] = updates.description
    if updates.tool_name is not None:
        if updates.tool_name not in TOOL_REGISTRY:
            raise HTTPException(status_code=400, detail=f"Unknown tool: {updates.tool_name}")
        update_data["tool_name"] = updates.tool_name
    if updates.tool_params is not None:
        update_data["tool_params"] = updates.tool_params
    if updates.schedule is not None:
        update_data["schedule"] = {
            "type": updates.schedule.type,
            "cron_expression": updates.schedule.cron_expression,
            "interval_minutes": updates.schedule.interval_minutes,
            "run_at": updates.schedule.run_at,
            "timezone": updates.schedule.timezone
        }
    if updates.enabled is not None:
        update_data["enabled"] = updates.enabled
    if updates.on_complete is not None:
        update_data["on_complete"] = updates.on_complete.model_dump()
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    task = await scheduler.update_task(task_id, tenant_id, update_data)
    
    if not task:
        raise HTTPException(status_code=500, detail="Failed to update task")
    
    return task


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a task"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    scheduler = await get_scheduler_service(db)
    
    # Verify task exists
    existing = await scheduler.get_task(task_id, tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    
    deleted = await scheduler.delete_task(task_id, tenant_id)
    
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete task")
    
    return {"message": "Task deleted successfully", "task_id": task_id}


# =============================================================================
# TASK ACTIONS
# =============================================================================

@router.post("/{task_id}/run")
async def run_task_now(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Trigger immediate execution of a task"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    scheduler = await get_scheduler_service(db)
    
    # Verify task exists
    existing = await scheduler.get_task(task_id, tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    
    result = await scheduler.run_task_now(task_id, tenant_id)
    return result


@router.post("/{task_id}/enable", response_model=TaskResponse)
async def enable_task(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Enable a task"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    scheduler = await get_scheduler_service(db)
    task = await scheduler.enable_task(task_id, tenant_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task


@router.post("/{task_id}/disable", response_model=TaskResponse)
async def disable_task(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Disable a task"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    scheduler = await get_scheduler_service(db)
    task = await scheduler.disable_task(task_id, tenant_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task


# =============================================================================
# EXECUTION HISTORY
# =============================================================================

@router.get("/{task_id}/executions")
async def get_task_executions(
    task_id: str,
    limit: int = Query(20, le=100),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get execution history for a specific task"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    scheduler = await get_scheduler_service(db)
    
    # Verify task exists
    existing = await scheduler.get_task(task_id, tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    
    executions = await scheduler.get_task_executions(
        task_id=task_id,
        tenant_id=tenant_id,
        limit=limit,
        skip=skip
    )
    
    return {"executions": executions, "count": len(executions)}


@router.get("/executions/all")
async def get_all_executions(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get all task executions for the tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    scheduler = await get_scheduler_service(db)
    executions = await scheduler.get_all_executions(
        tenant_id=tenant_id,
        limit=limit,
        skip=skip,
        status=status
    )
    
    return {"executions": executions, "count": len(executions)}


# =============================================================================
# SCHEDULER STATUS
# =============================================================================

@router.get("/status/scheduler")
async def get_scheduler_status(
    current_user: dict = Depends(get_current_user)
):
    """Get scheduler status and statistics"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    scheduler = await get_scheduler_service(db)
    stats = scheduler.get_scheduler_stats()
    
    # Get task counts for this tenant
    tasks = await scheduler.list_tasks(tenant_id)
    enabled_count = sum(1 for t in tasks if t.get("enabled"))
    
    # Get quota info
    tenant_tier = current_user.get("tier", "starter")
    gate = TOOL_FEATURE_GATES.get("agent_scheduled_tasks", {})
    tier_limits = gate.get("tier_limits", {})
    limit = tier_limits.get(tenant_tier, 0)
    
    return {
        "scheduler": stats,
        "tenant_stats": {
            "total_tasks": len(tasks),
            "enabled_tasks": enabled_count,
            "disabled_tasks": len(tasks) - enabled_count,
            "quota_limit": limit,
            "quota_remaining": max(0, limit - len(tasks))
        },
        "tier": tenant_tier
    }
