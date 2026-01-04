"""
Project Management API Routes
Spaces, Projects, Lists, Tasks, Subtasks, Checklists, Dependencies
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from uuid import uuid4
from enum import Enum

import sys
sys.path.append('/app/backend')
from server import db, get_current_user


router = APIRouter(prefix="/projects", tags=["projects"])


# =============================================================================
# DEFAULT STATUSES
# =============================================================================

DEFAULT_PROJECT_STATUSES = [
    {"id": "planning", "name": "Planning", "color": "#6B7280"},
    {"id": "active", "name": "Active", "color": "#3B82F6"},
    {"id": "on_hold", "name": "On Hold", "color": "#F59E0B"},
    {"id": "completed", "name": "Completed", "color": "#10B981"},
    {"id": "archived", "name": "Archived", "color": "#9CA3AF"},
]

DEFAULT_TASK_STATUSES = [
    {"id": "todo", "name": "To Do", "color": "#6B7280"},
    {"id": "in_progress", "name": "In Progress", "color": "#3B82F6"},
    {"id": "review", "name": "Review", "color": "#8B5CF6"},
    {"id": "done", "name": "Done", "color": "#10B981"},
]

DEFAULT_PRIORITIES = [
    {"id": "low", "name": "Low", "color": "#6B7280"},
    {"id": "medium", "name": "Medium", "color": "#3B82F6"},
    {"id": "high", "name": "High", "color": "#F59E0B"},
    {"id": "urgent", "name": "Urgent", "color": "#EF4444"},
]


# =============================================================================
# PYDANTIC MODELS - SPACES
# =============================================================================

class SpaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = "#6366F1"
    icon: Optional[str] = "folder"


class SpaceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    custom_statuses: Optional[List["ProjectStatusConfig"]] = None


# =============================================================================
# PYDANTIC MODELS - PROJECTS
# =============================================================================

class ProjectStatusConfig(BaseModel):
    id: str
    name: str
    color: str
    is_final: bool = False
    order: int = 0


# Default statuses used when no custom statuses are set
DEFAULT_TASK_STATUSES = [
    {"id": "todo", "name": "To Do", "color": "#6B7280", "is_final": False, "order": 0},
    {"id": "in_progress", "name": "In Progress", "color": "#3B82F6", "is_final": False, "order": 1},
    {"id": "review", "name": "Review", "color": "#F59E0B", "is_final": False, "order": 2},
    {"id": "done", "name": "Done", "color": "#10B981", "is_final": True, "order": 3},
]

# Default project phases for project-level task views
DEFAULT_PROJECT_PHASES = [
    {"id": "planning", "name": "Planning", "color": "#6B7280", "is_final": False, "order": 0},
    {"id": "in_progress", "name": "In Progress", "color": "#3B82F6", "is_final": False, "order": 1},
    {"id": "review", "name": "Review", "color": "#F59E0B", "is_final": False, "order": 2},
    {"id": "completed", "name": "Completed", "color": "#10B981", "is_final": True, "order": 3},
]


class StatusUpdateRequest(BaseModel):
    """Request model for updating statuses"""
    statuses: List[ProjectStatusConfig]


class StatusReassignRequest(BaseModel):
    """Request model for reassigning tasks when deleting a status"""
    from_status_id: str
    to_status_id: str


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    space_id: str
    color: Optional[str] = "#6366F1"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    project_statuses: Optional[List[ProjectStatusConfig]] = None
    task_statuses: Optional[List[ProjectStatusConfig]] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    project_statuses: Optional[List[ProjectStatusConfig]] = None
    task_statuses: Optional[List[ProjectStatusConfig]] = None


# =============================================================================
# PYDANTIC MODELS - LISTS
# =============================================================================

class ListCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = None
    custom_statuses: Optional[List[ProjectStatusConfig]] = None


class ListUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = None
    position: Optional[int] = None
    custom_statuses: Optional[List[ProjectStatusConfig]] = None


# =============================================================================
# PYDANTIC MODELS - TASKS
# =============================================================================

class ChecklistItem(BaseModel):
    id: Optional[str] = None
    text: str
    is_completed: bool = False


class ChecklistCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    items: List[ChecklistItem] = []


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    list_id: str
    status: Optional[str] = "todo"
    phase: Optional[str] = "planning"  # Project-level phase
    priority: Optional[str] = "medium"
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    start_date: Optional[str] = None
    estimated_hours: Optional[float] = None
    tags: Optional[List[str]] = []
    parent_task_id: Optional[str] = None  # For subtasks


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    list_id: Optional[str] = None
    status: Optional[str] = None
    phase: Optional[str] = None  # Project-level phase
    priority: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    start_date: Optional[str] = None
    estimated_hours: Optional[float] = None
    tags: Optional[List[str]] = None
    position: Optional[int] = None


class TaskMove(BaseModel):
    list_id: str
    position: Optional[int] = None


class DependencyCreate(BaseModel):
    depends_on_task_id: str  # This task depends on another task


# =============================================================================
# PYDANTIC MODELS - TAGS
# =============================================================================

class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: Optional[str] = "#6B7280"


class TagUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = None


# =============================================================================
# PYDANTIC MODELS - PHASES
# =============================================================================

class PhaseConfig(BaseModel):
    id: str
    name: str
    color: str
    is_final: bool = False
    order: int = 0


class PhaseUpdateRequest(BaseModel):
    """Request model for updating project phases"""
    phases: List[PhaseConfig]


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def check_projects_feature(tenant_id: str) -> bool:
    """Check if tenant has projects feature enabled"""
    feature_gate = await db.feature_gates.find_one({
        "tenant_id": tenant_id,
        "feature_key": "projects"
    })
    
    if feature_gate:
        return feature_gate.get("is_enabled", False)
    
    # Default: check tenant tier
    tenant = await db.tenants.find_one({"id": tenant_id})
    if tenant:
        tier = tenant.get("tier", "starter")
        return tier in ["professional", "enterprise", "unlimited"]
    
    return False


async def get_next_position(collection_name: str, filter_query: dict, field: str = "position") -> int:
    """Get next position for ordering"""
    last_item = await db[collection_name].find_one(
        filter_query,
        sort=[(field, -1)]
    )
    return (last_item.get(field, 0) + 1) if last_item else 0


# =============================================================================
# STATUS INHERITANCE HELPER FUNCTIONS
# =============================================================================

async def get_effective_statuses(
    tenant_id: str,
    space_id: str = None,
    project_id: str = None,
    list_id: str = None
) -> List[dict]:
    """
    Get effective statuses based on inheritance chain:
    List -> Project -> Space -> Default
    
    Returns the most specific custom statuses available, or defaults if none set.
    """
    # If list_id provided, check list first
    if list_id:
        list_doc = await db.project_lists.find_one(
            {"id": list_id, "tenant_id": tenant_id},
            {"custom_statuses": 1, "project_id": 1}
        )
        if list_doc and list_doc.get("custom_statuses"):
            return list_doc["custom_statuses"]
        # Get project_id for inheritance lookup
        if list_doc:
            project_id = list_doc.get("project_id")
    
    # If project_id provided or found, check project
    if project_id:
        project_doc = await db.projects.find_one(
            {"id": project_id, "tenant_id": tenant_id},
            {"custom_statuses": 1, "space_id": 1}
        )
        if project_doc and project_doc.get("custom_statuses"):
            return project_doc["custom_statuses"]
        # Get space_id for inheritance lookup
        if project_doc:
            space_id = project_doc.get("space_id")
    
    # If space_id provided or found, check space
    if space_id:
        space_doc = await db.project_spaces.find_one(
            {"id": space_id, "tenant_id": tenant_id},
            {"custom_statuses": 1}
        )
        if space_doc and space_doc.get("custom_statuses"):
            return space_doc["custom_statuses"]
    
    # Return default statuses
    return DEFAULT_TASK_STATUSES


async def get_tasks_using_status(
    tenant_id: str,
    status_id: str,
    space_id: str = None,
    project_id: str = None,
    list_id: str = None
) -> int:
    """Count tasks using a specific status within the given scope"""
    query = {"tenant_id": tenant_id, "status": status_id}
    
    if list_id:
        query["list_id"] = list_id
    elif project_id:
        query["project_id"] = project_id
    elif space_id:
        # Get all projects in space
        projects = await db.projects.find(
            {"tenant_id": tenant_id, "space_id": space_id},
            {"id": 1}
        ).to_list(1000)
        project_ids = [p["id"] for p in projects]
        query["project_id"] = {"$in": project_ids}
    
    return await db.project_tasks.count_documents(query)


# =============================================================================
# SPACES ENDPOINTS
# =============================================================================

@router.get("/spaces")
async def get_spaces(
    current_user: dict = Depends(get_current_user)
):
    """Get all spaces for the tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    spaces = await db.project_spaces.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).sort([("order", 1), ("created_at", -1)]).to_list(100)
    
    # Get project count for each space
    for space in spaces:
        count = await db.projects.count_documents({
            "tenant_id": tenant_id,
            "space_id": space["id"]
        })
        space["project_count"] = count
    
    return spaces


@router.post("/spaces")
async def create_space(
    space_data: SpaceCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new space"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    now = datetime.now(timezone.utc)
    
    # Get next order position
    next_order = await get_next_position("project_spaces", {
        "tenant_id": tenant_id
    }, field="order")
    
    space = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "name": space_data.name,
        "description": space_data.description,
        "color": space_data.color,
        "icon": space_data.icon,
        "order": next_order,
        "created_by": current_user.get("id"),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.project_spaces.insert_one(space)
    space.pop("_id", None)
    space["project_count"] = 0
    
    return space


class ReorderSpacesRequest(BaseModel):
    """Request model for reordering spaces"""
    space_ids: List[str] = Field(..., description="Ordered list of space IDs")


@router.post("/spaces/reorder")
async def reorder_spaces(
    request: ReorderSpacesRequest,
    current_user: dict = Depends(get_current_user)
):
    """Reorder spaces"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Update order for each space
    for index, space_id in enumerate(request.space_ids):
        await db.project_spaces.update_one(
            {"id": space_id, "tenant_id": tenant_id},
            {"$set": {"order": index, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Spaces reordered successfully"}


@router.get("/spaces/{space_id}")
async def get_space(
    space_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific space with its projects"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    space = await db.project_spaces.find_one(
        {"id": space_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Get projects in this space
    projects = await db.projects.find(
        {"tenant_id": tenant_id, "space_id": space_id},
        {"_id": 0}
    ).sort([("order", 1), ("created_at", -1)]).to_list(100)
    
    space["projects"] = projects
    
    return space


@router.put("/spaces/{space_id}")
async def update_space(
    space_id: str,
    space_data: SpaceUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a space"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    existing = await db.project_spaces.find_one(
        {"id": space_id, "tenant_id": tenant_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Space not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if space_data.name is not None:
        update_data["name"] = space_data.name
    if space_data.description is not None:
        update_data["description"] = space_data.description
    if space_data.color is not None:
        update_data["color"] = space_data.color
    if space_data.icon is not None:
        update_data["icon"] = space_data.icon
    
    await db.project_spaces.update_one(
        {"id": space_id},
        {"$set": update_data}
    )
    
    updated = await db.project_spaces.find_one(
        {"id": space_id},
        {"_id": 0}
    )
    
    return updated


@router.delete("/spaces/{space_id}")
async def delete_space(
    space_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a space and all its contents"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    existing = await db.project_spaces.find_one(
        {"id": space_id, "tenant_id": tenant_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Get all projects in this space
    projects = await db.projects.find(
        {"space_id": space_id, "tenant_id": tenant_id}
    ).to_list(1000)
    
    project_ids = [p["id"] for p in projects]
    
    # Delete all tasks in these projects
    if project_ids:
        await db.project_tasks.delete_many({"project_id": {"$in": project_ids}})
        await db.project_lists.delete_many({"project_id": {"$in": project_ids}})
        await db.task_dependencies.delete_many({"project_id": {"$in": project_ids}})
    
    # Delete projects
    await db.projects.delete_many({"space_id": space_id})
    
    # Delete space
    await db.project_spaces.delete_one({"id": space_id})
    
    return {"message": "Space deleted successfully"}


# =============================================================================
# STATUS MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/spaces/{space_id}/statuses")
async def get_space_statuses(
    space_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get effective statuses for a space"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    space = await db.project_spaces.find_one(
        {"id": space_id, "tenant_id": tenant_id},
        {"custom_statuses": 1}
    )
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    statuses = space.get("custom_statuses") or DEFAULT_TASK_STATUSES
    is_custom = bool(space.get("custom_statuses"))
    
    return {"statuses": statuses, "is_custom": is_custom, "inherited_from": None}


@router.put("/spaces/{space_id}/statuses")
async def update_space_statuses(
    space_id: str,
    request: StatusUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Set custom statuses for a space"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    space = await db.project_spaces.find_one(
        {"id": space_id, "tenant_id": tenant_id}
    )
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Convert to dicts and ensure order
    statuses = [
        {**s.model_dump(), "order": i} 
        for i, s in enumerate(request.statuses)
    ]
    
    await db.project_spaces.update_one(
        {"id": space_id, "tenant_id": tenant_id},
        {"$set": {"custom_statuses": statuses, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Space statuses updated", "statuses": statuses}


@router.delete("/spaces/{space_id}/statuses")
async def clear_space_statuses(
    space_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Clear custom statuses for a space (revert to defaults)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    await db.project_spaces.update_one(
        {"id": space_id, "tenant_id": tenant_id},
        {"$unset": {"custom_statuses": ""}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Space statuses cleared", "statuses": DEFAULT_TASK_STATUSES}


@router.get("/spaces/{space_id}/statuses/{status_id}/tasks-count")
async def get_space_status_task_count(
    space_id: str,
    status_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get count of tasks using a specific status in a space"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    count = await get_tasks_using_status(tenant_id, status_id, space_id=space_id)
    return {"count": count}


@router.get("/{project_id}/statuses")
async def get_project_statuses(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get effective statuses for a project (considering inheritance)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    project = await db.projects.find_one(
        {"id": project_id, "tenant_id": tenant_id},
        {"custom_statuses": 1, "space_id": 1}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if project has custom statuses
    if project.get("custom_statuses"):
        return {"statuses": project["custom_statuses"], "is_custom": True, "inherited_from": None}
    
    # Check space for inherited statuses
    space = await db.project_spaces.find_one(
        {"id": project["space_id"], "tenant_id": tenant_id},
        {"custom_statuses": 1, "name": 1}
    )
    
    if space and space.get("custom_statuses"):
        return {"statuses": space["custom_statuses"], "is_custom": False, "inherited_from": "space"}
    
    return {"statuses": DEFAULT_TASK_STATUSES, "is_custom": False, "inherited_from": None}


@router.put("/{project_id}/statuses")
async def update_project_statuses(
    project_id: str,
    request: StatusUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Set custom statuses for a project"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    project = await db.projects.find_one(
        {"id": project_id, "tenant_id": tenant_id}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    statuses = [
        {**s.model_dump(), "order": i} 
        for i, s in enumerate(request.statuses)
    ]
    
    await db.projects.update_one(
        {"id": project_id, "tenant_id": tenant_id},
        {"$set": {"custom_statuses": statuses, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Project statuses updated", "statuses": statuses}


@router.delete("/{project_id}/statuses")
async def clear_project_statuses(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Clear custom statuses for a project (revert to inherited)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    project = await db.projects.find_one(
        {"id": project_id, "tenant_id": tenant_id},
        {"space_id": 1}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.projects.update_one(
        {"id": project_id, "tenant_id": tenant_id},
        {"$unset": {"custom_statuses": ""}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Return inherited statuses
    statuses = await get_effective_statuses(tenant_id, space_id=project["space_id"])
    return {"message": "Project statuses cleared", "statuses": statuses}


@router.get("/{project_id}/statuses/{status_id}/tasks-count")
async def get_project_status_task_count(
    project_id: str,
    status_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get count of tasks using a specific status in a project"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    count = await get_tasks_using_status(tenant_id, status_id, project_id=project_id)
    return {"count": count}


@router.get("/lists/{list_id}/statuses")
async def get_list_statuses(
    list_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get effective statuses for a list (considering inheritance)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    list_doc = await db.project_lists.find_one(
        {"id": list_id, "tenant_id": tenant_id},
        {"custom_statuses": 1, "project_id": 1}
    )
    if not list_doc:
        raise HTTPException(status_code=404, detail="List not found")
    
    # Check if list has custom statuses
    if list_doc.get("custom_statuses"):
        return {"statuses": list_doc["custom_statuses"], "is_custom": True, "inherited_from": None}
    
    # Get project for inheritance check
    project = await db.projects.find_one(
        {"id": list_doc["project_id"], "tenant_id": tenant_id},
        {"custom_statuses": 1, "space_id": 1}
    )
    
    if project and project.get("custom_statuses"):
        return {"statuses": project["custom_statuses"], "is_custom": False, "inherited_from": "project"}
    
    # Check space
    if project:
        space = await db.project_spaces.find_one(
            {"id": project["space_id"], "tenant_id": tenant_id},
            {"custom_statuses": 1}
        )
        if space and space.get("custom_statuses"):
            return {"statuses": space["custom_statuses"], "is_custom": False, "inherited_from": "space"}
    
    return {"statuses": DEFAULT_TASK_STATUSES, "is_custom": False, "inherited_from": None}


@router.put("/lists/{list_id}/statuses")
async def update_list_statuses(
    list_id: str,
    request: StatusUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Set custom statuses for a list"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    list_doc = await db.project_lists.find_one(
        {"id": list_id, "tenant_id": tenant_id}
    )
    if not list_doc:
        raise HTTPException(status_code=404, detail="List not found")
    
    statuses = [
        {**s.model_dump(), "order": i} 
        for i, s in enumerate(request.statuses)
    ]
    
    await db.project_lists.update_one(
        {"id": list_id, "tenant_id": tenant_id},
        {"$set": {"custom_statuses": statuses, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "List statuses updated", "statuses": statuses}


@router.delete("/lists/{list_id}/statuses")
async def clear_list_statuses(
    list_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Clear custom statuses for a list (revert to inherited)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    list_doc = await db.project_lists.find_one(
        {"id": list_id, "tenant_id": tenant_id},
        {"project_id": 1}
    )
    if not list_doc:
        raise HTTPException(status_code=404, detail="List not found")
    
    await db.project_lists.update_one(
        {"id": list_id, "tenant_id": tenant_id},
        {"$unset": {"custom_statuses": ""}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Return inherited statuses
    statuses = await get_effective_statuses(tenant_id, project_id=list_doc["project_id"])
    return {"message": "List statuses cleared", "statuses": statuses}


@router.get("/lists/{list_id}/statuses/{status_id}/tasks-count")
async def get_list_status_task_count(
    list_id: str,
    status_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get count of tasks using a specific status in a list"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    count = await get_tasks_using_status(tenant_id, status_id, list_id=list_id)
    return {"count": count}


@router.post("/tasks/reassign-status")
async def reassign_task_status(
    request: StatusReassignRequest,
    project_id: str = None,
    list_id: str = None,
    space_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Reassign tasks from one status to another"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    query = {"tenant_id": tenant_id, "status": request.from_status_id}
    
    if list_id:
        query["list_id"] = list_id
    elif project_id:
        query["project_id"] = project_id
    elif space_id:
        projects = await db.projects.find(
            {"tenant_id": tenant_id, "space_id": space_id},
            {"id": 1}
        ).to_list(1000)
        project_ids = [p["id"] for p in projects]
        query["project_id"] = {"$in": project_ids}
    
    result = await db.project_tasks.update_many(
        query,
        {"$set": {"status": request.to_status_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Reassigned {result.modified_count} tasks"}


class ReorderTasksRequest(BaseModel):
    """Request model for reordering tasks"""
    task_ids: List[str] = Field(..., description="Ordered list of task IDs")
    status: Optional[str] = None  # If provided, only reorder within this status


@router.post("/lists/{list_id}/tasks/reorder")
async def reorder_tasks_in_list(
    list_id: str,
    request: ReorderTasksRequest,
    current_user: dict = Depends(get_current_user)
):
    """Reorder tasks within a list (optionally within a specific status)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify list exists
    list_doc = await db.project_lists.find_one(
        {"id": list_id, "tenant_id": tenant_id}
    )
    if not list_doc:
        raise HTTPException(status_code=404, detail="List not found")
    
    # Update order for each task
    for index, task_id in enumerate(request.task_ids):
        update_query = {"id": task_id, "tenant_id": tenant_id, "list_id": list_id}
        if request.status:
            update_query["status"] = request.status
        
        await db.project_tasks.update_one(
            update_query,
            {"$set": {"order": index, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Tasks reordered successfully"}


# =============================================================================
# MY TASKS ENDPOINT (Tasks assigned to current user)
# =============================================================================

@router.get("/my-tasks")
async def get_my_tasks(
    status: Optional[str] = None,
    include_completed: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get all tasks assigned to the current user, sorted by due date"""
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Build query for tasks assigned to current user
    query = {
        "tenant_id": tenant_id,
        "assignee_id": user_id,
        "parent_task_id": None  # Only top-level tasks, not subtasks
    }
    
    # Filter by status if provided
    if status:
        query["status"] = status
    elif not include_completed:
        # Exclude completed tasks by default
        query["status"] = {"$ne": "done"}
    
    # Fetch tasks sorted by due_date (nulls last), then by priority
    tasks = await db.project_tasks.find(
        query,
        {"_id": 0}
    ).sort([
        ("due_date", 1),  # Ascending - earliest due dates first
        ("priority", -1),  # High priority first
        ("created_at", -1)
    ]).to_list(100)
    
    # Enrich tasks with project and list info
    for task in tasks:
        # Get project info
        project = await db.projects.find_one(
            {"id": task.get("project_id")},
            {"_id": 0, "id": 1, "name": 1, "color": 1}
        )
        task["project"] = project
        
        # Get list info
        lst = await db.project_lists.find_one(
            {"id": task.get("list_id")},
            {"_id": 0, "id": 1, "name": 1}
        )
        task["list"] = lst
        
        # Get subtask count
        subtask_count = await db.project_tasks.count_documents({
            "parent_task_id": task["id"]
        })
        completed_subtasks = await db.project_tasks.count_documents({
            "parent_task_id": task["id"],
            "status": "done"
        })
        task["subtask_count"] = subtask_count
        task["completed_subtasks"] = completed_subtasks
    
    # Get stats
    total_assigned = await db.project_tasks.count_documents({
        "tenant_id": tenant_id,
        "assignee_id": user_id,
        "parent_task_id": None
    })
    overdue_count = await db.project_tasks.count_documents({
        "tenant_id": tenant_id,
        "assignee_id": user_id,
        "parent_task_id": None,
        "status": {"$ne": "done"},
        "due_date": {"$lt": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    })
    completed_count = await db.project_tasks.count_documents({
        "tenant_id": tenant_id,
        "assignee_id": user_id,
        "parent_task_id": None,
        "status": "done"
    })
    
    return {
        "tasks": tasks,
        "stats": {
            "total": total_assigned,
            "pending": total_assigned - completed_count,
            "completed": completed_count,
            "overdue": overdue_count
        }
    }


# =============================================================================
# PROJECTS ENDPOINTS
# =============================================================================

@router.get("")
async def get_all_projects(
    space_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all projects, optionally filtered by space"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    query = {"tenant_id": tenant_id}
    if space_id:
        query["space_id"] = space_id
    if status:
        query["status"] = status
    
    projects = await db.projects.find(
        query,
        {"_id": 0}
    ).sort([("order", 1), ("created_at", -1)]).to_list(100)
    
    # Enrich with task counts
    for project in projects:
        task_count = await db.project_tasks.count_documents({
            "project_id": project["id"],
            "parent_task_id": None  # Only top-level tasks
        })
        completed_count = await db.project_tasks.count_documents({
            "project_id": project["id"],
            "parent_task_id": None,
            "status": "done"
        })
        project["task_count"] = task_count
        project["completed_count"] = completed_count
    
    return projects


@router.post("")
async def create_project(
    project_data: ProjectCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new project"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify space exists
    space = await db.project_spaces.find_one(
        {"id": project_data.space_id, "tenant_id": tenant_id}
    )
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    now = datetime.now(timezone.utc)
    
    # Get next order position for this space
    next_order = await get_next_position("projects", {
        "tenant_id": tenant_id,
        "space_id": project_data.space_id
    }, field="order")
    
    project = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "space_id": project_data.space_id,
        "name": project_data.name,
        "order": next_order,
        "description": project_data.description,
        "color": project_data.color,
        "status": "active",
        "start_date": project_data.start_date,
        "end_date": project_data.end_date,
        "owner_id": current_user.get("id"),
        "members": [current_user.get("id")],
        "project_statuses": [s.dict() for s in project_data.project_statuses] if project_data.project_statuses else DEFAULT_PROJECT_STATUSES,
        "task_statuses": [s.dict() for s in project_data.task_statuses] if project_data.task_statuses else DEFAULT_TASK_STATUSES,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.projects.insert_one(project)
    project.pop("_id", None)
    project["task_count"] = 0
    project["completed_count"] = 0
    
    # Create default list
    default_list = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "project_id": project["id"],
        "name": "To Do",
        "color": None,
        "position": 0,
        "created_at": now.isoformat()
    }
    await db.project_lists.insert_one(default_list)
    
    return project


class ReorderProjectsRequest(BaseModel):
    """Request model for reordering projects"""
    project_ids: List[str] = Field(..., description="Ordered list of project IDs")


@router.post("/spaces/{space_id}/reorder")
async def reorder_projects(
    space_id: str,
    request: ReorderProjectsRequest,
    current_user: dict = Depends(get_current_user)
):
    """Reorder projects within a space"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify space exists
    space = await db.project_spaces.find_one(
        {"id": space_id, "tenant_id": tenant_id}
    )
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    # Update order for each project
    for index, project_id in enumerate(request.project_ids):
        await db.projects.update_one(
            {"id": project_id, "tenant_id": tenant_id, "space_id": space_id},
            {"$set": {"order": index, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Projects reordered successfully"}


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a project with all its lists and tasks"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    project = await db.projects.find_one(
        {"id": project_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get space name if project belongs to a space
    if project.get("space_id"):
        space = await db.spaces.find_one(
            {"id": project["space_id"]},
            {"_id": 0, "name": 1}
        )
        if space:
            project["space_name"] = space["name"]
    
    # Get lists
    lists = await db.project_lists.find(
        {"project_id": project_id, "tenant_id": tenant_id},
        {"_id": 0}
    ).sort("position", 1).to_list(100)
    
    # Get all tasks (including subtasks)
    tasks = await db.project_tasks.find(
        {"project_id": project_id, "tenant_id": tenant_id},
        {"_id": 0}
    ).sort("position", 1).to_list(1000)
    
    # Get dependencies
    dependencies = await db.task_dependencies.find(
        {"project_id": project_id, "tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Organize tasks by list and separate subtasks
    for lst in lists:
        lst["tasks"] = [t for t in tasks if t.get("list_id") == lst["id"] and not t.get("parent_task_id")]
        # Add subtasks to each task
        for task in lst["tasks"]:
            task["subtasks"] = [t for t in tasks if t.get("parent_task_id") == task["id"]]
            task["dependencies"] = [d for d in dependencies if d.get("task_id") == task["id"]]
    
    project["lists"] = lists
    project["all_tasks"] = tasks  # Flat list for Gantt view
    project["dependencies"] = dependencies
    
    return project


@router.put("/{project_id}")
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a project"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    existing = await db.projects.find_one(
        {"id": project_id, "tenant_id": tenant_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field in ["name", "description", "color", "status", "start_date", "end_date"]:
        value = getattr(project_data, field, None)
        if value is not None:
            update_data[field] = value
    
    if project_data.project_statuses is not None:
        update_data["project_statuses"] = [s.dict() for s in project_data.project_statuses]
    if project_data.task_statuses is not None:
        update_data["task_statuses"] = [s.dict() for s in project_data.task_statuses]
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": update_data}
    )
    
    updated = await db.projects.find_one(
        {"id": project_id},
        {"_id": 0}
    )
    
    return updated


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a project and all its contents"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    existing = await db.projects.find_one(
        {"id": project_id, "tenant_id": tenant_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete all related data
    await db.project_tasks.delete_many({"project_id": project_id})
    await db.project_lists.delete_many({"project_id": project_id})
    await db.task_dependencies.delete_many({"project_id": project_id})
    await db.projects.delete_one({"id": project_id})
    
    return {"message": "Project deleted successfully"}


class DuplicateProjectRequest(BaseModel):
    new_name: str
    keep_lists: bool = True
    keep_tasks: bool = True
    keep_checklists: bool = True
    keep_assignees: bool = False


@router.post("/{project_id}/duplicate")
async def duplicate_project(
    project_id: str,
    request: DuplicateProjectRequest,
    current_user: dict = Depends(get_current_user)
):
    """Duplicate a project with selected options"""
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get original project
    original = await db.projects.find_one(
        {"id": project_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not original:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Create new project
    new_project_id = str(uuid4())
    new_project = {
        **original,
        "id": new_project_id,
        "name": request.new_name,
        "owner_id": user_id,
        "members": [user_id],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.insert_one(new_project)
    
    # Map old IDs to new IDs for references
    list_id_map = {}
    task_id_map = {}
    
    if request.keep_lists:
        # Get original lists
        original_lists = await db.project_lists.find(
            {"project_id": project_id, "tenant_id": tenant_id},
            {"_id": 0}
        ).to_list(100)
        
        for lst in original_lists:
            new_list_id = str(uuid4())
            list_id_map[lst["id"]] = new_list_id
            
            new_list = {
                **lst,
                "id": new_list_id,
                "project_id": new_project_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.project_lists.insert_one(new_list)
        
        if request.keep_tasks:
            # Get original tasks
            original_tasks = await db.project_tasks.find(
                {"project_id": project_id, "tenant_id": tenant_id},
                {"_id": 0}
            ).to_list(1000)
            
            for task in original_tasks:
                new_task_id = str(uuid4())
                task_id_map[task["id"]] = new_task_id
                
                new_task = {
                    **task,
                    "id": new_task_id,
                    "project_id": new_project_id,
                    "list_id": list_id_map.get(task.get("list_id"), task.get("list_id")),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Handle assignees
                if not request.keep_assignees:
                    new_task["assignee_id"] = None
                
                # Handle checklists
                if not request.keep_checklists:
                    new_task["checklists"] = []
                elif new_task.get("checklists"):
                    # Generate new IDs for checklist items
                    for checklist in new_task["checklists"]:
                        checklist["id"] = str(uuid4())
                        for item in checklist.get("items", []):
                            item["id"] = str(uuid4())
                
                # Handle parent task references (for subtasks)
                if task.get("parent_task_id"):
                    new_task["parent_task_id"] = task_id_map.get(task["parent_task_id"], task["parent_task_id"])
                
                await db.project_tasks.insert_one(new_task)
            
            # Update subtask parent references (second pass for tasks created after their parents)
            for old_id, new_id in task_id_map.items():
                await db.project_tasks.update_many(
                    {"project_id": new_project_id, "parent_task_id": old_id},
                    {"$set": {"parent_task_id": new_id}}
                )
    
    # Get the new project with counts
    new_project_data = await db.projects.find_one(
        {"id": new_project_id},
        {"_id": 0}
    )
    
    # Add task counts
    task_count = await db.project_tasks.count_documents({
        "project_id": new_project_id,
        "parent_task_id": None
    })
    completed_count = await db.project_tasks.count_documents({
        "project_id": new_project_id,
        "parent_task_id": None,
        "status": "done"
    })
    
    new_project_data["task_count"] = task_count
    new_project_data["completed_count"] = completed_count
    
    return new_project_data


# =============================================================================
# LISTS ENDPOINTS
# =============================================================================

@router.get("/{project_id}/lists")
async def get_lists(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all lists in a project"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    lists = await db.project_lists.find(
        {"project_id": project_id, "tenant_id": tenant_id},
        {"_id": 0}
    ).sort("position", 1).to_list(100)
    
    return lists


@router.post("/{project_id}/lists")
async def create_list(
    project_id: str,
    list_data: ListCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new list in a project"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify project exists
    project = await db.projects.find_one(
        {"id": project_id, "tenant_id": tenant_id}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    position = await get_next_position(
        "project_lists",
        {"project_id": project_id, "tenant_id": tenant_id}
    )
    
    now = datetime.now(timezone.utc)
    
    new_list = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "project_id": project_id,
        "name": list_data.name,
        "color": list_data.color,
        "position": position,
        "created_at": now.isoformat()
    }
    
    await db.project_lists.insert_one(new_list)
    new_list.pop("_id", None)
    
    return new_list


@router.put("/{project_id}/lists/{list_id}")
async def update_list(
    project_id: str,
    list_id: str,
    list_data: ListUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a list"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    existing = await db.project_lists.find_one(
        {"id": list_id, "project_id": project_id, "tenant_id": tenant_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="List not found")
    
    update_data = {}
    if list_data.name is not None:
        update_data["name"] = list_data.name
    if list_data.color is not None:
        update_data["color"] = list_data.color
    if list_data.position is not None:
        update_data["position"] = list_data.position
    
    if update_data:
        await db.project_lists.update_one(
            {"id": list_id},
            {"$set": update_data}
        )
    
    updated = await db.project_lists.find_one(
        {"id": list_id},
        {"_id": 0}
    )
    
    return updated


@router.delete("/{project_id}/lists/{list_id}")
async def delete_list(
    project_id: str,
    list_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a list and all its tasks"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    existing = await db.project_lists.find_one(
        {"id": list_id, "project_id": project_id, "tenant_id": tenant_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="List not found")
    
    # Delete all tasks in this list
    await db.project_tasks.delete_many({"list_id": list_id})
    await db.project_lists.delete_one({"id": list_id})
    
    return {"message": "List deleted successfully"}


class ReorderListsRequest(BaseModel):
    """Request model for reordering lists"""
    list_ids: List[str] = Field(..., description="Ordered list of list IDs")


@router.post("/{project_id}/lists/reorder")
async def reorder_lists(
    project_id: str,
    request: ReorderListsRequest,
    current_user: dict = Depends(get_current_user)
):
    """Reorder lists within a project"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify project exists
    project = await db.projects.find_one(
        {"id": project_id, "tenant_id": tenant_id}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Update position for each list
    for index, list_id in enumerate(request.list_ids):
        await db.project_lists.update_one(
            {"id": list_id, "tenant_id": tenant_id, "project_id": project_id},
            {"$set": {"position": index, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Lists reordered successfully"}


# =============================================================================
# TASKS ENDPOINTS
# =============================================================================

@router.post("/{project_id}/tasks")
async def create_task(
    project_id: str,
    task_data: TaskCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new task"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify project and list exist
    project = await db.projects.find_one(
        {"id": project_id, "tenant_id": tenant_id}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    list_exists = await db.project_lists.find_one(
        {"id": task_data.list_id, "project_id": project_id}
    )
    if not list_exists:
        raise HTTPException(status_code=404, detail="List not found")
    
    # If subtask, verify parent exists
    if task_data.parent_task_id:
        parent = await db.project_tasks.find_one(
            {"id": task_data.parent_task_id, "project_id": project_id}
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent task not found")
    
    position = await get_next_position(
        "project_tasks",
        {
            "list_id": task_data.list_id,
            "tenant_id": tenant_id,
            "parent_task_id": task_data.parent_task_id
        }
    )
    
    now = datetime.now(timezone.utc)
    
    task = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "project_id": project_id,
        "list_id": task_data.list_id,
        "title": task_data.title,
        "description": task_data.description,
        "status": task_data.status or "todo",
        "phase": task_data.phase or "planning",  # Project-level phase
        "priority": task_data.priority or "medium",
        "assignee_id": task_data.assignee_id,
        "due_date": task_data.due_date,
        "start_date": task_data.start_date,
        "estimated_hours": task_data.estimated_hours,
        "tags": task_data.tags or [],
        "parent_task_id": task_data.parent_task_id,
        "position": position,
        "checklists": [],
        "created_by": current_user.get("id"),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.project_tasks.insert_one(task)
    task.pop("_id", None)
    task["subtasks"] = []
    task["dependencies"] = []
    
    return task


@router.get("/{project_id}/tasks/{task_id}")
async def get_task(
    project_id: str,
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific task with subtasks and checklists"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    task = await db.project_tasks.find_one(
        {"id": task_id, "project_id": project_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Get subtasks
    subtasks = await db.project_tasks.find(
        {"parent_task_id": task_id, "tenant_id": tenant_id},
        {"_id": 0}
    ).sort("position", 1).to_list(100)
    
    # Get dependencies
    dependencies = await db.task_dependencies.find(
        {"task_id": task_id, "tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(100)
    
    # Get assignee details
    if task.get("assignee_id"):
        assignee = await db.users.find_one(
            {"id": task["assignee_id"]},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "avatar_url": 1}
        )
        task["assignee"] = assignee
    
    task["subtasks"] = subtasks
    task["dependencies"] = dependencies
    
    return task


@router.put("/{project_id}/tasks/{task_id}")
async def update_task(
    project_id: str,
    task_id: str,
    task_data: TaskUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a task"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    existing = await db.project_tasks.find_one(
        {"id": task_id, "project_id": project_id, "tenant_id": tenant_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    for field in ["title", "description", "list_id", "status", "phase", "priority", 
                  "assignee_id", "due_date", "start_date", "estimated_hours", 
                  "tags", "position"]:
        value = getattr(task_data, field, None)
        if value is not None:
            update_data[field] = value
    
    await db.project_tasks.update_one(
        {"id": task_id},
        {"$set": update_data}
    )
    
    updated = await db.project_tasks.find_one(
        {"id": task_id},
        {"_id": 0}
    )
    
    return updated


@router.delete("/{project_id}/tasks/{task_id}")
async def delete_task(
    project_id: str,
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a task and its subtasks"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    existing = await db.project_tasks.find_one(
        {"id": task_id, "project_id": project_id, "tenant_id": tenant_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Delete subtasks
    await db.project_tasks.delete_many({"parent_task_id": task_id})
    # Delete dependencies
    await db.task_dependencies.delete_many({
        "$or": [{"task_id": task_id}, {"depends_on_task_id": task_id}]
    })
    # Delete task
    await db.project_tasks.delete_one({"id": task_id})
    
    return {"message": "Task deleted successfully"}


@router.post("/{project_id}/tasks/{task_id}/move")
async def move_task(
    project_id: str,
    task_id: str,
    move_data: TaskMove,
    current_user: dict = Depends(get_current_user)
):
    """Move a task to a different list"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    task = await db.project_tasks.find_one(
        {"id": task_id, "project_id": project_id, "tenant_id": tenant_id}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Verify target list exists
    target_list = await db.project_lists.find_one(
        {"id": move_data.list_id, "project_id": project_id}
    )
    if not target_list:
        raise HTTPException(status_code=404, detail="Target list not found")
    
    position = move_data.position
    if position is None:
        position = await get_next_position(
            "project_tasks",
            {"list_id": move_data.list_id, "tenant_id": tenant_id, "parent_task_id": None}
        )
    
    await db.project_tasks.update_one(
        {"id": task_id},
        {"$set": {
            "list_id": move_data.list_id,
            "position": position,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated = await db.project_tasks.find_one(
        {"id": task_id},
        {"_id": 0}
    )
    
    return updated


# =============================================================================
# CHECKLISTS ENDPOINTS
# =============================================================================

@router.post("/{project_id}/tasks/{task_id}/checklists")
async def add_checklist(
    project_id: str,
    task_id: str,
    checklist_data: ChecklistCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a checklist to a task"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    task = await db.project_tasks.find_one(
        {"id": task_id, "project_id": project_id, "tenant_id": tenant_id}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    checklist = {
        "id": str(uuid4()),
        "name": checklist_data.name,
        "items": [
            {
                "id": item.id or str(uuid4()),
                "text": item.text,
                "is_completed": item.is_completed
            }
            for item in checklist_data.items
        ]
    }
    
    checklists = task.get("checklists", [])
    checklists.append(checklist)
    
    await db.project_tasks.update_one(
        {"id": task_id},
        {"$set": {"checklists": checklists}}
    )
    
    return checklist


@router.put("/{project_id}/tasks/{task_id}/checklists/{checklist_id}")
async def update_checklist(
    project_id: str,
    task_id: str,
    checklist_id: str,
    checklist_data: ChecklistCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a checklist"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    task = await db.project_tasks.find_one(
        {"id": task_id, "project_id": project_id, "tenant_id": tenant_id}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    checklists = task.get("checklists", [])
    updated = False
    
    for i, cl in enumerate(checklists):
        if cl["id"] == checklist_id:
            checklists[i] = {
                "id": checklist_id,
                "name": checklist_data.name,
                "items": [
                    {
                        "id": item.id or str(uuid4()),
                        "text": item.text,
                        "is_completed": item.is_completed
                    }
                    for item in checklist_data.items
                ]
            }
            updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=404, detail="Checklist not found")
    
    await db.project_tasks.update_one(
        {"id": task_id},
        {"$set": {"checklists": checklists}}
    )
    
    return checklists[i]


@router.delete("/{project_id}/tasks/{task_id}/checklists/{checklist_id}")
async def delete_checklist(
    project_id: str,
    task_id: str,
    checklist_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a checklist"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    task = await db.project_tasks.find_one(
        {"id": task_id, "project_id": project_id, "tenant_id": tenant_id}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    checklists = [cl for cl in task.get("checklists", []) if cl["id"] != checklist_id]
    
    await db.project_tasks.update_one(
        {"id": task_id},
        {"$set": {"checklists": checklists}}
    )
    
    return {"message": "Checklist deleted"}


# =============================================================================
# DEPENDENCIES ENDPOINTS
# =============================================================================

@router.post("/{project_id}/tasks/{task_id}/dependencies")
async def add_dependency(
    project_id: str,
    task_id: str,
    dependency_data: DependencyCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a dependency (this task depends on another task)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify both tasks exist
    task = await db.project_tasks.find_one(
        {"id": task_id, "project_id": project_id, "tenant_id": tenant_id}
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    depends_on = await db.project_tasks.find_one(
        {"id": dependency_data.depends_on_task_id, "project_id": project_id}
    )
    if not depends_on:
        raise HTTPException(status_code=404, detail="Dependency task not found")
    
    # Prevent self-dependency
    if task_id == dependency_data.depends_on_task_id:
        raise HTTPException(status_code=400, detail="Task cannot depend on itself")
    
    # Check for circular dependency
    # Simple check: if depends_on already depends on task_id
    existing_reverse = await db.task_dependencies.find_one({
        "task_id": dependency_data.depends_on_task_id,
        "depends_on_task_id": task_id
    })
    if existing_reverse:
        raise HTTPException(status_code=400, detail="Circular dependency detected")
    
    # Check if dependency already exists
    existing = await db.task_dependencies.find_one({
        "task_id": task_id,
        "depends_on_task_id": dependency_data.depends_on_task_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Dependency already exists")
    
    dependency = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "project_id": project_id,
        "task_id": task_id,
        "depends_on_task_id": dependency_data.depends_on_task_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.task_dependencies.insert_one(dependency)
    dependency.pop("_id", None)
    
    return dependency


@router.delete("/{project_id}/tasks/{task_id}/dependencies/{dependency_id}")
async def remove_dependency(
    project_id: str,
    task_id: str,
    dependency_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a dependency"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    result = await db.task_dependencies.delete_one({
        "id": dependency_id,
        "task_id": task_id,
        "tenant_id": tenant_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dependency not found")
    
    return {"message": "Dependency removed"}


@router.get("/{project_id}/dependencies")
async def get_project_dependencies(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all dependencies in a project (for Gantt view)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    dependencies = await db.task_dependencies.find(
        {"project_id": project_id, "tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(1000)
    
    return dependencies



# =============================================================================
# TAG MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/tags/all")
async def get_all_tags(
    current_user: dict = Depends(get_current_user)
):
    """Get all tags for the tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    tags = await db.project_tags.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).sort("name", 1).to_list(500)
    
    return tags


@router.post("/tags")
async def create_tag(
    tag_data: TagCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new tag"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check for duplicate name
    existing = await db.project_tags.find_one({
        "tenant_id": tenant_id,
        "name": {"$regex": f"^{tag_data.name}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Tag with this name already exists")
    
    tag = {
        "id": str(uuid4()),
        "tenant_id": tenant_id,
        "name": tag_data.name,
        "color": tag_data.color or "#6B7280",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.project_tags.insert_one(tag)
    tag.pop("_id", None)
    
    return tag


@router.put("/tags/{tag_id}")
async def update_tag(
    tag_id: str,
    tag_data: TagUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a tag"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    existing = await db.project_tags.find_one({
        "id": tag_id,
        "tenant_id": tenant_id
    })
    if not existing:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    # Check for duplicate name if name is being changed
    if tag_data.name and tag_data.name.lower() != existing["name"].lower():
        duplicate = await db.project_tags.find_one({
            "tenant_id": tenant_id,
            "name": {"$regex": f"^{tag_data.name}$", "$options": "i"},
            "id": {"$ne": tag_id}
        })
        if duplicate:
            raise HTTPException(status_code=400, detail="Tag with this name already exists")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if tag_data.name is not None:
        update_data["name"] = tag_data.name
    if tag_data.color is not None:
        update_data["color"] = tag_data.color
    
    await db.project_tags.update_one(
        {"id": tag_id, "tenant_id": tenant_id},
        {"$set": update_data}
    )
    
    updated = await db.project_tags.find_one({"id": tag_id}, {"_id": 0})
    return updated


@router.delete("/tags/{tag_id}")
async def delete_tag(
    tag_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a tag and remove it from all tasks"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    existing = await db.project_tags.find_one({
        "id": tag_id,
        "tenant_id": tenant_id
    })
    if not existing:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    # Remove tag from all tasks
    await db.project_tasks.update_many(
        {"tenant_id": tenant_id, "tags": tag_id},
        {"$pull": {"tags": tag_id}}
    )
    
    # Delete the tag
    await db.project_tags.delete_one({"id": tag_id})
    
    return {"message": "Tag deleted successfully"}


# =============================================================================
# PHASE ENDPOINTS (Project-level task organization)
# =============================================================================

@router.get("/{project_id}/phases")
async def get_project_phases(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get phases for a project"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    project = await db.projects.find_one(
        {"id": project_id, "tenant_id": tenant_id}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Return custom phases or default
    phases = project.get("phases") or DEFAULT_PROJECT_PHASES
    return {"phases": phases}


@router.put("/{project_id}/phases")
async def update_project_phases(
    project_id: str,
    request: PhaseUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update phases for a project"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    project = await db.projects.find_one(
        {"id": project_id, "tenant_id": tenant_id}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate phases
    if len(request.phases) == 0:
        raise HTTPException(status_code=400, detail="At least one phase is required")
    
    # Convert to dicts
    phases = [phase.model_dump() for phase in request.phases]
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"phases": phases}}
    )
    
    return {"phases": phases}


@router.post("/{project_id}/phases/reassign")
async def reassign_task_phases(
    project_id: str,
    from_phase: str = Query(..., description="Phase ID to reassign from"),
    to_phase: str = Query(..., description="Phase ID to reassign to"),
    current_user: dict = Depends(get_current_user)
):
    """Reassign all tasks from one phase to another (used before deleting a phase)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Update all tasks with the old phase to the new phase
    result = await db.project_tasks.update_many(
        {"project_id": project_id, "tenant_id": tenant_id, "phase": from_phase},
        {"$set": {"phase": to_phase}}
    )
    
    return {"message": f"Reassigned {result.modified_count} tasks"}


@router.get("/{project_id}/all-tasks")
async def get_all_project_tasks(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all tasks from all lists in a project (for project-level views)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    project = await db.projects.find_one(
        {"id": project_id, "tenant_id": tenant_id}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all tasks (excluding subtasks for main view)
    tasks = await db.project_tasks.find(
        {
            "project_id": project_id,
            "tenant_id": tenant_id,
            "parent_task_id": None  # Only top-level tasks
        },
        {"_id": 0}
    ).to_list(10000)
    
    # Get all subtasks
    all_subtasks = await db.project_tasks.find(
        {
            "project_id": project_id,
            "tenant_id": tenant_id,
            "parent_task_id": {"$ne": None}
        },
        {"_id": 0}
    ).to_list(10000)
    
    # Attach subtasks to their parent tasks
    for task in tasks:
        task["subtasks"] = [st for st in all_subtasks if st.get("parent_task_id") == task["id"]]
        # Ensure phase field exists
        if "phase" not in task:
            task["phase"] = "planning"
    
    # Get phases
    phases = project.get("phases") or DEFAULT_PROJECT_PHASES
    
    # Get lists for reference
    lists = await db.project_lists.find(
        {"project_id": project_id, "tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "tasks": tasks,
        "phases": phases,
        "lists": lists
    }
