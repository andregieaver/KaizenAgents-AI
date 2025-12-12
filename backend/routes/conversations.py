"""
Conversations routes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import jwt

from models import *
from middleware import get_current_user, get_super_admin_user, get_admin_or_owner_user
from middleware.database import db
from middleware.auth import create_token, hash_password, verify_password, is_super_admin, JWT_SECRET, JWT_ALGORITHM

router = APIRouter(prefix="/conversations", tags=["conversations"])

@router.get("", response_model=List[ConversationResponse])
@router.get("/", response_model=List[ConversationResponse])
async def list_conversations(
    conversation_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    query = {"tenant_id": tenant_id}
    if conversation_status:
        query["status"] = conversation_status
    
    conversations = await db.conversations.find(query, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return conversations

@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    conversation = await db.conversations.find_one(
        {"id": conversation_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conversation

@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(conversation_id: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify conversation belongs to tenant
    conversation = await db.conversations.find_one(
        {"id": conversation_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = await db.messages.find(
        {"conversation_id": conversation_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    return messages

@router.get("/{conversation_id}/sentiment")
async def get_conversation_sentiment(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get engagement and tone analysis for a conversation"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    conversation = await db.conversations.find_one(
        {"id": conversation_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {
        "engagement": conversation.get("engagement_score", 5),
        "tone": conversation.get("tone_score", 0),  # -100 to 100, 0 is neutral
        "last_analyzed": conversation.get("sentiment_analyzed_at")
    }

@router.post("/{conversation_id}/analyze-sentiment")
async def analyze_conversation_sentiment(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Analyze conversation sentiment and update engagement/tone scores"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    conversation = await db.conversations.find_one(
        {"id": conversation_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get recent messages
    messages = await db.messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(15).to_list(15)
    messages.reverse()
    
    if not messages:
        return {"engagement": 5, "tone": 0}
    
    # Get agent config for AI provider
    agent_config = await db.company_agent_configs.find_one({"tenant_id": tenant_id}, {"_id": 0})
    agent = None
    if agent_config and agent_config.get("selected_agent_id"):
        agent = await db.agents.find_one({"id": agent_config["selected_agent_id"]}, {"_id": 0})
    
    # Analyze sentiment
    try:
        result = await analyze_sentiment(messages, agent)
        
        # Update conversation with new scores
        now = datetime.now(timezone.utc).isoformat()
        await db.conversations.update_one(
            {"id": conversation_id},
            {
                "$set": {
                    "engagement_score": result["engagement"],
                    "tone_score": result["tone"],
                    "sentiment_analyzed_at": now
                }
            }
        )
        
        return result
    except Exception as e:
        print(f"Error analyzing sentiment: {e}")
        return {"engagement": 5, "tone": 0}

async def analyze_sentiment(messages: list, agent: dict = None) -> dict:
    """Analyze conversation sentiment using AI"""
    
    # Build conversation text for analysis
    conversation_text = ""
    customer_messages = []
    for msg in messages:
        role = "Customer" if msg.get("author_type") == "customer" else "Agent"
        content = msg.get("content", "")
        conversation_text += f"{role}: {content}\n"
        if msg.get("author_type") == "customer":
            customer_messages.append(content)
    
    if not customer_messages:
        return {"engagement": 5, "tone": 0}
    
    system_prompt = """You are an expert conversation analyst. Analyze the following customer support conversation and provide two metrics:

1. ENGAGEMENT (1-10): How engaged is the customer in this conversation?
   - 1-3: Disengaged (short responses, seems distracted, delayed responses)
   - 4-6: Moderately engaged (normal conversation flow)
   - 7-10: Highly engaged (detailed responses, asking questions, showing interest)

2. TONE (-100 to 100): What is the emotional tone of the customer?
   - -100 to -50: Very negative (angry, frustrated, threatening)
   - -50 to -20: Negative (disappointed, annoyed, unhappy)
   - -20 to 20: Neutral
   - 20 to 50: Positive (satisfied, pleased)
   - 50 to 100: Very positive (happy, grateful, enthusiastic)

Respond ONLY with a JSON object in this exact format:
{"engagement": <number 1-10>, "tone": <number -100 to 100>}

Do not include any other text, explanation, or formatting."""

    user_prompt = f"""Analyze this conversation:

{conversation_text}

Focus on the CUSTOMER's messages and behavior. Provide the engagement and tone scores."""

    provider = agent.get("provider", "openai").lower() if agent else "openai"
    model = agent.get("model", "gpt-4o-mini") if agent else "gpt-4o-mini"
    
    try:
        if provider == "openai":
            from emergentintegrations.llm.openai import chat
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=model,
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.3
            )
        elif provider == "anthropic":
            from emergentintegrations.llm.anthropic import chat
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=model,
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.3
            )
        elif provider == "google":
            from emergentintegrations.llm.google import chat
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=model,
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.3
            )
        else:
            return {"engagement": 5, "tone": 0}
        
        # Parse JSON response
        import json
        # Try to extract JSON from the response
        response = response.strip()
        if response.startswith("```"):
            # Remove markdown code blocks
            response = response.split("```")[1]
            if response.startswith("json"):
                response = response[4:]
        
        result = json.loads(response)
        
        # Validate and clamp values
        engagement = max(1, min(10, int(result.get("engagement", 5))))
        tone = max(-100, min(100, int(result.get("tone", 0))))
        
        return {"engagement": engagement, "tone": tone}
        
    except Exception as e:
        print(f"Error in analyze_sentiment: {e}")
        return {"engagement": 5, "tone": 0}

@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def add_agent_message(
    conversation_id: str,
    message_data: MessageCreate,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Verify conversation belongs to tenant
    conversation = await db.conversations.find_one(
        {"id": conversation_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    now = datetime.now(timezone.utc).isoformat()
    message_id = str(uuid.uuid4())
    
    message_doc = {
        "id": message_id,
        "conversation_id": conversation_id,
        "author_type": "agent",
        "author_id": current_user["id"],
        "content": message_data.content,
        "created_at": now
    }
    await db.messages.insert_one(message_doc)
    
    # Update conversation
    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {
                "last_message": message_data.content[:100],
                "last_message_at": now,
                "updated_at": now,
                "status": "waiting"
            }
        }
    )
    
    return {k: v for k, v in message_doc.items() if k != "_id"}

@router.patch("/{conversation_id}/mode", response_model=ConversationResponse)
async def update_conversation_mode(
    conversation_id: str,
    mode: Literal["ai", "agent", "assisted", "hybrid"],
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get current conversation to check if mode is actually changing
    current_conv = await db.conversations.find_one({"id": conversation_id, "tenant_id": tenant_id})
    if not current_conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    old_mode = current_conv.get("mode", "ai")
    
    # For assisted and agent modes, assign the current user as the agent
    assigned_agent_id = current_user["id"] if mode in ["agent", "assisted"] else None
    
    result = await db.conversations.find_one_and_update(
        {"id": conversation_id, "tenant_id": tenant_id},
        {
            "$set": {
                "mode": mode,
                "assigned_agent_id": assigned_agent_id,
                "updated_at": now
            }
        },
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Add system message if mode actually changed
    if old_mode != mode:
        mode_messages = {
            "ai": "You are now chatting with our AI assistant.",
            "agent": "A human support agent has joined the conversation.",
            "assisted": "A human support agent has joined the conversation.",
            "hybrid": "The conversation is now in hybrid mode."
        }
        
        system_message = {
            "id": str(uuid.uuid4()),
            "conversation_id": conversation_id,
            "content": mode_messages.get(mode, f"Conversation mode changed to {mode}."),
            "author_type": "system",
            "created_at": now
        }
        await db.messages.insert_one(system_message)
    
    # Remove _id before returning
    result.pop("_id", None)
    return result

@router.post("/{conversation_id}/suggestions")
async def get_ai_suggestions(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate AI response suggestions for assisted mode"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Get conversation
    conversation = await db.conversations.find_one({"id": conversation_id, "tenant_id": tenant_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get recent messages for context
    messages = await db.messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    messages.reverse()  # Chronological order
    
    if not messages:
        return {"suggestions": []}
    
    # Get the last customer message
    last_customer_msg = None
    for msg in reversed(messages):
        if msg.get("author_type") == "customer":
            last_customer_msg = msg
            break
    
    if not last_customer_msg:
        return {"suggestions": []}
    
    # Get agent config for this tenant
    agent_config = await db.company_agent_configs.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not agent_config or not agent_config.get("selected_agent_id"):
        return {"suggestions": ["I'll look into this for you.", "Let me check that.", "Thank you for your patience."]}
    
    # Get the agent
    agent = await db.agents.find_one({"id": agent_config["selected_agent_id"]}, {"_id": 0})
    if not agent:
        return {"suggestions": ["I'll look into this for you.", "Let me check that.", "Thank you for your patience."]}
    
    # Get RAG context if available
    rag_context = ""
    try:
        from rag_service import get_rag_context
        rag_context = await get_rag_context(tenant_id, last_customer_msg["content"])
    except Exception as e:
        print(f"RAG context error: {e}")
    
    # Build conversation history for context
    conversation_history = ""
    for msg in messages[-6:]:  # Last 6 messages for context
        role = "Customer" if msg.get("author_type") == "customer" else "Agent"
        conversation_history += f"{role}: {msg.get('content', '')}\n"
    
    # Generate suggestions using AI
    try:
        suggestions = await generate_suggestions(
            agent=agent,
            customer_message=last_customer_msg["content"],
            conversation_history=conversation_history,
            rag_context=rag_context,
            custom_instructions=agent_config.get("custom_instructions", "")
        )
        return {"suggestions": suggestions}
    except Exception as e:
        print(f"Error generating suggestions: {e}")
        return {"suggestions": ["I'll help you with that.", "Let me check this for you.", "Thank you for reaching out."]}

async def generate_suggestions(agent: dict, customer_message: str, conversation_history: str, rag_context: str, custom_instructions: str) -> list:
    """Generate 3 AI response suggestions"""
    
    system_prompt = f"""You are an AI assistant helping a human support agent respond to customers.
Based on the conversation context, generate exactly 3 different response suggestions.
Each suggestion should be:
- Professional and helpful
- Concise (1-2 sentences max)
- Different in tone/approach from the others

{f'Knowledge base context: {rag_context}' if rag_context else ''}
{f'Custom instructions: {custom_instructions}' if custom_instructions else ''}

Respond with exactly 3 suggestions, one per line, numbered 1-3. Do not include any other text."""

    user_prompt = f"""Recent conversation:
{conversation_history}

Generate 3 response suggestions for the agent to reply to the customer's last message: "{customer_message}"
"""

    provider = agent.get("provider", "openai").lower()
    model = agent.get("model", "gpt-4o-mini")
    
    try:
        if provider == "openai":
            from emergentintegrations.llm.openai import chat
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=model,
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.7
            )
        elif provider == "anthropic":
            from emergentintegrations.llm.anthropic import chat
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=model,
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.7
            )
        elif provider == "google":
            from emergentintegrations.llm.google import chat
            response = await chat(
                api_key=os.environ.get("EMERGENT_LLM_KEY"),
                model=model,
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.7
            )
        else:
            return ["I'll help you with that.", "Let me look into this.", "Thank you for your patience."]
        
        # Parse response into 3 suggestions
        lines = response.strip().split('\n')
        suggestions = []
        for line in lines:
            # Remove numbering like "1.", "1)", "1:" etc.
            cleaned = line.strip()
            if cleaned:
                # Remove common prefixes
                for prefix in ['1.', '2.', '3.', '1)', '2)', '3)', '1:', '2:', '3:']:
                    if cleaned.startswith(prefix):
                        cleaned = cleaned[len(prefix):].strip()
                        break
                if cleaned:
                    suggestions.append(cleaned)
        
        # Ensure we have exactly 3 suggestions
        while len(suggestions) < 3:
            suggestions.append("Let me help you with that.")
        
        return suggestions[:3]
        
    except Exception as e:
        print(f"Error in generate_suggestions: {e}")
        return ["I'll help you with that.", "Let me look into this.", "Thank you for your patience."]

@router.patch("/{conversation_id}/status", response_model=ConversationResponse)
async def update_conversation_status(
    conversation_id: str,
    new_status: Literal["open", "waiting", "resolved"],
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.conversations.find_one_and_update(
        {"id": conversation_id, "tenant_id": tenant_id},
        {"$set": {"status": new_status, "updated_at": now}},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    result.pop("_id", None)
    return result