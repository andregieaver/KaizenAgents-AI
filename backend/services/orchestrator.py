"""Orchestrator Service - Core logic for Mother/Child agent delegation

This service implements the System 1/System 2 architecture where:
- Mother Agent (System 2): An LLM-based orchestrator that reasons about tasks
- Child Agents (System 1): Deterministic agents that execute specific functions

IMPORTANT: This service uses the API key from Admin Providers (stored in db.providers)
for all LLM calls. It does NOT use the Emergent LLM key.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import json

from middleware.database import db

logger = logging.getLogger(__name__)


class OrchestratorService:
    """Service for orchestrating Mother/Child agent interactions"""
    
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self.config = None
        self.mother_agent = None
        self.available_children = []
    
    async def initialize(self) -> bool:
        """Initialize orchestrator with tenant configuration"""
        # Load company agent config
        config = await db.company_agent_configs.find_one(
            {"company_id": self.tenant_id},
            {"_id": 0}
        )
        
        if not config:
            logger.warning(f"No agent config found for tenant {self.tenant_id}")
            return False
        
        orchestration = config.get("orchestration", {})
        if not orchestration.get("enabled"):
            logger.info(f"Orchestration not enabled for tenant {self.tenant_id}")
            return False
        
        self.config = orchestration
        
        # Load mother agent
        mother_id = orchestration.get("mother_admin_agent_id")
        if mother_id:
            self.mother_agent = await db.agents.find_one(
                {"id": mother_id, "is_active": True},
                {"_id": 0}
            )
            if not self.mother_agent:
                logger.error(f"Mother agent {mother_id} not found or inactive")
                return False
        else:
            logger.error("No mother agent configured")
            return False
        
        # Load available child agents (filtered by tenant_id for security)
        allowed_ids = orchestration.get("allowed_child_agent_ids", [])
        if allowed_ids:
            self.available_children = await db.user_agents.find(
                {
                    "tenant_id": self.tenant_id,
                    "id": {"$in": allowed_ids},
                    "orchestration_enabled": True
                },
                {"_id": 0}
            ).to_list(100)
        
        logger.info(f"Orchestrator initialized for tenant {self.tenant_id} with {len(self.available_children)} children")
        return True
    
    async def get_children_for_prompt(self, user_prompt: str) -> List[Dict[str, Any]]:
        """Get list of available children with their capabilities for the LLM prompt"""
        children_info = []
        
        for child in self.available_children:
            tags = child.get("tags", [])
            config = child.get("config", {})
            
            # Determine capabilities based on config
            capabilities = []
            if config.get("woocommerce", {}).get("enabled"):
                capabilities.append("woocommerce_operations")
            
            children_info.append({
                "id": child["id"],
                "name": child["name"],
                "description": child.get("description", ""),
                "tags": tags,
                "capabilities": capabilities,
                "category": child.get("category", "general")
            })
        
        return children_info
    
    def build_orchestration_prompt(self, user_prompt: str, children: List[Dict[str, Any]], knowledge_context: str = "") -> str:
        """Build the system prompt for the Mother agent to decide on delegation"""
        children_json = json.dumps(children, indent=2)
        
        # If there's knowledge context, use strict RAG mode
        if knowledge_context:
            return f"""You are an orchestrator AI for a customer support system.

CRITICAL RESTRICTIONS - YOU MUST FOLLOW THESE:
1. You may ONLY answer questions using the COMPANY KNOWLEDGE provided below.
2. You may ONLY delegate tasks to child agents for specific operations (like orders, products).
3. If a question is NOT covered by the knowledge below AND cannot be handled by a child agent, respond: "I don't have information about that in my knowledge base. Is there something else I can help you with regarding our products and services?"
4. NEVER answer general knowledge questions (geography, history, science, math, etc.)
5. If someone asks "what is the capital of France" or similar general questions, respond: "I can only help with questions about our company and services."

=== COMPANY KNOWLEDGE ===
{knowledge_context}
=== END KNOWLEDGE ===

You have access to the following child agents for specific tasks:
{children_json}

When processing a request:
1. First check if the answer is in the COMPANY KNOWLEDGE above
2. If yes, answer ONLY from that knowledge
3. If no, check if a child agent can handle it
4. If a child agent can handle it, delegate using this EXACT JSON format:
{{
  "delegate": true,
  "child_agent_id": "<agent_id>",
  "action_type": "<action_type>",
  "parameters": {{}},
  "reasoning": "<brief explanation>"
}}
5. If neither knowledge nor child agents can help, politely say you don't have that information

Current user request: {user_prompt}"""
        else:
            # No knowledge base - very restricted mode
            return f"""You are an orchestrator AI for a customer support system.

CRITICAL: There is NO company knowledge base configured yet.

You can ONLY:
1. Delegate specific tasks to child agents (if available)
2. For ALL other questions, respond: "I don't have access to company documentation yet. Please contact our support team for assistance."

You have access to these child agents:
{children_json}

For delegation, respond with EXACTLY this JSON format:
{{
  "delegate": true,
  "child_agent_id": "<agent_id>",
  "action_type": "<action_type>",
  "parameters": {{}},
  "reasoning": "<brief explanation>"
}}

DO NOT answer any general questions. DO NOT use your AI knowledge.

Current user request: {user_prompt}"""
    
    async def create_run_log(self, conversation_id: str, user_prompt: str) -> str:
        """Create an audit log entry for this orchestration run"""
        run_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        run_doc = {
            "id": run_id,
            "tenant_id": self.tenant_id,
            "conversation_id": conversation_id,
            "mother_admin_agent_id": self.mother_agent["id"],
            "user_prompt": user_prompt,
            "requested_actions": [],
            "executed_actions": [],
            "final_response": None,
            "status": "pending",
            "created_at": now,
            "completed_at": None
        }
        
        await db.orchestration_runs.insert_one(run_doc)
        return run_id
    
    async def update_run_log(
        self,
        run_id: str,
        requested_actions: List[Dict] = None,
        executed_actions: List[Dict] = None,
        final_response: str = None,
        status: str = None
    ):
        """Update the orchestration run log"""
        update_data = {}
        
        if requested_actions is not None:
            update_data["requested_actions"] = requested_actions
        if executed_actions is not None:
            update_data["executed_actions"] = executed_actions
        if final_response is not None:
            update_data["final_response"] = final_response
        if status is not None:
            update_data["status"] = status
            if status in ["completed", "failed"]:
                update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        if update_data:
            await db.orchestration_runs.update_one(
                {"id": run_id},
                {"$set": update_data}
            )
    
    async def execute_child_agent(
        self,
        child_agent_id: str,
        action_type: str,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a specific child agent's function"""
        # Find the child agent
        child = None
        for c in self.available_children:
            if c["id"] == child_agent_id:
                child = c
                break
        
        if not child:
            return {
                "success": False,
                "error": f"Child agent {child_agent_id} not found or not available"
            }
        
        # Execute based on action type
        if action_type == "woocommerce_operations":
            return await self._execute_woocommerce_action(child, parameters)
        else:
            return {
                "success": False,
                "error": f"Unknown action type: {action_type}"
            }
    
    async def _execute_woocommerce_action(
        self,
        child: Dict[str, Any],
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute WooCommerce action via child agent"""
        from services.woocommerce_service import decrypt_credential, WooCommerceService
        
        wc_config = child.get("config", {}).get("woocommerce", {})
        if not wc_config.get("enabled"):
            return {"success": False, "error": "WooCommerce not enabled for this agent"}
        
        try:
            store_url = wc_config.get("store_url")
            consumer_key = decrypt_credential(wc_config.get("consumer_key_encrypted", ""))
            consumer_secret = decrypt_credential(wc_config.get("consumer_secret_encrypted", ""))
            
            wc_service = WooCommerceService(store_url, consumer_key, consumer_secret)
            
            action = parameters.get("action", "list_products")
            
            if action == "list_products":
                result = await wc_service.list_products(limit=parameters.get("limit", 10))
            elif action == "get_order":
                result = await wc_service.get_order(parameters.get("order_id"))
            elif action == "list_orders":
                result = await wc_service.list_orders(limit=parameters.get("limit", 10))
            else:
                return {"success": False, "error": f"Unknown WooCommerce action: {action}"}
            
            return {"success": True, "data": result}
            
        except Exception as e:
            logger.error(f"WooCommerce action failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def process_with_mother(
        self,
        conversation_id: str,
        user_prompt: str,
        message_history: List[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Main orchestration flow - Mother agent processes request"""
        if not self.mother_agent:
            return {
                "success": False,
                "error": "Orchestrator not properly initialized"
            }
        
        # Create audit log
        run_id = await self.create_run_log(conversation_id, user_prompt)
        
        try:
            # Get children info
            children = await self.get_children_for_prompt(user_prompt)
            
            # Build orchestration prompt
            system_prompt = self.build_orchestration_prompt(user_prompt, children)
            
            # Get provider for Mother agent
            provider = await db.providers.find_one(
                {"id": self.mother_agent["provider_id"], "is_active": True},
                {"_id": 0}
            )
            
            if not provider:
                await self.update_run_log(run_id, status="failed")
                return {"success": False, "error": "Mother agent provider not available"}
            
            # Call the Mother agent LLM
            response_text = await self._call_mother_llm(
                provider,
                system_prompt,
                message_history or []
            )
            
            # Check if Mother wants to delegate
            delegation = self._parse_delegation_response(response_text)
            
            if delegation:
                # Log the requested action
                await self.update_run_log(
                    run_id,
                    requested_actions=[delegation],
                    status="processing"
                )
                
                # Execute the child agent
                result = await self.execute_child_agent(
                    delegation["child_agent_id"],
                    delegation["action_type"],
                    delegation.get("parameters", {})
                )
                
                # Log execution
                executed = {**delegation, "result": result}
                await self.update_run_log(
                    run_id,
                    executed_actions=[executed],
                    status="completed" if result["success"] else "failed"
                )
                
                # Generate final response using Mother with the result
                if result["success"]:
                    final_response = await self._generate_final_response(
                        provider,
                        user_prompt,
                        result["data"]
                    )
                else:
                    final_response = f"I tried to help but encountered an issue: {result.get('error', 'Unknown error')}"
                
                await self.update_run_log(run_id, final_response=final_response)
                
                return {
                    "success": True,
                    "response": final_response,
                    "delegated": True,
                    "run_id": run_id
                }
            else:
                # Mother responded directly
                await self.update_run_log(
                    run_id,
                    final_response=response_text,
                    status="completed"
                )
                
                return {
                    "success": True,
                    "response": response_text,
                    "delegated": False,
                    "run_id": run_id
                }
                
        except Exception as e:
            logger.error(f"Orchestration failed: {str(e)}")
            await self.update_run_log(run_id, status="failed")
            return {
                "success": False,
                "error": str(e),
                "run_id": run_id
            }
    
    async def _call_mother_llm(
        self,
        provider: Dict[str, Any],
        system_prompt: str,
        message_history: List[Dict[str, str]]
    ) -> str:
        """Call the Mother agent's LLM using the provider's API key from Admin Providers"""
        import openai
        
        # IMPORTANT: Always use the API key from the Admin Provider configured for the Mother agent
        # Never use EMERGENT_LLM_KEY - always use the provider's own key
        api_key = provider.get("api_key")
        if not api_key:
            raise ValueError("Mother agent's provider does not have an API key configured")
        
        provider_type = provider.get("type", "openai")
        model = self.mother_agent.get("model", "gpt-4o")
        
        if provider_type == "openai":
            client = openai.OpenAI(api_key=api_key)
            
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend(message_history)
            
            # Handle different OpenAI model parameter requirements
            # o-series models (o1, o3, etc.) and gpt-5.x use max_completion_tokens
            # Older models (gpt-4, gpt-4o) use max_tokens
            max_tokens_value = self.mother_agent.get("max_tokens", 2000)
            
            # Check if model requires max_completion_tokens (newer models)
            uses_new_param = any(prefix in model.lower() for prefix in ['o1', 'o3', 'o4', 'gpt-5'])
            
            if uses_new_param:
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=self.mother_agent.get("temperature", 0.7),
                    max_completion_tokens=max_tokens_value
                )
            else:
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=self.mother_agent.get("temperature", 0.7),
                    max_tokens=max_tokens_value
                )
            
            return response.choices[0].message.content
        
        elif provider_type == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            
            response = client.messages.create(
                model=model,
                max_tokens=self.mother_agent.get("max_tokens", 2000),
                system=system_prompt,
                messages=message_history if message_history else [{"role": "user", "content": "Please analyze and respond."}]
            )
            
            return response.content[0].text
        
        else:
            raise ValueError(f"Unsupported provider type: {provider_type}")
    
    def _parse_delegation_response(self, response: str) -> Optional[Dict[str, Any]]:
        """Parse Mother's response to check for delegation intent"""
        try:
            # Try to parse as JSON
            response = response.strip()
            
            # Handle markdown code blocks
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            
            response = response.strip()
            
            data = json.loads(response)
            
            if data.get("delegate") is True and data.get("child_agent_id"):
                return {
                    "child_agent_id": data["child_agent_id"],
                    "action_type": data.get("action_type", "unknown"),
                    "parameters": data.get("parameters", {}),
                    "reasoning": data.get("reasoning", "")
                }
        except (json.JSONDecodeError, KeyError, TypeError):
            pass
        
        return None
    
    async def _generate_final_response(
        self,
        provider: Dict[str, Any],
        original_prompt: str,
        child_result: Any
    ) -> str:
        """Generate a human-friendly response from the child agent's result
        
        Uses the provider's API key from Admin Providers - never the Emergent key
        """
        import openai
        
        result_json = json.dumps(child_result, indent=2, default=str)
        
        synthesis_prompt = f"""Based on the user's original request and the data retrieved, provide a helpful response.

Original request: {original_prompt}

Retrieved data:
{result_json}

Provide a natural, helpful response that addresses the user's request using this data."""
        
        # IMPORTANT: Always use the API key from the Admin Provider
        api_key = provider.get("api_key")
        if not api_key:
            raise ValueError("Provider does not have an API key configured")
        
        provider_type = provider.get("type", "openai")
        model = self.mother_agent.get("model", "gpt-4o")
        
        if provider_type == "openai":
            client = openai.OpenAI(api_key=api_key)
            
            # Handle different OpenAI model parameter requirements
            uses_new_param = any(prefix in model.lower() for prefix in ['o1', 'o3', 'o4', 'gpt-5'])
            
            if uses_new_param:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant that synthesizes information into clear responses."},
                        {"role": "user", "content": synthesis_prompt}
                    ],
                    temperature=0.7,
                    max_completion_tokens=2000
                )
            else:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant that synthesizes information into clear responses."},
                        {"role": "user", "content": synthesis_prompt}
                    ],
                    temperature=0.7,
                    max_tokens=2000
                )
            
            return response.choices[0].message.content
        
        elif provider_type == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            
            response = client.messages.create(
                model=model,
                max_tokens=2000,
                system="You are a helpful assistant that synthesizes information into clear responses.",
                messages=[{"role": "user", "content": synthesis_prompt}]
            )
            
            return response.content[0].text
        
        else:
            raise ValueError(f"Unsupported provider type: {provider_type}")


async def get_orchestrator(tenant_id: str) -> Optional[OrchestratorService]:
    """Factory function to get an initialized orchestrator for a tenant"""
    orchestrator = OrchestratorService(tenant_id)
    if await orchestrator.initialize():
        return orchestrator
    return None
