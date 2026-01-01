"""
Project Management Tools Service
Executes project management operations for AI agents
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from uuid import uuid4

logger = logging.getLogger(__name__)


class ProjectToolExecutor:
    """Executes project management tools for AI agents"""
    
    def __init__(self, db, tenant_id: str, user_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id
    
    # =========================================================================
    # HELPER METHODS
    # =========================================================================
    
    async def _find_space_by_name(self, name: str) -> Optional[Dict]:
        """Find a space by name"""
        return await self.db.project_spaces.find_one({
            "tenant_id": self.tenant_id,
            "name": {"$regex": f"^{name}$", "$options": "i"}
        }, {"_id": 0})
    
    async def _find_project_by_name(self, name: str, space_id: str = None) -> Optional[Dict]:
        """Find a project by name"""
        query = {
            "tenant_id": self.tenant_id,
            "name": {"$regex": f"^{name}$", "$options": "i"}
        }
        if space_id:
            query["space_id"] = space_id
        return await self.db.projects.find_one(query, {"_id": 0})
    
    async def _find_list_by_name(self, name: str, project_id: str) -> Optional[Dict]:
        """Find a list by name within a project"""
        return await self.db.project_lists.find_one({
            "tenant_id": self.tenant_id,
            "project_id": project_id,
            "name": {"$regex": f"^{name}$", "$options": "i"}
        }, {"_id": 0})
    
    async def _find_task_by_title(self, title: str, project_id: str) -> Optional[Dict]:
        """Find a task by title within a project"""
        return await self.db.project_tasks.find_one({
            "tenant_id": self.tenant_id,
            "project_id": project_id,
            "title": {"$regex": f"^{title}$", "$options": "i"}
        }, {"_id": 0})
    
    async def _get_next_position(self, collection: str, filter_query: dict) -> int:
        """Get the next position for ordering"""
        last = await self.db[collection].find_one(filter_query, sort=[("position", -1)])
        return (last.get("position", 0) + 1) if last else 0
    
    # =========================================================================
    # SPACE TOOLS
    # =========================================================================
    
    async def create_space(self, name: str, description: str = None, color: str = "#6366F1") -> Dict[str, Any]:
        """Create a new space"""
        now = datetime.now(timezone.utc)
        space = {
            "id": str(uuid4()),
            "tenant_id": self.tenant_id,
            "name": name,
            "description": description,
            "color": color,
            "icon": "folder",
            "created_by": self.user_id,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        await self.db.project_spaces.insert_one(space)
        space.pop("_id", None)
        return {"success": True, "space": space, "message": f"Space '{name}' created successfully"}
    
    async def list_spaces(self) -> Dict[str, Any]:
        """List all spaces"""
        spaces = await self.db.project_spaces.find(
            {"tenant_id": self.tenant_id},
            {"_id": 0}
        ).to_list(100)
        
        for space in spaces:
            count = await self.db.projects.count_documents({
                "tenant_id": self.tenant_id,
                "space_id": space["id"]
            })
            space["project_count"] = count
        
        return {"success": True, "spaces": spaces, "count": len(spaces)}
    
    async def get_space(self, space_id: str = None, space_name: str = None) -> Dict[str, Any]:
        """Get space details with projects"""
        space = None
        if space_id:
            space = await self.db.project_spaces.find_one(
                {"id": space_id, "tenant_id": self.tenant_id},
                {"_id": 0}
            )
        elif space_name:
            space = await self._find_space_by_name(space_name)
        
        if not space:
            return {"success": False, "error": "Space not found"}
        
        projects = await self.db.projects.find(
            {"tenant_id": self.tenant_id, "space_id": space["id"]},
            {"_id": 0}
        ).to_list(100)
        
        space["projects"] = projects
        return {"success": True, "space": space}
    
    # =========================================================================
    # PROJECT TOOLS
    # =========================================================================
    
    async def create_project(
        self, name: str, space_id: str = None, space_name: str = None,
        description: str = None, start_date: str = None, end_date: str = None,
        color: str = "#6366F1"
    ) -> Dict[str, Any]:
        """Create a new project"""
        # Find space
        if not space_id and space_name:
            space = await self._find_space_by_name(space_name)
            if space:
                space_id = space["id"]
        
        if not space_id:
            # Create default space if none exists
            spaces = await self.db.project_spaces.find({"tenant_id": self.tenant_id}).to_list(1)
            if spaces:
                space_id = spaces[0]["id"]
            else:
                result = await self.create_space("Default Space")
                space_id = result["space"]["id"]
        
        now = datetime.now(timezone.utc)
        
        # Default statuses
        default_task_statuses = [
            {"id": "todo", "name": "To Do", "color": "#6B7280"},
            {"id": "in_progress", "name": "In Progress", "color": "#3B82F6"},
            {"id": "review", "name": "Review", "color": "#8B5CF6"},
            {"id": "done", "name": "Done", "color": "#10B981"},
        ]
        
        project = {
            "id": str(uuid4()),
            "tenant_id": self.tenant_id,
            "space_id": space_id,
            "name": name,
            "description": description,
            "color": color,
            "status": "active",
            "start_date": start_date,
            "end_date": end_date,
            "owner_id": self.user_id,
            "members": [self.user_id],
            "task_statuses": default_task_statuses,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await self.db.projects.insert_one(project)
        project.pop("_id", None)
        
        # Create default list
        default_list = {
            "id": str(uuid4()),
            "tenant_id": self.tenant_id,
            "project_id": project["id"],
            "name": "To Do",
            "position": 0,
            "created_at": now.isoformat()
        }
        await self.db.project_lists.insert_one(default_list)
        
        return {"success": True, "project": project, "message": f"Project '{name}' created successfully"}
    
    async def list_projects(
        self, space_id: str = None, space_name: str = None, status: str = None
    ) -> Dict[str, Any]:
        """List projects with optional filters"""
        if not space_id and space_name:
            space = await self._find_space_by_name(space_name)
            if space:
                space_id = space["id"]
        
        query = {"tenant_id": self.tenant_id}
        if space_id:
            query["space_id"] = space_id
        if status:
            query["status"] = status
        
        projects = await self.db.projects.find(query, {"_id": 0}).to_list(100)
        
        for project in projects:
            task_count = await self.db.project_tasks.count_documents({
                "project_id": project["id"],
                "parent_task_id": None
            })
            completed = await self.db.project_tasks.count_documents({
                "project_id": project["id"],
                "parent_task_id": None,
                "status": "done"
            })
            project["task_count"] = task_count
            project["completed_count"] = completed
        
        return {"success": True, "projects": projects, "count": len(projects)}
    
    async def get_project(self, project_id: str = None, project_name: str = None) -> Dict[str, Any]:
        """Get project with all details"""
        project = None
        if project_id:
            project = await self.db.projects.find_one(
                {"id": project_id, "tenant_id": self.tenant_id},
                {"_id": 0}
            )
        elif project_name:
            project = await self._find_project_by_name(project_name)
        
        if not project:
            return {"success": False, "error": "Project not found"}
        
        lists = await self.db.project_lists.find(
            {"project_id": project["id"]},
            {"_id": 0}
        ).sort("position", 1).to_list(100)
        
        tasks = await self.db.project_tasks.find(
            {"project_id": project["id"]},
            {"_id": 0}
        ).to_list(1000)
        
        for lst in lists:
            lst["tasks"] = [t for t in tasks if t.get("list_id") == lst["id"] and not t.get("parent_task_id")]
            for task in lst["tasks"]:
                task["subtasks"] = [t for t in tasks if t.get("parent_task_id") == task["id"]]
        
        project["lists"] = lists
        return {"success": True, "project": project}
    
    async def update_project(
        self, project_id: str = None, project_name: str = None,
        name: str = None, description: str = None, status: str = None,
        start_date: str = None, end_date: str = None
    ) -> Dict[str, Any]:
        """Update a project"""
        project = None
        if project_id:
            project = await self.db.projects.find_one(
                {"id": project_id, "tenant_id": self.tenant_id}
            )
        elif project_name:
            project = await self._find_project_by_name(project_name)
        
        if not project:
            return {"success": False, "error": "Project not found"}
        
        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if name:
            update_data["name"] = name
        if description is not None:
            update_data["description"] = description
        if status:
            update_data["status"] = status
        if start_date:
            update_data["start_date"] = start_date
        if end_date:
            update_data["end_date"] = end_date
        
        await self.db.projects.update_one({"id": project["id"]}, {"$set": update_data})
        
        return {"success": True, "message": f"Project updated successfully"}
    
    # =========================================================================
    # LIST TOOLS
    # =========================================================================
    
    async def create_list(
        self, name: str, project_id: str = None, project_name: str = None, color: str = None
    ) -> Dict[str, Any]:
        """Create a new list in a project"""
        if not project_id and project_name:
            project = await self._find_project_by_name(project_name)
            if project:
                project_id = project["id"]
        
        if not project_id:
            return {"success": False, "error": "Project not found"}
        
        position = await self._get_next_position("project_lists", {
            "project_id": project_id,
            "tenant_id": self.tenant_id
        })
        
        lst = {
            "id": str(uuid4()),
            "tenant_id": self.tenant_id,
            "project_id": project_id,
            "name": name,
            "color": color,
            "position": position,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.project_lists.insert_one(lst)
        lst.pop("_id", None)
        
        return {"success": True, "list": lst, "message": f"List '{name}' created successfully"}
    
    # =========================================================================
    # TASK TOOLS
    # =========================================================================
    
    async def create_task(
        self, title: str, project_id: str = None, project_name: str = None,
        list_id: str = None, list_name: str = None,
        description: str = None, status: str = "todo", priority: str = "medium",
        due_date: str = None, start_date: str = None, estimated_hours: float = None,
        assignee_id: str = None, tags: list = None
    ) -> Dict[str, Any]:
        """Create a new task"""
        if not project_id and project_name:
            project = await self._find_project_by_name(project_name)
            if project:
                project_id = project["id"]
        
        if not project_id:
            return {"success": False, "error": "Project not found"}
        
        if not list_id:
            if list_name:
                lst = await self._find_list_by_name(list_name, project_id)
                if lst:
                    list_id = lst["id"]
            else:
                # Use first list
                first_list = await self.db.project_lists.find_one(
                    {"project_id": project_id, "tenant_id": self.tenant_id},
                    sort=[("position", 1)]
                )
                if first_list:
                    list_id = first_list["id"]
        
        if not list_id:
            return {"success": False, "error": "No list found in project"}
        
        position = await self._get_next_position("project_tasks", {
            "list_id": list_id,
            "tenant_id": self.tenant_id,
            "parent_task_id": None
        })
        
        now = datetime.now(timezone.utc)
        task = {
            "id": str(uuid4()),
            "tenant_id": self.tenant_id,
            "project_id": project_id,
            "list_id": list_id,
            "title": title,
            "description": description,
            "status": status,
            "priority": priority,
            "due_date": due_date,
            "start_date": start_date,
            "estimated_hours": estimated_hours,
            "assignee_id": assignee_id,
            "tags": tags or [],
            "parent_task_id": None,
            "position": position,
            "checklists": [],
            "created_by": self.user_id,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await self.db.project_tasks.insert_one(task)
        task.pop("_id", None)
        
        return {"success": True, "task": task, "message": f"Task '{title}' created successfully"}
    
    async def update_task(
        self, project_id: str = None, task_id: str = None, task_title: str = None,
        title: str = None, description: str = None, status: str = None,
        priority: str = None, due_date: str = None, list_id: str = None
    ) -> Dict[str, Any]:
        """Update a task"""
        task = None
        if task_id:
            task = await self.db.project_tasks.find_one(
                {"id": task_id, "tenant_id": self.tenant_id}
            )
        elif task_title and project_id:
            task = await self._find_task_by_title(task_title, project_id)
        
        if not task:
            return {"success": False, "error": "Task not found"}
        
        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if title:
            update_data["title"] = title
        if description is not None:
            update_data["description"] = description
        if status:
            update_data["status"] = status
        if priority:
            update_data["priority"] = priority
        if due_date:
            update_data["due_date"] = due_date
        if list_id:
            update_data["list_id"] = list_id
        
        await self.db.project_tasks.update_one({"id": task["id"]}, {"$set": update_data})
        
        return {"success": True, "message": f"Task updated successfully"}
    
    async def complete_task(
        self, project_id: str = None, task_id: str = None, task_title: str = None
    ) -> Dict[str, Any]:
        """Mark a task as completed"""
        return await self.update_task(
            project_id=project_id,
            task_id=task_id,
            task_title=task_title,
            status="done"
        )
    
    async def delete_task(
        self, project_id: str = None, task_id: str = None, task_title: str = None
    ) -> Dict[str, Any]:
        """Delete a task"""
        task = None
        if task_id:
            task = await self.db.project_tasks.find_one(
                {"id": task_id, "tenant_id": self.tenant_id}
            )
        elif task_title and project_id:
            task = await self._find_task_by_title(task_title, project_id)
        
        if not task:
            return {"success": False, "error": "Task not found"}
        
        # Delete subtasks
        await self.db.project_tasks.delete_many({"parent_task_id": task["id"]})
        # Delete dependencies
        await self.db.task_dependencies.delete_many({
            "$or": [{"task_id": task["id"]}, {"depends_on_task_id": task["id"]}]
        })
        # Delete task
        await self.db.project_tasks.delete_one({"id": task["id"]})
        
        return {"success": True, "message": "Task deleted successfully"}
    
    # =========================================================================
    # SUBTASK TOOLS
    # =========================================================================
    
    async def create_subtask(
        self, title: str, project_id: str = None, parent_task_id: str = None,
        parent_task_title: str = None, description: str = None,
        priority: str = "medium", due_date: str = None
    ) -> Dict[str, Any]:
        """Create a subtask under a parent task"""
        parent = None
        if parent_task_id:
            parent = await self.db.project_tasks.find_one(
                {"id": parent_task_id, "tenant_id": self.tenant_id}
            )
        elif parent_task_title and project_id:
            parent = await self._find_task_by_title(parent_task_title, project_id)
        
        if not parent:
            return {"success": False, "error": "Parent task not found"}
        
        position = await self._get_next_position("project_tasks", {
            "parent_task_id": parent["id"],
            "tenant_id": self.tenant_id
        })
        
        now = datetime.now(timezone.utc)
        subtask = {
            "id": str(uuid4()),
            "tenant_id": self.tenant_id,
            "project_id": parent["project_id"],
            "list_id": parent["list_id"],
            "title": title,
            "description": description,
            "status": "todo",
            "priority": priority,
            "due_date": due_date,
            "parent_task_id": parent["id"],
            "position": position,
            "checklists": [],
            "created_by": self.user_id,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await self.db.project_tasks.insert_one(subtask)
        subtask.pop("_id", None)
        
        return {"success": True, "subtask": subtask, "message": f"Subtask '{title}' created successfully"}
    
    # =========================================================================
    # CHECKLIST TOOLS
    # =========================================================================
    
    async def add_checklist(
        self, checklist_name: str, project_id: str = None, task_id: str = None,
        task_title: str = None, items: list = None
    ) -> Dict[str, Any]:
        """Add a checklist to a task"""
        task = None
        if task_id:
            task = await self.db.project_tasks.find_one(
                {"id": task_id, "tenant_id": self.tenant_id}
            )
        elif task_title and project_id:
            task = await self._find_task_by_title(task_title, project_id)
        
        if not task:
            return {"success": False, "error": "Task not found"}
        
        checklist = {
            "id": str(uuid4()),
            "name": checklist_name,
            "items": [
                {
                    "id": str(uuid4()),
                    "text": item.get("text", item) if isinstance(item, dict) else str(item),
                    "is_completed": item.get("is_completed", False) if isinstance(item, dict) else False
                }
                for item in (items or [])
            ]
        }
        
        checklists = task.get("checklists", [])
        checklists.append(checklist)
        
        await self.db.project_tasks.update_one(
            {"id": task["id"]},
            {"$set": {"checklists": checklists}}
        )
        
        return {"success": True, "checklist": checklist, "message": f"Checklist '{checklist_name}' added"}
    
    async def update_checklist_item(
        self, is_completed: bool, project_id: str = None, task_id: str = None,
        checklist_id: str = None, checklist_name: str = None, item_text: str = None
    ) -> Dict[str, Any]:
        """Update a checklist item's completion status"""
        task = None
        if task_id:
            task = await self.db.project_tasks.find_one(
                {"id": task_id, "tenant_id": self.tenant_id}
            )
        
        if not task:
            return {"success": False, "error": "Task not found"}
        
        checklists = task.get("checklists", [])
        updated = False
        
        for cl in checklists:
            if (checklist_id and cl["id"] == checklist_id) or \
               (checklist_name and cl["name"].lower() == checklist_name.lower()):
                for item in cl["items"]:
                    if item_text and item["text"].lower() == item_text.lower():
                        item["is_completed"] = is_completed
                        updated = True
                        break
        
        if not updated:
            return {"success": False, "error": "Checklist item not found"}
        
        await self.db.project_tasks.update_one(
            {"id": task["id"]},
            {"$set": {"checklists": checklists}}
        )
        
        return {"success": True, "message": f"Checklist item marked as {'completed' if is_completed else 'not completed'}"}
    
    # =========================================================================
    # DEPENDENCY TOOLS
    # =========================================================================
    
    async def add_task_dependency(
        self, project_id: str = None, task_id: str = None, depends_on_task_id: str = None,
        task_title: str = None, depends_on_task_title: str = None
    ) -> Dict[str, Any]:
        """Add a dependency between tasks"""
        if not project_id:
            return {"success": False, "error": "Project ID required"}
        
        # Resolve task IDs from titles
        if not task_id and task_title:
            task = await self._find_task_by_title(task_title, project_id)
            if task:
                task_id = task["id"]
        
        if not depends_on_task_id and depends_on_task_title:
            dep_task = await self._find_task_by_title(depends_on_task_title, project_id)
            if dep_task:
                depends_on_task_id = dep_task["id"]
        
        if not task_id or not depends_on_task_id:
            return {"success": False, "error": "Tasks not found"}
        
        if task_id == depends_on_task_id:
            return {"success": False, "error": "Task cannot depend on itself"}
        
        # Check for circular dependency
        existing_reverse = await self.db.task_dependencies.find_one({
            "task_id": depends_on_task_id,
            "depends_on_task_id": task_id
        })
        if existing_reverse:
            return {"success": False, "error": "Circular dependency detected"}
        
        # Check if already exists
        existing = await self.db.task_dependencies.find_one({
            "task_id": task_id,
            "depends_on_task_id": depends_on_task_id
        })
        if existing:
            return {"success": False, "error": "Dependency already exists"}
        
        dependency = {
            "id": str(uuid4()),
            "tenant_id": self.tenant_id,
            "project_id": project_id,
            "task_id": task_id,
            "depends_on_task_id": depends_on_task_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.task_dependencies.insert_one(dependency)
        dependency.pop("_id", None)
        
        return {"success": True, "dependency": dependency, "message": "Dependency added successfully"}


# Tool executors mapping
PROJECT_TOOL_EXECUTORS = {
    "create_space": lambda executor, **kwargs: executor.create_space(**kwargs),
    "list_spaces": lambda executor, **kwargs: executor.list_spaces(),
    "get_space": lambda executor, **kwargs: executor.get_space(**kwargs),
    "create_project": lambda executor, **kwargs: executor.create_project(**kwargs),
    "list_projects": lambda executor, **kwargs: executor.list_projects(**kwargs),
    "get_project": lambda executor, **kwargs: executor.get_project(**kwargs),
    "update_project": lambda executor, **kwargs: executor.update_project(**kwargs),
    "create_list": lambda executor, **kwargs: executor.create_list(**kwargs),
    "create_task": lambda executor, **kwargs: executor.create_task(**kwargs),
    "update_task": lambda executor, **kwargs: executor.update_task(**kwargs),
    "complete_task": lambda executor, **kwargs: executor.complete_task(**kwargs),
    "delete_task": lambda executor, **kwargs: executor.delete_task(**kwargs),
    "create_subtask": lambda executor, **kwargs: executor.create_subtask(**kwargs),
    "add_checklist": lambda executor, **kwargs: executor.add_checklist(**kwargs),
    "update_checklist_item": lambda executor, **kwargs: executor.update_checklist_item(**kwargs),
    "add_task_dependency": lambda executor, **kwargs: executor.add_task_dependency(**kwargs),
}


async def execute_project_tool(
    db, tool_name: str, tenant_id: str, user_id: str, parameters: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute a project management tool"""
    executor = ProjectToolExecutor(db, tenant_id, user_id)
    
    if tool_name not in PROJECT_TOOL_EXECUTORS:
        return {"success": False, "error": f"Unknown project tool: {tool_name}"}
    
    try:
        result = await PROJECT_TOOL_EXECUTORS[tool_name](executor, **parameters)
        return result
    except Exception as e:
        logger.error(f"Project tool execution error: {e}")
        return {"success": False, "error": str(e)}
