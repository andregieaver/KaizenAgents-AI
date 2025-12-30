"""
Tool Orchestrator Service
Coordinates tool execution, rate limiting, and logging for AI agents
"""
import asyncio
import logging
import json
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
from uuid import uuid4
from motor.motor_asyncio import AsyncIOMotorDatabase

from services.tool_registry import (
    TOOL_REGISTRY,
    TOOL_FEATURE_GATES,
    get_tool_schema,
    get_tools_for_openai,
    get_feature_for_tool
)
from services.browser_tools import (
    BrowserSession,
    execute_browser_tool,
    BROWSER_TOOL_EXECUTORS
)

logger = logging.getLogger(__name__)


class ToolOrchestrator:
    """
    Orchestrates tool execution for AI agents
    - Validates tool access based on feature gates
    - Enforces rate limits per tenant/tier
    - Logs all executions
    - Manages browser sessions
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self._active_sessions: Dict[str, BrowserSession] = {}
    
    # =========================================================================
    # TOOL ACCESS & VALIDATION
    # =========================================================================
    
    async def get_enabled_tools(
        self,
        agent_id: str,
        tenant_id: str
    ) -> List[str]:
        """Get list of tools enabled for an agent"""
        # Check agent tool config
        config = await self.db.agent_tool_configs.find_one({
            "agent_id": agent_id,
            "tenant_id": tenant_id
        }, {"_id": 0})
        
        if config and config.get("enabled_tools"):
            return config["enabled_tools"]
        
        # Return default browser tools if no config
        return ["browse_website", "take_screenshot", "extract_text", "get_page_info"]
    
    async def get_tools_for_agent(
        self,
        agent_id: str,
        tenant_id: str,
        tenant_tier: str = "starter"
    ) -> List[Dict[str, Any]]:
        """
        Get OpenAI-formatted tool definitions for an agent
        Filtered by enabled tools and feature gates
        """
        enabled_tools = await self.get_enabled_tools(agent_id, tenant_id)
        
        # Filter by feature gates based on tier
        accessible_tools = []
        for tool_name in enabled_tools:
            feature_key = get_feature_for_tool(tool_name)
            if feature_key:
                gate = TOOL_FEATURE_GATES.get(feature_key, {})
                tier_limits = gate.get("tier_limits", {})
                limit = tier_limits.get(tenant_tier, 0)
                if limit > 0:
                    accessible_tools.append(tool_name)
            else:
                accessible_tools.append(tool_name)
        
        return get_tools_for_openai(accessible_tools)
    
    async def validate_tool_access(
        self,
        tool_name: str,
        tenant_id: str,
        tenant_tier: str = "starter"
    ) -> Dict[str, Any]:
        """
        Validate if tenant can use a tool (feature gate + rate limit)
        
        Returns:
            Dict with 'allowed' bool and 'reason' if denied
        """
        feature_key = get_feature_for_tool(tool_name)
        
        if not feature_key:
            return {"allowed": True}
        
        gate = TOOL_FEATURE_GATES.get(feature_key, {})
        tier_limits = gate.get("tier_limits", {})
        limit = tier_limits.get(tenant_tier, 0)
        
        if limit == 0:
            return {
                "allowed": False,
                "reason": f"Tool '{tool_name}' not available on {tenant_tier} plan"
            }
        
        # Check rate limit
        usage = await self._get_current_usage(tenant_id, feature_key)
        if usage >= limit:
            return {
                "allowed": False,
                "reason": f"Rate limit exceeded for {tool_name}. Limit: {limit}/hour, Used: {usage}"
            }
        
        return {"allowed": True, "remaining": limit - usage}
    
    async def _get_current_usage(
        self,
        tenant_id: str,
        feature_key: str
    ) -> int:
        """Get current hour's usage for a feature"""
        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y-%m-%d")
        hour = now.hour
        
        usage = await self.db.tool_usage_tracking.find_one({
            "tenant_id": tenant_id,
            "date": date_str,
            "hour": hour
        }, {"_id": 0})
        
        if not usage:
            return 0
        
        # Sum up tool counts for this feature
        tools = TOOL_FEATURE_GATES.get(feature_key, {}).get("tools", [])
        total = 0
        for tool in tools:
            total += usage.get("tool_counts", {}).get(tool, 0)
        
        return total
    
    async def _increment_usage(
        self,
        tenant_id: str,
        tool_name: str
    ):
        """Increment usage counter for a tool"""
        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y-%m-%d")
        hour = now.hour
        
        await self.db.tool_usage_tracking.update_one(
            {
                "tenant_id": tenant_id,
                "date": date_str,
                "hour": hour
            },
            {
                "$inc": {
                    f"tool_counts.{tool_name}": 1,
                    "total_executions": 1
                },
                "$setOnInsert": {
                    "tenant_id": tenant_id,
                    "date": date_str,
                    "hour": hour
                }
            },
            upsert=True
        )
    
    # =========================================================================
    # TOOL EXECUTION
    # =========================================================================
    
    async def execute_tool(
        self,
        tool_name: str,
        params: Dict[str, Any],
        tenant_id: str,
        agent_id: str,
        conversation_id: Optional[str] = None,
        tenant_tier: str = "starter",
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute a tool with validation, logging, and rate limiting
        
        Args:
            tool_name: Name of tool to execute
            params: Tool parameters
            tenant_id: Tenant ID for isolation
            agent_id: Agent executing the tool
            conversation_id: Optional conversation context
            tenant_tier: Tenant's subscription tier
            session_id: Optional browser session to reuse
        
        Returns:
            Tool execution result
        """
        execution_id = str(uuid4())
        started_at = datetime.now(timezone.utc)
        
        # Create execution log entry
        execution_log = {
            "id": execution_id,
            "tenant_id": tenant_id,
            "agent_id": agent_id,
            "conversation_id": conversation_id,
            "tool_name": tool_name,
            "tool_params": params,
            "status": "running",
            "started_at": started_at.isoformat(),
            "completed_at": None,
            "duration_ms": None,
            "result": None,
            "error": None
        }
        
        try:
            # Validate access
            access = await self.validate_tool_access(tool_name, tenant_id, tenant_tier)
            if not access["allowed"]:
                execution_log["status"] = "denied"
                execution_log["error"] = access["reason"]
                await self._save_execution_log(execution_log)
                return {
                    "success": False,
                    "error": access["reason"],
                    "execution_id": execution_id
                }
            
            # Execute the tool
            if tool_name in BROWSER_TOOL_EXECUTORS:
                # Browser tool - manage session
                session = None
                if session_id and session_id in self._active_sessions:
                    session = self._active_sessions[session_id]
                
                result = await execute_browser_tool(tool_name, params, session)
            else:
                # Unknown tool
                result = {"success": False, "error": f"Tool not implemented: {tool_name}"}
            
            # Update execution log
            completed_at = datetime.now(timezone.utc)
            execution_log["status"] = "success" if result.get("success") else "failed"
            execution_log["completed_at"] = completed_at.isoformat()
            execution_log["duration_ms"] = int((completed_at - started_at).total_seconds() * 1000)
            execution_log["result"] = result
            
            # Increment usage counter
            if result.get("success"):
                await self._increment_usage(tenant_id, tool_name)
            
            # Save execution log
            await self._save_execution_log(execution_log)
            
            # Add execution_id to result
            result["execution_id"] = execution_id
            return result
            
        except Exception as e:
            logger.error(f"Tool execution error: {str(e)}")
            
            completed_at = datetime.now(timezone.utc)
            execution_log["status"] = "failed"
            execution_log["completed_at"] = completed_at.isoformat()
            execution_log["duration_ms"] = int((completed_at - started_at).total_seconds() * 1000)
            execution_log["error"] = str(e)
            
            await self._save_execution_log(execution_log)
            
            return {
                "success": False,
                "error": str(e),
                "execution_id": execution_id
            }
    
    async def _save_execution_log(self, log: Dict[str, Any]):
        """Save execution log to database"""
        # Remove screenshot data from log to save space
        log_copy = log.copy()
        if log_copy.get("result", {}).get("screenshot"):
            log_copy["result"] = log_copy["result"].copy()
            log_copy["result"]["screenshot"] = {"saved": True, "size": log_copy["result"]["screenshot"].get("size")}
        
        await self.db.tool_executions.insert_one(log_copy)
    
    # =========================================================================
    # SESSION MANAGEMENT
    # =========================================================================
    
    async def create_session(self, tenant_id: str) -> str:
        """Create a new browser session"""
        session_id = str(uuid4())
        session = BrowserSession(session_id)
        await session.__aenter__()
        self._active_sessions[session_id] = session
        
        logger.info(f"Created browser session {session_id} for tenant {tenant_id}")
        return session_id
    
    async def close_session(self, session_id: str):
        """Close a browser session"""
        if session_id in self._active_sessions:
            session = self._active_sessions.pop(session_id)
            await session.__aexit__(None, None, None)
            logger.info(f"Closed browser session {session_id}")
    
    async def cleanup_sessions(self):
        """Clean up all active sessions"""
        for session_id in list(self._active_sessions.keys()):
            await self.close_session(session_id)
    
    # =========================================================================
    # EXECUTION HISTORY
    # =========================================================================
    
    async def get_execution_history(
        self,
        tenant_id: str,
        agent_id: Optional[str] = None,
        tool_name: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Get tool execution history"""
        query = {"tenant_id": tenant_id}
        
        if agent_id:
            query["agent_id"] = agent_id
        if tool_name:
            query["tool_name"] = tool_name
        if status:
            query["status"] = status
        
        cursor = self.db.tool_executions.find(
            query,
            {"_id": 0}
        ).sort("started_at", -1).skip(skip).limit(limit)
        
        return await cursor.to_list(length=limit)
    
    async def get_usage_stats(
        self,
        tenant_id: str,
        days: int = 7
    ) -> Dict[str, Any]:
        """Get usage statistics for a tenant"""
        from datetime import timedelta
        
        now = datetime.now(timezone.utc)
        start_date = (now - timedelta(days=days)).strftime("%Y-%m-%d")
        
        pipeline = [
            {
                "$match": {
                    "tenant_id": tenant_id,
                    "date": {"$gte": start_date}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_executions": {"$sum": "$total_executions"},
                    "by_tool": {"$push": "$tool_counts"}
                }
            }
        ]
        
        results = await self.db.tool_usage_tracking.aggregate(pipeline).to_list(1)
        
        if not results:
            return {"total_executions": 0, "by_tool": {}}
        
        # Merge tool counts
        by_tool = {}
        for tool_counts in results[0].get("by_tool", []):
            for tool, count in tool_counts.items():
                by_tool[tool] = by_tool.get(tool, 0) + count
        
        return {
            "total_executions": results[0].get("total_executions", 0),
            "by_tool": by_tool,
            "period_days": days
        }


# =============================================================================
# OPENAI FUNCTION CALLING INTEGRATION
# =============================================================================

def parse_tool_call(tool_call: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse OpenAI tool call into executable format
    
    Args:
        tool_call: OpenAI tool_call object
    
    Returns:
        Dict with tool_name and params
    """
    function = tool_call.get("function", {})
    tool_name = function.get("name")
    
    try:
        params = json.loads(function.get("arguments", "{}"))
    except json.JSONDecodeError:
        params = {}
    
    return {
        "tool_call_id": tool_call.get("id"),
        "tool_name": tool_name,
        "params": params
    }


def format_tool_result(
    tool_call_id: str,
    result: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Format tool result for OpenAI API
    
    Args:
        tool_call_id: ID from the tool call
        result: Tool execution result
    
    Returns:
        OpenAI tool message format
    """
    # Remove large data like screenshots from the result sent back to LLM
    result_for_llm = result.copy()
    if "screenshot" in result_for_llm:
        result_for_llm["screenshot"] = {"captured": True, "size": result_for_llm["screenshot"].get("size")}
    
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": json.dumps(result_for_llm)
    }


async def process_tool_calls(
    tool_calls: List[Dict[str, Any]],
    orchestrator: ToolOrchestrator,
    tenant_id: str,
    agent_id: str,
    conversation_id: Optional[str] = None,
    tenant_tier: str = "starter"
) -> List[Dict[str, Any]]:
    """
    Process multiple tool calls from OpenAI
    
    Args:
        tool_calls: List of tool calls from OpenAI response
        orchestrator: Tool orchestrator instance
        tenant_id: Tenant ID
        agent_id: Agent ID
        conversation_id: Optional conversation ID
        tenant_tier: Tenant subscription tier
    
    Returns:
        List of tool result messages
    """
    results = []
    
    for tool_call in tool_calls:
        parsed = parse_tool_call(tool_call)
        
        result = await orchestrator.execute_tool(
            tool_name=parsed["tool_name"],
            params=parsed["params"],
            tenant_id=tenant_id,
            agent_id=agent_id,
            conversation_id=conversation_id,
            tenant_tier=tenant_tier
        )
        
        results.append(format_tool_result(parsed["tool_call_id"], result))
    
    return results
