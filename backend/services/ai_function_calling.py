"""
AI Function Calling Service for WooCommerce Integration
Enables agents to perform actions on behalf of customers
"""
import json
import logging
from typing import Dict, List, Any, Optional
from services.woocommerce_service import get_woocommerce_client

logger = logging.getLogger(__name__)


WOOCOMMERCE_TOOLS = [
    {
        "name": "search_orders",
        "description": "Search for customer orders by email address. Returns a list of orders.",
        "parameters": {
            "email": "Customer's email address"
        }
    },
    {
        "name": "get_order_details",
        "description": "Get detailed information about a specific order including status, items, and shipping info.",
        "parameters": {
            "order_id": "WooCommerce order ID (number)"
        }
    },
    {
        "name": "create_refund",
        "description": "Process a refund for an order. Use this when customer requests a refund.",
        "parameters": {
            "order_id": "WooCommerce order ID (number)",
            "amount": "Refund amount (optional, if not provided will refund full order)",
            "reason": "Reason for refund (optional, defaults to 'Customer request')"
        }
    }
]


def get_woocommerce_system_prompt() -> str:
    """Get system prompt instructions for WooCommerce-enabled agents"""
    tools_desc = ""
    for tool in WOOCOMMERCE_TOOLS:
        params_desc = ", ".join([f"{k}: {v}" for k, v in tool["parameters"].items()])
        tools_desc += f"\n- {tool['name']}({params_desc}): {tool['description']}"
    
    return f"""
WOOCOMMERCE INTEGRATION ENABLED:
You have access to the following WooCommerce tools to help customers:{tools_desc}

When a customer asks about orders, refunds, or order status, you can use these tools.

To use a tool, respond with a JSON object in this format:
{{"function": "tool_name", "parameters": {{"param1": "value1", "param2": "value2"}}}}

After using a tool, you'll receive the results. Then provide a natural, conversational response to the customer based on those results.

IMPORTANT:
- Always verify customer identity by asking for their email before searching orders
- For refunds, confirm the order details with the customer before processing
- Be empathetic when handling complaints
- If a tool operation fails, apologize and offer to escalate to human support
"""


async def execute_woocommerce_function(
    function_name: str,
    parameters: Dict[str, Any],
    agent_config: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Execute a WooCommerce function
    
    Args:
        function_name: Name of the function to execute
        parameters: Function parameters
        agent_config: Agent configuration containing WooCommerce credentials
        
    Returns:
        Dict with execution results
    """
    try:
        # Get WooCommerce client
        wc_client = get_woocommerce_client(agent_config)
        if not wc_client:
            return {
                "success": False,
                "error": "WooCommerce integration not properly configured"
            }
        
        # Execute the requested function
        if function_name == "search_orders":
            email = parameters.get("email")
            if not email:
                return {"success": False, "error": "Email parameter required"}
            
            orders = await wc_client.search_orders_by_email(email)
            return {
                "success": True,
                "data": orders,
                "message": f"Found {len(orders)} orders for {email}"
            }
        
        elif function_name == "get_order_details":
            order_id = parameters.get("order_id")
            if not order_id:
                return {"success": False, "error": "order_id parameter required"}
            
            order = await wc_client.get_order_details(int(order_id))
            if not order:
                return {
                    "success": False,
                    "error": f"Order {order_id} not found"
                }
            
            return {
                "success": True,
                "data": order,
                "message": f"Retrieved details for order {order_id}"
            }
        
        elif function_name == "create_refund":
            order_id = parameters.get("order_id")
            if not order_id:
                return {"success": False, "error": "order_id parameter required"}
            
            amount = parameters.get("amount")
            reason = parameters.get("reason", "Customer request")
            
            result = await wc_client.create_refund(
                order_id=int(order_id),
                amount=amount,
                reason=reason
            )
            return result
        
        else:
            return {
                "success": False,
                "error": f"Unknown function: {function_name}"
            }
    
    except Exception as e:
        logger.error(f"Error executing WooCommerce function {function_name}: {str(e)}")
        return {
            "success": False,
            "error": f"Error: {str(e)}"
        }


def detect_function_call(ai_response: str) -> Optional[Dict[str, Any]]:
    """
    Detect if AI response contains a function call
    
    Args:
        ai_response: AI generated response text
        
    Returns:
        Dict with function name and parameters if detected, None otherwise
    """
    try:
        # Try to parse as JSON
        response_stripped = ai_response.strip()
        
        # Check if response looks like a JSON object
        if response_stripped.startswith("{") and response_stripped.endswith("}"):
            try:
                parsed = json.loads(response_stripped)
                if "function" in parsed and "parameters" in parsed:
                    return parsed
            except json.JSONDecodeError:
                pass
        
        # Check for function call pattern in text
        if "```json" in response_stripped:
            try:
                # Extract JSON from markdown code block
                json_start = response_stripped.find("```json") + 7
                json_end = response_stripped.find("```", json_start)
                json_str = response_stripped[json_start:json_end].strip()
                parsed = json.loads(json_str)
                if "function" in parsed and "parameters" in parsed:
                    return parsed
            except (json.JSONDecodeError, ValueError):
                pass
        
        return None
    
    except Exception as e:
        logger.error(f"Error detecting function call: {str(e)}")
        return None


async def generate_ai_response_with_tools(
    latest_message: str,
    conversation_history: List[Dict[str, str]],
    agent: Dict[str, Any],
    provider: Dict[str, Any],
    base_system_prompt: str,
    agent_config: Dict[str, Any],
    max_iterations: int = 3
) -> str:
    """
    Generate AI response with WooCommerce function calling support
    
    Args:
        latest_message: Latest user message
        conversation_history: List of previous messages
        agent: Agent configuration
        provider: Provider configuration
        base_system_prompt: Base system prompt
        agent_config: Agent config (may contain WooCommerce settings)
        max_iterations: Maximum function calling iterations
        
    Returns:
        Final AI response string
    """
    # Check if WooCommerce is enabled
    wc_config = agent_config.get("config", {}).get("woocommerce", {})
    if not wc_config.get("enabled"):
        # No WooCommerce, return None to use standard generation
        return None
    
    # Add WooCommerce tools to system prompt
    enhanced_prompt = base_system_prompt + "\n\n" + get_woocommerce_system_prompt()
    
    # Track function call iterations
    iteration = 0
    current_history = list(conversation_history)
    current_message = latest_message
    function_results = []
    
    while iteration < max_iterations:
        iteration += 1
        
        # Generate AI response
        try:
            if provider["type"] == "openai":
                import openai
                client = openai.OpenAI(api_key=provider["api_key"])
                
                # Build messages
                api_messages = [{"role": "system", "content": enhanced_prompt}]
                api_messages.extend(current_history)
                
                # Add function results if any
                if function_results:
                    results_text = "\n\n".join([
                        f"Function: {r['function']}\nResult: {json.dumps(r['result'], indent=2)}"
                        for r in function_results
                    ])
                    api_messages.append({
                        "role": "system",
                        "content": f"Function execution results:\n{results_text}"
                    })
                
                api_messages.append({"role": "user", "content": current_message})
                
                # Check for restrictive models
                model_lower = agent["model"].lower()
                newer_models = ["gpt-4o", "gpt-5", "o1", "o3"]
                uses_new_param = any(model_prefix in model_lower for model_prefix in newer_models)
                restrictive_models = ["gpt-5", "o1", "o3"]
                is_restrictive = any(model_prefix in model_lower for model_prefix in restrictive_models)
                
                params = {
                    "model": agent["model"],
                    "messages": api_messages
                }
                
                if not is_restrictive:
                    params["temperature"] = agent["temperature"]
                
                if uses_new_param:
                    params["max_completion_tokens"] = agent["max_tokens"]
                else:
                    params["max_tokens"] = agent["max_tokens"]
                
                response = client.chat.completions.create(**params)
                ai_response = response.choices[0].message.content
                
            elif provider["type"] == "anthropic":
                import anthropic
                client = anthropic.Anthropic(api_key=provider["api_key"])
                
                api_messages = list(current_history)
                
                # Add function results if any
                if function_results:
                    results_text = "\n\n".join([
                        f"Function: {r['function']}\nResult: {json.dumps(r['result'], indent=2)}"
                        for r in function_results
                    ])
                    api_messages.append({
                        "role": "user",
                        "content": f"Function execution results:\n{results_text}"
                    })
                
                api_messages.append({"role": "user", "content": current_message})
                
                response = client.messages.create(
                    model=agent["model"],
                    max_tokens=agent["max_tokens"],
                    temperature=agent["temperature"],
                    system=enhanced_prompt,
                    messages=api_messages
                )
                ai_response = response.content[0].text
            
            else:
                return "I apologize, but the configured AI provider is not supported for WooCommerce integration."
            
            # Check if response contains a function call
            function_call = detect_function_call(ai_response)
            
            if function_call:
                # Execute the function
                logger.info(f"Executing function: {function_call['function']}")
                result = await execute_woocommerce_function(
                    function_call["function"],
                    function_call["parameters"],
                    agent_config
                )
                
                # Store the result
                function_results.append({
                    "function": function_call["function"],
                    "parameters": function_call["parameters"],
                    "result": result
                })
                
                # Continue the loop with the function result
                current_message = "Based on the function result, provide a natural response to the customer."
                continue
            else:
                # No function call detected, return the response
                return ai_response
        
        except Exception as e:
            logger.error(f"Error in function calling iteration {iteration}: {str(e)}")
            return "I apologize, but I'm having trouble processing your request. Please try again or contact support."
    
    # Max iterations reached
    logger.warning(f"Max function calling iterations ({max_iterations}) reached")
    return ai_response if 'ai_response' in locals() else "I apologize, but I'm having trouble processing your request."
