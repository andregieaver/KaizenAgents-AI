"""
Analytics routes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid

# No models imported from models module
from middleware import get_current_user, get_super_admin_user
from middleware.database import db

router = APIRouter(prefix="/analytics", tags=["analytics"])

analytics_router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/overview")
async def get_analytics_overview(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get analytics overview for the tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Total conversations
    total_conversations = await db.conversations.count_documents({"tenant_id": tenant_id})
    
    # Conversations in period
    period_conversations = await db.conversations.count_documents({
        "tenant_id": tenant_id,
        "created_at": {"$gte": cutoff_date}
    })
    
    # By status
    open_count = await db.conversations.count_documents({"tenant_id": tenant_id, "status": "open"})
    waiting_count = await db.conversations.count_documents({"tenant_id": tenant_id, "status": "waiting"})
    resolved_count = await db.conversations.count_documents({"tenant_id": tenant_id, "status": "resolved"})
    
    # By mode
    ai_mode_count = await db.conversations.count_documents({"tenant_id": tenant_id, "mode": "ai"})
    agent_mode_count = await db.conversations.count_documents({"tenant_id": tenant_id, "mode": "agent"})
    assisted_mode_count = await db.conversations.count_documents({"tenant_id": tenant_id, "mode": "assisted"})
    
    # Total messages
    conversation_ids = await db.conversations.distinct("id", {"tenant_id": tenant_id})
    total_messages = await db.messages.count_documents({"conversation_id": {"$in": conversation_ids}})
    
    # Messages by type
    customer_messages = await db.messages.count_documents({
        "conversation_id": {"$in": conversation_ids},
        "author_type": "customer"
    })
    ai_messages = await db.messages.count_documents({
        "conversation_id": {"$in": conversation_ids},
        "author_type": "ai"
    })
    agent_messages = await db.messages.count_documents({
        "conversation_id": {"$in": conversation_ids},
        "author_type": "agent"
    })
    
    # Average messages per conversation
    avg_messages = total_messages / total_conversations if total_conversations > 0 else 0
    
    # Transfer requests
    total_transfers = await db.transfer_requests.count_documents({"tenant_id": tenant_id})
    accepted_transfers = await db.transfer_requests.count_documents({"tenant_id": tenant_id, "status": "accepted"})
    
    return {
        "total_conversations": total_conversations,
        "period_conversations": period_conversations,
        "by_status": {
            "open": open_count,
            "waiting": waiting_count,
            "resolved": resolved_count
        },
        "by_mode": {
            "ai": ai_mode_count,
            "agent": agent_mode_count,
            "assisted": assisted_mode_count
        },
        "messages": {
            "total": total_messages,
            "customer": customer_messages,
            "ai": ai_messages,
            "agent": agent_messages,
            "avg_per_conversation": round(avg_messages, 1)
        },
        "transfers": {
            "total": total_transfers,
            "accepted": accepted_transfers,
            "acceptance_rate": round(accepted_transfers / total_transfers * 100, 1) if total_transfers > 0 else 0
        }
    }

@router.get("/trends")
async def get_analytics_trends(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get conversation trends over time"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    
    trends = []
    for i in range(days, -1, -1):
        date = datetime.now(timezone.utc) - timedelta(days=i)
        date_start = date.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        date_end = date.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
        
        count = await db.conversations.count_documents({
            "tenant_id": tenant_id,
            "created_at": {"$gte": date_start, "$lte": date_end}
        })
        
        trends.append({
            "date": date.strftime("%Y-%m-%d"),
            "conversations": count
        })
    
    return {"trends": trends}

@router.get("/agent-performance")
async def get_agent_performance(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get agent performance metrics"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Get all agents for this tenant
    agents = await db.users.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    
    agent_stats = []
    for agent in agents:
        # Conversations handled (assigned to this agent)
        conversations_handled = await db.conversations.count_documents({
            "tenant_id": tenant_id,
            "assigned_agent_id": agent["id"],
            "created_at": {"$gte": cutoff_date}
        })
        
        # Messages sent by this agent
        conversation_ids = await db.conversations.distinct("id", {"tenant_id": tenant_id})
        messages_sent = await db.messages.count_documents({
            "conversation_id": {"$in": conversation_ids},
            "author_id": agent["id"],
            "author_type": "agent"
        })
        
        # Transfers accepted
        transfers_accepted = await db.transfer_requests.count_documents({
            "tenant_id": tenant_id,
            "accepted_by": agent["id"]
        })
        
        agent_stats.append({
            "id": agent["id"],
            "name": agent.get("name", "Unknown"),
            "email": agent.get("email", ""),
            "avatar_url": agent.get("avatar_url"),
            "conversations_handled": conversations_handled,
            "messages_sent": messages_sent,
            "transfers_accepted": transfers_accepted,
            "is_available": agent.get("is_available", False)
        })
    
    # Sort by conversations handled
    agent_stats.sort(key=lambda x: x["conversations_handled"], reverse=True)
    
    return {"agents": agent_stats}

@router.get("/sentiment-summary")
async def get_sentiment_summary(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get sentiment analysis summary"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Get conversations with sentiment data
    conversations = await db.conversations.find({
        "tenant_id": tenant_id,
        "created_at": {"$gte": cutoff_date},
        "engagement_score": {"$exists": True}
    }, {"_id": 0, "engagement_score": 1, "tone_score": 1}).to_list(1000)
    
    if not conversations:
        return {
            "avg_engagement": 5,
            "avg_tone": 0,
            "sentiment_distribution": {
                "very_negative": 0,
                "negative": 0,
                "neutral": 0,
                "positive": 0,
                "very_positive": 0
            },
            "engagement_distribution": {
                "low": 0,
                "medium": 0,
                "high": 0
            }
        }
    
    # Calculate averages
    total_engagement = sum(c.get("engagement_score", 5) for c in conversations)
    total_tone = sum(c.get("tone_score", 0) for c in conversations)
    count = len(conversations)
    
    # Sentiment distribution
    sentiment_dist = {"very_negative": 0, "negative": 0, "neutral": 0, "positive": 0, "very_positive": 0}
    engagement_dist = {"low": 0, "medium": 0, "high": 0}
    
    for c in conversations:
        tone = c.get("tone_score", 0)
        engagement = c.get("engagement_score", 5)
        
        if tone < -50:
            sentiment_dist["very_negative"] += 1
        elif tone < -20:
            sentiment_dist["negative"] += 1
        elif tone <= 20:
            sentiment_dist["neutral"] += 1
        elif tone <= 50:
            sentiment_dist["positive"] += 1
        else:
            sentiment_dist["very_positive"] += 1
        
        if engagement <= 3:
            engagement_dist["low"] += 1
        elif engagement <= 6:
            engagement_dist["medium"] += 1
        else:
            engagement_dist["high"] += 1
    
    return {
        "avg_engagement": round(total_engagement / count, 1),
        "avg_tone": round(total_tone / count, 1),
        "sentiment_distribution": sentiment_dist,
        "engagement_distribution": engagement_dist,
        "total_analyzed": count
    }

