"""
Task Scheduler Service
Manages scheduled tasks for AI agents using APScheduler
"""
import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from motor.motor_asyncio import AsyncIOMotorDatabase

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.date import DateTrigger
from apscheduler.jobstores.memory import MemoryJobStore

logger = logging.getLogger(__name__)


class TaskSchedulerService:
    """
    Manages scheduled tasks for AI agents
    - Creates and manages scheduled tasks
    - Executes tools at scheduled times
    - Tracks execution history
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self._scheduler: Optional[AsyncIOScheduler] = None
        self._orchestrator = None  # Will be set lazily
        self._running_tasks: Dict[str, bool] = {}  # Track running tasks to prevent overlap
    
    async def initialize(self):
        """Initialize the scheduler"""
        if self._scheduler is None:
            self._scheduler = AsyncIOScheduler(
                jobstores={'default': MemoryJobStore()},
                job_defaults={
                    'coalesce': True,  # Combine missed runs
                    'max_instances': 1,  # Only one instance per job
                    'misfire_grace_time': 60  # 60 seconds grace period
                },
                timezone='UTC'
            )
            self._scheduler.start()
            logger.info("Task scheduler initialized")
            
            # Load existing enabled tasks from database
            await self._load_existing_tasks()
    
    async def _load_existing_tasks(self):
        """Load enabled tasks from database on startup"""
        try:
            cursor = self.db.scheduled_tasks.find(
                {"enabled": True},
                {"_id": 0}
            )
            tasks = await cursor.to_list(length=1000)
            
            for task in tasks:
                try:
                    await self._schedule_task_job(task)
                    logger.info(f"Loaded scheduled task: {task.get('name')} ({task.get('id')})")
                except Exception as e:
                    logger.error(f"Failed to load task {task.get('id')}: {str(e)}")
            
            logger.info(f"Loaded {len(tasks)} scheduled tasks")
        except Exception as e:
            logger.error(f"Error loading existing tasks: {str(e)}")
    
    def _get_orchestrator(self):
        """Lazy load orchestrator to avoid circular imports"""
        if self._orchestrator is None:
            from services.tool_orchestrator import ToolOrchestrator
            self._orchestrator = ToolOrchestrator(self.db)
        return self._orchestrator
    
    async def shutdown(self):
        """Shutdown the scheduler"""
        if self._scheduler:
            self._scheduler.shutdown(wait=False)
            self._scheduler = None
            logger.info("Task scheduler shutdown")
    
    # =========================================================================
    # TASK CRUD OPERATIONS
    # =========================================================================
    
    async def create_task(
        self,
        tenant_id: str,
        agent_id: str,
        name: str,
        description: Optional[str],
        tool_name: str,
        tool_params: Dict[str, Any],
        schedule_type: str,  # 'cron', 'interval', 'one_time'
        schedule_config: Dict[str, Any],
        timezone_str: str = 'UTC',
        enabled: bool = True,
        on_complete: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a new scheduled task
        
        Args:
            tenant_id: Tenant ID
            agent_id: Agent ID that will execute the task
            name: Task name
            description: Task description
            tool_name: Tool to execute
            tool_params: Parameters for the tool
            schedule_type: 'cron', 'interval', or 'one_time'
            schedule_config: Schedule configuration (cron_expression, interval_minutes, or run_at)
            timezone_str: Timezone for the schedule
            enabled: Whether task is enabled
            on_complete: Optional action to perform after completion
        
        Returns:
            Created task document
        """
        task_id = str(uuid4())
        now = datetime.now(timezone.utc)
        
        # Calculate next run time
        next_run = self._calculate_next_run(schedule_type, schedule_config, timezone_str)
        
        task = {
            "id": task_id,
            "tenant_id": tenant_id,
            "agent_id": agent_id,
            "name": name,
            "description": description,
            "tool_name": tool_name,
            "tool_params": tool_params,
            "schedule": {
                "type": schedule_type,
                **schedule_config,
                "timezone": timezone_str
            },
            "enabled": enabled,
            "on_complete": on_complete,
            "last_execution": None,
            "next_run": next_run.isoformat() if next_run else None,
            "execution_count": 0,
            "success_count": 0,
            "failure_count": 0,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await self.db.scheduled_tasks.insert_one(task)
        
        # Schedule the job if enabled
        if enabled and self._scheduler:
            await self._schedule_task_job(task)
        
        task.pop("_id", None)
        return task
    
    async def get_task(
        self,
        task_id: str,
        tenant_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a task by ID"""
        task = await self.db.scheduled_tasks.find_one(
            {"id": task_id, "tenant_id": tenant_id},
            {"_id": 0}
        )
        return task
    
    async def get_task_by_name(
        self,
        name: str,
        tenant_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a task by name"""
        task = await self.db.scheduled_tasks.find_one(
            {"name": name, "tenant_id": tenant_id},
            {"_id": 0}
        )
        return task
    
    async def list_tasks(
        self,
        tenant_id: str,
        agent_id: Optional[str] = None,
        enabled: Optional[bool] = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """List tasks for a tenant"""
        query = {"tenant_id": tenant_id}
        
        if agent_id:
            query["agent_id"] = agent_id
        if enabled is not None:
            query["enabled"] = enabled
        
        cursor = self.db.scheduled_tasks.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit)
        
        return await cursor.to_list(length=limit)
    
    async def update_task(
        self,
        task_id: str,
        tenant_id: str,
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a task"""
        now = datetime.now(timezone.utc)
        updates["updated_at"] = now.isoformat()
        
        # If schedule is being updated, recalculate next_run
        if "schedule" in updates:
            schedule = updates["schedule"]
            next_run = self._calculate_next_run(
                schedule.get("type", "cron"),
                schedule,
                schedule.get("timezone", "UTC")
            )
            updates["next_run"] = next_run.isoformat() if next_run else None
        
        result = await self.db.scheduled_tasks.find_one_and_update(
            {"id": task_id, "tenant_id": tenant_id},
            {"$set": updates},
            return_document=True
        )
        
        if result:
            result.pop("_id", None)
            
            # Reschedule if enabled status or schedule changed
            if "enabled" in updates or "schedule" in updates:
                self._unschedule_task_job(task_id)
                if result.get("enabled"):
                    await self._schedule_task_job(result)
        
        return result
    
    async def delete_task(
        self,
        task_id: str,
        tenant_id: str
    ) -> bool:
        """Delete a task"""
        # Unschedule first
        self._unschedule_task_job(task_id)
        
        result = await self.db.scheduled_tasks.delete_one(
            {"id": task_id, "tenant_id": tenant_id}
        )
        return result.deleted_count > 0
    
    async def enable_task(
        self,
        task_id: str,
        tenant_id: str
    ) -> Optional[Dict[str, Any]]:
        """Enable a task"""
        return await self.update_task(task_id, tenant_id, {"enabled": True})
    
    async def disable_task(
        self,
        task_id: str,
        tenant_id: str
    ) -> Optional[Dict[str, Any]]:
        """Disable a task"""
        return await self.update_task(task_id, tenant_id, {"enabled": False})
    
    # =========================================================================
    # TASK EXECUTION
    # =========================================================================
    
    async def run_task_now(
        self,
        task_id: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Trigger immediate execution of a task"""
        task = await self.get_task(task_id, tenant_id)
        if not task:
            return {"success": False, "error": "Task not found"}
        
        # Execute the task
        result = await self._execute_task(task)
        return result
    
    async def _execute_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a scheduled task
        
        Args:
            task: Task document
        
        Returns:
            Execution result
        """
        task_id = task.get("id")
        tenant_id = task.get("tenant_id")
        
        # Check if already running
        if self._running_tasks.get(task_id):
            logger.warning(f"Task {task_id} is already running, skipping")
            return {"success": False, "error": "Task already running", "skipped": True}
        
        self._running_tasks[task_id] = True
        execution_id = str(uuid4())
        started_at = datetime.now(timezone.utc)
        
        try:
            logger.info(f"Executing scheduled task: {task.get('name')} ({task_id})")
            
            # Get orchestrator and execute tool
            orchestrator = self._get_orchestrator()
            
            # Get tenant tier (default to professional for scheduled tasks)
            # In production, you'd fetch this from the tenant's subscription
            tenant_tier = "professional"
            
            result = await orchestrator.execute_tool(
                tool_name=task.get("tool_name"),
                params=task.get("tool_params", {}),
                tenant_id=tenant_id,
                agent_id=task.get("agent_id"),
                tenant_tier=tenant_tier
            )
            
            success = result.get("success", False)
            
            # Update task stats
            completed_at = datetime.now(timezone.utc)
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)
            
            # Calculate next run
            schedule = task.get("schedule", {})
            next_run = self._calculate_next_run(
                schedule.get("type", "cron"),
                schedule,
                schedule.get("timezone", "UTC")
            )
            
            update = {
                "last_execution": {
                    "id": execution_id,
                    "status": "success" if success else "failed",
                    "started_at": started_at.isoformat(),
                    "completed_at": completed_at.isoformat(),
                    "duration_ms": duration_ms,
                    "result_summary": result.get("error") if not success else "Completed successfully"
                },
                "next_run": next_run.isoformat() if next_run else None,
                "updated_at": completed_at.isoformat()
            }
            
            if success:
                update["$inc"] = {"execution_count": 1, "success_count": 1}
            else:
                update["$inc"] = {"execution_count": 1, "failure_count": 1}
            
            # Separate $set and $inc
            set_update = {k: v for k, v in update.items() if k != "$inc"}
            inc_update = update.get("$inc", {})
            
            await self.db.scheduled_tasks.update_one(
                {"id": task_id},
                {
                    "$set": set_update,
                    "$inc": inc_update
                }
            )
            
            # Save execution to history
            execution_record = {
                "id": execution_id,
                "task_id": task_id,
                "tenant_id": tenant_id,
                "agent_id": task.get("agent_id"),
                "tool_name": task.get("tool_name"),
                "tool_params": task.get("tool_params"),
                "status": "success" if success else "failed",
                "started_at": started_at.isoformat(),
                "completed_at": completed_at.isoformat(),
                "duration_ms": duration_ms,
                "result": result,
                "error": result.get("error") if not success else None
            }
            await self.db.task_executions.insert_one(execution_record)
            
            # Handle on_complete action if configured
            on_complete = task.get("on_complete")
            if on_complete and success:
                await self._handle_on_complete(on_complete, result, task)
            
            logger.info(f"Task {task_id} execution completed: {'success' if success else 'failed'}")
            
            return {
                "success": True,
                "execution_id": execution_id,
                "task_success": success,
                "duration_ms": duration_ms,
                "result": result
            }
            
        except Exception as e:
            logger.error(f"Task {task_id} execution error: {str(e)}")
            
            # Update failure stats
            await self.db.scheduled_tasks.update_one(
                {"id": task_id},
                {
                    "$set": {
                        "last_execution": {
                            "id": execution_id,
                            "status": "error",
                            "started_at": started_at.isoformat(),
                            "completed_at": datetime.now(timezone.utc).isoformat(),
                            "error": str(e)
                        },
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$inc": {"execution_count": 1, "failure_count": 1}
                }
            )
            
            return {
                "success": False,
                "execution_id": execution_id,
                "error": str(e)
            }
        finally:
            self._running_tasks[task_id] = False
    
    async def _handle_on_complete(
        self,
        on_complete: Dict[str, Any],
        result: Dict[str, Any],
        task: Dict[str, Any]
    ):
        """Handle post-completion action"""
        action = on_complete.get("action")
        params = on_complete.get("params", {})
        
        try:
            if action == "send_notification":
                # TODO: Implement notification sending
                logger.info(f"Would send notification for task {task.get('id')}")
            elif action == "run_tool":
                # Execute another tool
                orchestrator = self._get_orchestrator()
                await orchestrator.execute_tool(
                    tool_name=params.get("tool_name"),
                    params=params.get("tool_params", {}),
                    tenant_id=task.get("tenant_id"),
                    agent_id=task.get("agent_id"),
                    tenant_tier="professional"
                )
            elif action == "webhook":
                # Call webhook
                import aiohttp
                async with aiohttp.ClientSession() as session:
                    await session.post(
                        params.get("url"),
                        json={
                            "task_id": task.get("id"),
                            "task_name": task.get("name"),
                            "result": result
                        }
                    )
        except Exception as e:
            logger.error(f"on_complete action failed: {str(e)}")
    
    # =========================================================================
    # EXECUTION HISTORY
    # =========================================================================
    
    async def get_task_executions(
        self,
        task_id: str,
        tenant_id: str,
        limit: int = 20,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Get execution history for a task"""
        cursor = self.db.task_executions.find(
            {"task_id": task_id, "tenant_id": tenant_id},
            {"_id": 0}
        ).sort("started_at", -1).skip(skip).limit(limit)
        
        return await cursor.to_list(length=limit)
    
    async def get_all_executions(
        self,
        tenant_id: str,
        limit: int = 50,
        skip: int = 0,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all task executions for a tenant"""
        query = {"tenant_id": tenant_id}
        if status:
            query["status"] = status
        
        cursor = self.db.task_executions.find(
            query,
            {"_id": 0}
        ).sort("started_at", -1).skip(skip).limit(limit)
        
        return await cursor.to_list(length=limit)
    
    # =========================================================================
    # SCHEDULER INTERNALS
    # =========================================================================
    
    async def _schedule_task_job(self, task: Dict[str, Any]):
        """Schedule a task job with APScheduler"""
        if not self._scheduler:
            return
        
        task_id = task.get("id")
        schedule = task.get("schedule", {})
        schedule_type = schedule.get("type", "cron")
        tz = schedule.get("timezone", "UTC")
        
        try:
            if schedule_type == "cron":
                cron_expr = schedule.get("cron_expression", "0 * * * *")
                trigger = CronTrigger.from_crontab(cron_expr, timezone=tz)
            elif schedule_type == "interval":
                minutes = schedule.get("interval_minutes", 60)
                trigger = IntervalTrigger(minutes=minutes, timezone=tz)
            elif schedule_type == "one_time":
                run_at_str = schedule.get("run_at")
                if run_at_str:
                    run_at = datetime.fromisoformat(run_at_str.replace('Z', '+00:00'))
                    trigger = DateTrigger(run_date=run_at, timezone=tz)
                else:
                    logger.error(f"one_time task {task_id} missing run_at")
                    return
            else:
                logger.error(f"Unknown schedule type: {schedule_type}")
                return
            
            # Create async wrapper for the job
            async def job_wrapper():
                await self._execute_task(task)
            
            # Schedule with APScheduler
            self._scheduler.add_job(
                job_wrapper,
                trigger,
                id=task_id,
                name=task.get("name"),
                replace_existing=True
            )
            
            logger.info(f"Scheduled task {task_id} with {schedule_type} trigger")
            
        except Exception as e:
            logger.error(f"Failed to schedule task {task_id}: {str(e)}")
    
    def _unschedule_task_job(self, task_id: str):
        """Remove a task job from the scheduler"""
        if self._scheduler:
            try:
                self._scheduler.remove_job(task_id)
                logger.info(f"Unscheduled task {task_id}")
            except Exception:
                pass  # Job might not exist
    
    def _calculate_next_run(
        self,
        schedule_type: str,
        schedule_config: Dict[str, Any],
        timezone_str: str
    ) -> Optional[datetime]:
        """Calculate next run time based on schedule"""
        try:
            now = datetime.now(timezone.utc)
            
            if schedule_type == "cron":
                cron_expr = schedule_config.get("cron_expression", "0 * * * *")
                trigger = CronTrigger.from_crontab(cron_expr, timezone=timezone_str)
                return trigger.get_next_fire_time(None, now)
            
            elif schedule_type == "interval":
                minutes = schedule_config.get("interval_minutes", 60)
                return now + timedelta(minutes=minutes)
            
            elif schedule_type == "one_time":
                run_at_str = schedule_config.get("run_at")
                if run_at_str:
                    return datetime.fromisoformat(run_at_str.replace('Z', '+00:00'))
            
            return None
        except Exception as e:
            logger.error(f"Error calculating next run: {str(e)}")
            return None
    
    def get_scheduler_stats(self) -> Dict[str, Any]:
        """Get scheduler statistics"""
        if not self._scheduler:
            return {"running": False, "jobs": 0}
        
        jobs = self._scheduler.get_jobs()
        return {
            "running": self._scheduler.running,
            "jobs": len(jobs),
            "job_ids": [job.id for job in jobs]
        }


# Global scheduler instance
_scheduler_service: Optional[TaskSchedulerService] = None


async def get_scheduler_service(db: AsyncIOMotorDatabase) -> TaskSchedulerService:
    """Get or create the scheduler service singleton"""
    global _scheduler_service
    if _scheduler_service is None:
        _scheduler_service = TaskSchedulerService(db)
        await _scheduler_service.initialize()
    return _scheduler_service
