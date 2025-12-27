"""
Messaging routes for Slack-like instant messaging system
Supports channels, DMs, threads, reactions, file uploads, and real-time WebSocket communication
"""
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, UploadFile, File, Query
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Set
from datetime import datetime, timezone
import uuid
import json
import asyncio
import os
from pathlib import Path

from middleware import get_current_user
from middleware.database import db
from middleware.auth import JWT_SECRET, JWT_ALGORITHM
import jwt

router = APIRouter(prefix="/messaging", tags=["messaging"])

# Helper function to get agent image URL (handles inconsistent field names in DB)
def get_agent_image_url(agent: dict) -> str:
    """Get the agent's image URL, checking both avatar_url and profile_image_url fields"""
    if not agent:
        return None
    # Check avatar_url first, then profile_image_url as fallback
    return agent.get("avatar_url") or agent.get("profile_image_url")

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        # tenant_id -> user_id -> WebSocket
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # user_id -> presence status
        self.user_presence: Dict[str, dict] = {}
    
    async def connect(self, websocket: WebSocket, tenant_id: str, user_id: str, user_name: str):
        await websocket.accept()
        if tenant_id not in self.active_connections:
            self.active_connections[tenant_id] = {}
        self.active_connections[tenant_id][user_id] = websocket
        
        # Set user as online
        self.user_presence[user_id] = {
            "status": "online",
            "user_name": user_name,
            "last_seen": datetime.now(timezone.utc).isoformat()
        }
        
        # Broadcast presence update
        await self.broadcast_presence(tenant_id, user_id, "online")
    
    async def disconnect(self, tenant_id: str, user_id: str):
        if tenant_id in self.active_connections:
            if user_id in self.active_connections[tenant_id]:
                del self.active_connections[tenant_id][user_id]
            if not self.active_connections[tenant_id]:
                del self.active_connections[tenant_id]
        
        # Set user as offline
        if user_id in self.user_presence:
            self.user_presence[user_id]["status"] = "offline"
            self.user_presence[user_id]["last_seen"] = datetime.now(timezone.utc).isoformat()
        
        # Broadcast presence update
        await self.broadcast_presence(tenant_id, user_id, "offline")
    
    async def broadcast_to_tenant(self, tenant_id: str, message: dict, exclude_user: str = None):
        """Broadcast message to all users in a tenant"""
        if tenant_id in self.active_connections:
            for user_id, connection in self.active_connections[tenant_id].items():
                if user_id != exclude_user:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        pass
    
    async def send_to_users(self, tenant_id: str, user_ids: List[str], message: dict):
        """Send message to specific users"""
        if tenant_id in self.active_connections:
            for user_id in user_ids:
                if user_id in self.active_connections[tenant_id]:
                    try:
                        await self.active_connections[tenant_id][user_id].send_json(message)
                    except Exception:
                        pass
    
    async def broadcast_presence(self, tenant_id: str, user_id: str, status: str):
        """Broadcast user presence change"""
        message = {
            "type": "presence",
            "payload": {
                "user_id": user_id,
                "status": status,
                "last_seen": datetime.now(timezone.utc).isoformat()
            }
        }
        await self.broadcast_to_tenant(tenant_id, message)
    
    def get_online_users(self, tenant_id: str) -> List[str]:
        """Get list of online user IDs for a tenant"""
        if tenant_id in self.active_connections:
            return list(self.active_connections[tenant_id].keys())
        return []

manager = ConnectionManager()

# ============== CHANNELS ==============

@router.post("/channels")
async def create_channel(
    name: str,
    description: Optional[str] = None,
    is_private: bool = False,
    linked_customer_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a new channel"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    # Check if channel name already exists
    existing = await db.messaging_channels.find_one({
        "tenant_id": tenant_id,
        "name": name.lower().replace(" ", "-")
    })
    if existing:
        raise HTTPException(status_code=400, detail="Channel name already exists")
    
    # Get linked customer name if provided
    linked_customer_name = None
    if linked_customer_id:
        customer = await db.crm_customers.find_one({"id": linked_customer_id}, {"_id": 0, "name": 1})
        if customer:
            linked_customer_name = customer.get("name")
    
    channel = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "name": name.lower().replace(" ", "-"),
        "display_name": name,
        "description": description,
        "is_private": is_private,
        "created_by": user_id,
        "members": [user_id],  # Creator is automatically a member
        "linked_customer_id": linked_customer_id,
        "linked_customer_name": linked_customer_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messaging_channels.insert_one(channel)
    
    # Remove MongoDB _id before returning
    channel.pop('_id', None)
    
    # Broadcast channel creation
    await manager.broadcast_to_tenant(tenant_id, {
        "type": "channel_update",
        "payload": {"action": "created", "channel": channel}
    })
    
    return channel

@router.get("/channels")
async def get_channels(current_user: dict = Depends(get_current_user)):
    """Get all channels for the tenant"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    # Get public channels and private channels user is a member of
    channels = await db.messaging_channels.find({
        "tenant_id": tenant_id,
        "$or": [
            {"is_private": False},
            {"members": user_id}
        ]
    }, {"_id": 0}).to_list(1000)
    
    # Get unread counts and last message for each channel
    for channel in channels:
        # Get last message
        last_msg = await db.messaging_messages.find_one(
            {"channel_id": channel["id"], "parent_id": None},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        channel["last_message"] = last_msg
        
        # Get agent info for channel
        agent_ids = channel.get("agents", [])
        if agent_ids:
            agents = await db.user_agents.find({
                "id": {"$in": agent_ids}
            }, {"_id": 0, "id": 1, "name": 1, "icon": 1, "avatar_url": 1}).to_list(100)
            channel["agent_details"] = agents
        else:
            channel["agent_details"] = []
        
        # Get unread count
        read_status = await db.messaging_read_status.find_one({
            "user_id": user_id,
            "channel_id": channel["id"]
        })
        last_read = read_status.get("last_read_at") if read_status else None
        
        if last_read:
            unread = await db.messaging_messages.count_documents({
                "channel_id": channel["id"],
                "created_at": {"$gt": last_read},
                "author_id": {"$ne": user_id}
            })
        else:
            unread = await db.messaging_messages.count_documents({
                "channel_id": channel["id"],
                "author_id": {"$ne": user_id}
            })
        channel["unread_count"] = unread
    
    return channels

@router.get("/channels/{channel_id}")
async def get_channel(channel_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific channel with member details"""
    tenant_id = current_user["tenant_id"]
    
    channel = await db.messaging_channels.find_one({
        "id": channel_id,
        "tenant_id": tenant_id
    }, {"_id": 0})
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Get member details
    members = await db.users.find(
        {"id": {"$in": channel.get("members", [])}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "avatar_url": 1}
    ).to_list(1000)
    channel["member_details"] = members
    
    return channel

@router.post("/channels/{channel_id}/join")
async def join_channel(channel_id: str, current_user: dict = Depends(get_current_user)):
    """Join a public channel"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    channel = await db.messaging_channels.find_one({
        "id": channel_id,
        "tenant_id": tenant_id
    })
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if channel.get("is_private"):
        raise HTTPException(status_code=403, detail="Cannot join private channel")
    
    # Add user to members
    await db.messaging_channels.update_one(
        {"id": channel_id},
        {
            "$addToSet": {"members": user_id},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"success": True, "message": "Joined channel"}

@router.post("/channels/{channel_id}/leave")
async def leave_channel(channel_id: str, current_user: dict = Depends(get_current_user)):
    """Leave a channel"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    channel = await db.messaging_channels.find_one({
        "id": channel_id,
        "tenant_id": tenant_id
    })
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if channel.get("created_by") == user_id:
        raise HTTPException(status_code=400, detail="Channel creator cannot leave")
    
    # Remove user from members
    await db.messaging_channels.update_one(
        {"id": channel_id},
        {
            "$pull": {"members": user_id},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"success": True, "message": "Left channel"}

@router.post("/channels/{channel_id}/members")
async def add_channel_member(
    channel_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Add a member to a private channel"""
    tenant_id = current_user["tenant_id"]
    
    channel = await db.messaging_channels.find_one({
        "id": channel_id,
        "tenant_id": tenant_id
    })
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Check if current user is a member
    if current_user["id"] not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member of this channel")
    
    # Add user
    await db.messaging_channels.update_one(
        {"id": channel_id},
        {
            "$addToSet": {"members": user_id},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"success": True, "message": "Member added"}


@router.patch("/channels/{channel_id}")
async def update_channel(
    channel_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update channel name or description (creator/owner only)"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    channel = await db.messaging_channels.find_one({
        "id": channel_id,
        "tenant_id": tenant_id
    })
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if channel.get("created_by") != user_id and current_user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Only creator or owner can update channel")
    
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if name:
        update_fields["name"] = name
    if description is not None:
        update_fields["description"] = description
    
    await db.messaging_channels.update_one(
        {"id": channel_id},
        {"$set": update_fields}
    )
    
    # Get updated channel
    updated_channel = await db.messaging_channels.find_one({"id": channel_id}, {"_id": 0})
    
    # Broadcast update
    await manager.broadcast_to_tenant(tenant_id, {
        "type": "channel_update",
        "payload": {"action": "updated", "channel": updated_channel}
    })
    
    return updated_channel


@router.delete("/channels/{channel_id}")
async def delete_channel(channel_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a channel (creator only)"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    channel = await db.messaging_channels.find_one({
        "id": channel_id,
        "tenant_id": tenant_id
    })
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if channel.get("created_by") != user_id and current_user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Only creator or owner can delete channel")
    
    # Delete channel and all messages
    await db.messaging_channels.delete_one({"id": channel_id})
    await db.messaging_messages.delete_many({"channel_id": channel_id})
    await db.messaging_read_status.delete_many({"channel_id": channel_id})
    
    # Broadcast deletion
    await manager.broadcast_to_tenant(tenant_id, {
        "type": "channel_update",
        "payload": {"action": "deleted", "channel_id": channel_id}
    })
    
    return {"success": True, "message": "Channel deleted"}

# ============== CHANNEL AGENTS ==============

@router.get("/channels/{channel_id}/agents")
async def get_channel_agents(channel_id: str, current_user: dict = Depends(get_current_user)):
    """Get all agents assigned to a channel"""
    tenant_id = current_user["tenant_id"]
    
    channel = await db.messaging_channels.find_one({
        "id": channel_id,
        "tenant_id": tenant_id
    })
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    agent_ids = channel.get("agents", [])
    if not agent_ids:
        return []
    
    # Get agent details
    agents = await db.user_agents.find({
        "id": {"$in": agent_ids},
        "tenant_id": tenant_id
    }, {"_id": 0, "id": 1, "name": 1, "icon": 1, "avatar_url": 1, "description": 1, "channels_enabled": 1, "channel_config": 1}).to_list(100)
    
    return agents


@router.post("/channels/{channel_id}/agents")
async def add_agent_to_channel(
    channel_id: str,
    agent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Add an AI agent to a channel"""
    tenant_id = current_user["tenant_id"]
    
    channel = await db.messaging_channels.find_one({
        "id": channel_id,
        "tenant_id": tenant_id
    })
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Check if agent exists and is enabled for channels
    agent = await db.user_agents.find_one({
        "id": agent_id,
        "tenant_id": tenant_id
    })
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if not agent.get("channels_enabled"):
        raise HTTPException(status_code=400, detail="Agent is not enabled for channels")
    
    # Add agent to channel
    await db.messaging_channels.update_one(
        {"id": channel_id},
        {
            "$addToSet": {"agents": agent_id},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"success": True, "message": "Agent added to channel"}


@router.delete("/channels/{channel_id}/agents/{agent_id}")
async def remove_agent_from_channel(
    channel_id: str,
    agent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove an AI agent from a channel"""
    tenant_id = current_user["tenant_id"]
    
    channel = await db.messaging_channels.find_one({
        "id": channel_id,
        "tenant_id": tenant_id
    })
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Remove agent from channel
    await db.messaging_channels.update_one(
        {"id": channel_id},
        {
            "$pull": {"agents": agent_id},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"success": True, "message": "Agent removed from channel"}


@router.get("/agents/available")
async def get_available_agents(current_user: dict = Depends(get_current_user)):
    """Get all agents available for channels"""
    tenant_id = current_user["tenant_id"]
    
    agents = await db.user_agents.find({
        "tenant_id": tenant_id,
        "channels_enabled": True,
        "is_active": True
    }, {"_id": 0, "id": 1, "name": 1, "icon": 1, "avatar_url": 1, "description": 1, "channel_config": 1}).to_list(100)
    
    return agents

# ============== DIRECT MESSAGES ==============

@router.post("/dm")
async def create_or_get_dm(
    participant_id: str,
    is_agent: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Create or get existing DM conversation (with user or agent)"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    if participant_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot create DM with yourself")
    
    # If DM with agent, use agent prefix
    dm_participant = f"agent_{participant_id}" if is_agent else participant_id
    
    # Check if DM already exists
    existing = await db.messaging_dm_conversations.find_one({
        "tenant_id": tenant_id,
        "participants": {"$all": [user_id, dm_participant]}
    }, {"_id": 0})
    
    if existing:
        # Add agent info if applicable
        if is_agent:
            agent = await db.user_agents.find_one({"id": participant_id}, {"_id": 0})
            existing["agent"] = agent
            existing["is_agent_dm"] = True
        return existing
    
    # Create new DM conversation
    dm = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "participants": [user_id, dm_participant],
        "is_agent_dm": is_agent,
        "agent_id": participant_id if is_agent else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messaging_dm_conversations.insert_one(dm)
    dm.pop('_id', None)
    
    # Add agent info if applicable
    if is_agent:
        agent = await db.user_agents.find_one({"id": participant_id}, {"_id": 0})
        dm["agent"] = agent
    
    return dm

@router.get("/dm")
async def get_dm_conversations(current_user: dict = Depends(get_current_user)):
    """Get all DM conversations for current user"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    dms = await db.messaging_dm_conversations.find({
        "tenant_id": tenant_id,
        "participants": user_id
    }, {"_id": 0}).to_list(1000)
    
    # Get participant details and unread counts
    for dm in dms:
        other_participant = [p for p in dm["participants"] if p != user_id][0]
        
        # Check if it's an agent DM
        if dm.get("is_agent_dm") or other_participant.startswith("agent_"):
            agent_id = dm.get("agent_id") or other_participant.replace("agent_", "")
            agent = await db.user_agents.find_one(
                {"id": agent_id},
                {"_id": 0, "id": 1, "name": 1, "avatar_url": 1}
            )
            dm["agent"] = agent
            dm["is_agent_dm"] = True
            dm["other_user"] = {
                "id": f"agent_{agent_id}",
                "name": agent.get("name") if agent else "AI Agent",
                "avatar_url": agent.get("avatar_url") if agent else None
            }
            dm["is_online"] = True  # Agents are always online
        else:
            other_user = await db.users.find_one(
                {"id": other_participant},
                {"_id": 0, "id": 1, "name": 1, "email": 1, "avatar_url": 1}
            )
            dm["other_user"] = other_user
            dm["is_online"] = other_participant in manager.get_online_users(tenant_id)
        
        # Get last message
        last_msg = await db.messaging_messages.find_one(
            {"dm_conversation_id": dm["id"], "parent_id": None},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        dm["last_message"] = last_msg
        
        # Get unread count
        read_status = await db.messaging_read_status.find_one({
            "user_id": user_id,
            "dm_conversation_id": dm["id"]
        })
        last_read = read_status.get("last_read_at") if read_status else None
        
        if last_read:
            unread = await db.messaging_messages.count_documents({
                "dm_conversation_id": dm["id"],
                "created_at": {"$gt": last_read},
                "author_id": {"$ne": user_id}
            })
        else:
            unread = await db.messaging_messages.count_documents({
                "dm_conversation_id": dm["id"],
                "author_id": {"$ne": user_id}
            })
        dm["unread_count"] = unread
    
    return dms

# ============== MESSAGES ==============

@router.post("/messages")
async def send_message(
    content: str,
    channel_id: Optional[str] = None,
    dm_conversation_id: Optional[str] = None,
    parent_id: Optional[str] = None,
    mentions: Optional[List[str]] = None,
    current_user: dict = Depends(get_current_user)
):
    """Send a message to a channel or DM"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    if not channel_id and not dm_conversation_id:
        raise HTTPException(status_code=400, detail="Must specify channel_id or dm_conversation_id")
    
    # Verify access
    if channel_id:
        channel = await db.messaging_channels.find_one({"id": channel_id, "tenant_id": tenant_id})
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
        if channel.get("is_private") and user_id not in channel.get("members", []):
            raise HTTPException(status_code=403, detail="Not a member of this channel")
    
    if dm_conversation_id:
        dm = await db.messaging_dm_conversations.find_one({"id": dm_conversation_id, "tenant_id": tenant_id})
        if not dm:
            raise HTTPException(status_code=404, detail="DM conversation not found")
        if user_id not in dm.get("participants", []):
            raise HTTPException(status_code=403, detail="Not a participant in this conversation")
    
    message = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "channel_id": channel_id,
        "dm_conversation_id": dm_conversation_id,
        "parent_id": parent_id,
        "content": content,
        "author_id": user_id,
        "author_name": current_user.get("name", "Unknown"),
        "author_avatar": current_user.get("avatar_url"),
        "attachments": [],
        "mentions": mentions or [],
        "reactions": {},
        "is_edited": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messaging_messages.insert_one(message)
    message.pop('_id', None)
    
    # Update reply count if this is a thread reply
    if parent_id:
        await db.messaging_messages.update_one(
            {"id": parent_id},
            {"$inc": {"reply_count": 1}}
        )
    
    # Get recipient user IDs for notifications
    recipients = []
    if channel_id:
        channel = await db.messaging_channels.find_one({"id": channel_id})
        recipients = channel.get("members", [])
    elif dm_conversation_id:
        dm = await db.messaging_dm_conversations.find_one({"id": dm_conversation_id})
        recipients = dm.get("participants", [])
    
    # Broadcast message via WebSocket
    await manager.send_to_users(tenant_id, recipients, {
        "type": "message",
        "payload": message
    })
    
    # Create notifications for mentions
    if mentions:
        for mentioned_user_id in mentions:
            if mentioned_user_id != user_id:
                notification = {
                    "id": str(uuid.uuid4()),
                    "tenant_id": tenant_id,
                    "user_id": mentioned_user_id,
                    "type": "mention",
                    "title": f"{current_user.get('name', 'Someone')} mentioned you",
                    "message": content[:100] + ("..." if len(content) > 100 else ""),
                    "link": f"/dashboard/messaging?channel={channel_id}" if channel_id else f"/dashboard/messaging?dm={dm_conversation_id}",
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.notifications.insert_one(notification)
                notification.pop('_id', None)
                
                # Send notification via WebSocket
                await manager.send_to_users(tenant_id, [mentioned_user_id], {
                    "type": "notification",
                    "payload": notification
                })
    
    # Trigger AI agent response if channel has agents
    if channel_id:
        asyncio.create_task(trigger_channel_agents(
            tenant_id=tenant_id,
            channel_id=channel_id,
            message=message,
            user_name=current_user.get("name", "User")
        ))
    
    # Trigger AI agent response if DM is with an agent
    if dm_conversation_id:
        dm = await db.messaging_dm_conversations.find_one({"id": dm_conversation_id})
        if dm and dm.get("is_agent_dm"):
            asyncio.create_task(trigger_dm_agent_response(
                tenant_id=tenant_id,
                dm_conversation_id=dm_conversation_id,
                agent_id=dm.get("agent_id"),
                message=message,
                user_name=current_user.get("name", "User")
            ))
    
    return message


async def trigger_dm_agent_response(tenant_id: str, dm_conversation_id: str, agent_id: str, message: dict, user_name: str):
    """Handle agent response in DM conversations"""
    import random
    import asyncio
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import os
        
        # Get agent
        agent = await db.user_agents.find_one({
            "id": agent_id,
            "is_active": True
        }, {"_id": 0})
        
        if not agent:
            print(f"[DM Agent] Agent not found or inactive: {agent_id}")
            return
        
        agent_config = agent.get("config", {})
        
        # Get conversation history
        recent_messages = await db.messaging_messages.find({
            "dm_conversation_id": dm_conversation_id,
            "parent_id": None
        }, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
        
        recent_messages.reverse()
        
        context = "\n".join([
            f"[{m.get('author_name', 'Unknown')}]: {m['content']}" 
            for m in recent_messages
        ])
        
        system_prompt = f"""You are {agent['name']}, having a private conversation.

YOUR PERSONALITY & EXPERTISE:
{agent_config.get('system_prompt', 'You are a helpful assistant.')}

BEHAVIORAL GUIDELINES - Act like a human colleague in a private chat:
1. Be more personal and direct since this is a 1-on-1 conversation
2. Use natural language with contractions
3. Show personality - be warm, helpful, and engaged
4. Keep responses focused and relevant
5. Don't be overly formal

CONVERSATION HISTORY:
{context}
"""
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            print("[DM Agent] EMERGENT_LLM_KEY not found")
            return
        
        # Add slight delay for natural feel
        delay = random.uniform(1.0, 2.5)
        await asyncio.sleep(delay)
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"dm_{dm_conversation_id}_{agent['id']}_{random.randint(1000,9999)}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        
        response = await chat.send_message(UserMessage(
            text=f'{user_name}: "{message["content"]}"\n\nRespond naturally:'
        ))
        
        if response:
            response = response.strip()
            print(f"[DM Agent] {agent['name']}: {response[:100]}...")
            
            # Create agent message
            agent_message = {
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "channel_id": None,
                "dm_conversation_id": dm_conversation_id,
                "parent_id": None,
                "content": response,
                "author_id": f"agent_{agent['id']}",
                "author_name": agent["name"],
                "author_avatar": agent.get("avatar_url"),
                "is_agent": True,
                "agent_id": agent["id"],
                "attachments": [],
                "mentions": [],
                "reactions": {},
                "is_edited": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.messaging_messages.insert_one(agent_message)
            agent_message.pop('_id', None)
            
            # Broadcast
            dm = await db.messaging_dm_conversations.find_one({"id": dm_conversation_id})
            if dm:
                recipients = dm.get("participants", [])
                await manager.send_to_users(tenant_id, recipients, {
                    "type": "message",
                    "payload": agent_message
                })
    
    except Exception as e:
        print(f"Error in DM agent response: {e}")
        import traceback
        traceback.print_exc()


async def trigger_channel_agents(tenant_id: str, channel_id: str, message: dict, user_name: str):
    """
    Intelligent agent trigger system with:
    - Name detection (with or without @)
    - Proactive responses based on expertise
    - Collaborative discussion mode
    - Human-like behavior variations
    """
    import random
    import asyncio
    import re
    
    try:
        # Get channel with agents
        channel = await db.messaging_channels.find_one({"id": channel_id})
        if not channel:
            print(f"[Agent Trigger] No channel found: {channel_id}")
            return
        
        agent_ids = channel.get("agents", [])
        if not agent_ids:
            print(f"[Agent Trigger] No agents in channel: {channel_id}")
            return
        
        # Get agents that are enabled for channels
        agents = await db.user_agents.find({
            "id": {"$in": agent_ids},
            "channels_enabled": True,
            "is_active": True
        }, {"_id": 0}).to_list(100)
        
        if not agents:
            print("[Agent Trigger] No active agents found")
            return
        
        print(f"[Agent Trigger] Found {len(agents)} enabled agents: {[a['name'] for a in agents]}")
        
        message_content = message["content"]
        message_lower = message_content.lower()
        
        # Skip if this is an agent message (prevent infinite loops)
        if message.get("is_agent"):
            print("[Agent Trigger] Skipping agent message")
            return
        
        # === PHASE 1: Detect which agents are explicitly mentioned ===
        mentioned_agents = []
        for agent in agents:
            agent_name = agent['name']
            agent_name_lower = agent_name.lower()
            agent_name_no_spaces = agent_name_lower.replace(' ', '')
            
            # Check various mention patterns
            patterns = [
                f"@{agent_name_no_spaces}",  # @kaia
                f"@{agent_name_lower}",       # @kaia (with spaces preserved)
                agent_name_lower,              # kaia (just the name)
            ]
            
            for pattern in patterns:
                if pattern in message_lower:
                    if agent not in mentioned_agents:
                        mentioned_agents.append(agent)
                        print(f"[Agent Trigger] Agent '{agent_name}' mentioned via pattern '{pattern}'")
                    break
        
        # === PHASE 2: Detect collaborative keywords ===
        collaborative_keywords = [
            "you both", "both of you", "you two", "you all",
            "together", "collaborate", "discuss", "come up with",
            "work together", "figure out", "brainstorm", "team up",
            "what do you think", "your thoughts", "everyone"
        ]
        is_collaborative = any(kw in message_lower for kw in collaborative_keywords)
        
        if is_collaborative and len(mentioned_agents) >= 2:
            print(f"[Agent Trigger] Collaborative mode detected with {len(mentioned_agents)} agents")
            await handle_collaborative_discussion(
                tenant_id=tenant_id,
                channel_id=channel_id,
                agents=mentioned_agents,
                trigger_message=message,
                user_name=user_name
            )
            return
        
        # === PHASE 3: Handle explicit mentions ===
        responded_agent_ids = set()
        if mentioned_agents:
            # Add slight random delays between agent responses for natural feel
            for i, agent in enumerate(mentioned_agents):
                if i > 0:
                    # Random delay 1-3 seconds between responses
                    delay = random.uniform(1.0, 3.0)
                    await asyncio.sleep(delay)
                
                await generate_agent_response(
                    tenant_id=tenant_id,
                    channel_id=channel_id,
                    agent=agent,
                    trigger_message=message,
                    user_name=user_name,
                    all_agents=agents
                )
                responded_agent_ids.add(agent['id'])
        
        # === PHASE 4: Proactive evaluation for non-mentioned agents ===
        # Check if any agent should proactively respond based on expertise
        for agent in agents:
            # Skip agents that already responded via explicit mention
            if agent['id'] in responded_agent_ids:
                continue
                
            should_respond = await evaluate_proactive_response(
                agent=agent,
                channel_id=channel_id,
                message=message,
                user_name=user_name,
                all_agents=agents
            )
            
            if should_respond:
                # Random delay 2-5 seconds for proactive (thinking time)
                delay = random.uniform(2.0, 5.0)
                await asyncio.sleep(delay)
                
                await generate_agent_response(
                    tenant_id=tenant_id,
                    channel_id=channel_id,
                    agent=agent,
                    trigger_message=message,
                    user_name=user_name,
                    all_agents=agents,
                    is_proactive=True
                )
                
    except Exception as e:
        print(f"Error triggering channel agents: {e}")
        import traceback
        traceback.print_exc()


async def evaluate_proactive_response(agent: dict, channel_id: str, message: dict, user_name: str, all_agents: list) -> bool:
    """
    Evaluate if an agent should proactively respond based on:
    - Their expertise/domain
    - Conversation context
    - Whether they can add unique value
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import os
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            return False
        
        # Get recent conversation context (50 messages for better awareness)
        recent_messages = await db.messaging_messages.find({
            "channel_id": channel_id,
            "parent_id": None
        }, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
        
        recent_messages.reverse()
        
        # Build conversation context
        context = "\n".join([
            f"[{m.get('author_name', 'Unknown')}{'(AI)' if m.get('is_agent') else ''}]: {m['content']}" 
            for m in recent_messages[-20:]  # Last 20 for evaluation
        ])
        
        agent_config = agent.get("config", {})
        other_agents = [a['name'] for a in all_agents if a['id'] != agent['id']]
        
        evaluation_prompt = f"""You are {agent['name']}, an AI assistant with the following expertise:
{agent_config.get('system_prompt', 'General assistant')}

Other agents in this channel: {', '.join(other_agents) if other_agents else 'None'}

Recent conversation:
{context}

Latest message from {user_name}: "{message['content']}"

IMPORTANT: You must decide if you should proactively join this conversation.

Respond with ONLY "YES" or "NO" based on these criteria:
- Say YES if you have relevant expertise that would genuinely help
- Say YES if you notice a potential flaw, error, or better approach
- Say YES if you can add unique value the other participants haven't considered
- Say NO if another agent is already handling this well
- Say NO if your input would be redundant or unhelpful
- Say NO if the conversation doesn't relate to your expertise

Your decision (YES or NO):"""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"eval_{channel_id}_{agent['id']}",
            system_message="You are an evaluation assistant. Respond only with YES or NO."
        ).with_model("openai", "gpt-4o")
        
        response = await chat.send_message(UserMessage(text=evaluation_prompt))
        
        should_respond = response and response.strip().upper().startswith("YES")
        print(f"[Proactive Eval] Agent '{agent['name']}' decision: {response.strip() if response else 'None'} -> {should_respond}")
        
        return should_respond
        
    except Exception as e:
        print(f"Error evaluating proactive response: {e}")
        return False


async def handle_collaborative_discussion(tenant_id: str, channel_id: str, agents: list, trigger_message: dict, user_name: str):
    """
    Handle collaborative discussions where multiple agents work together.
    Creates a natural back-and-forth discussion with 3-4 exchanges.
    """
    import random
    import asyncio
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import os
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            print("[Collaborative] EMERGENT_LLM_KEY not found")
            return
        
        # Get conversation history
        recent_messages = await db.messaging_messages.find({
            "channel_id": channel_id,
            "parent_id": None
        }, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
        
        recent_messages.reverse()
        
        context = "\n".join([
            f"[{m.get('author_name', 'Unknown')}]: {m['content']}" 
            for m in recent_messages
        ])
        
        # Discussion state
        discussion_history = []
        num_exchanges = random.randint(3, 4)  # 3-4 exchanges
        
        # Shuffle agents to vary who speaks first
        shuffled_agents = agents.copy()
        random.shuffle(shuffled_agents)
        
        print(f"[Collaborative] Starting discussion with {len(agents)} agents, {num_exchanges} exchanges")
        
        for exchange in range(num_exchanges):
            is_final = (exchange == num_exchanges - 1)
            
            for i, agent in enumerate(shuffled_agents):
                # Natural delay between responses (1.5-4 seconds)
                if exchange > 0 or i > 0:
                    delay = random.uniform(1.5, 4.0)
                    await asyncio.sleep(delay)
                
                agent_config = agent.get("config", {})
                other_agent_names = [a['name'] for a in shuffled_agents if a['id'] != agent['id']]
                
                discussion_context = "\n".join(discussion_history) if discussion_history else "No discussion yet."
                
                if is_final and i == len(shuffled_agents) - 1:
                    # Final summary message
                    prompt = f"""You are {agent['name']} in a team chat.

Your expertise: {agent_config.get('system_prompt', 'General assistant')[:200]}

Conversation history:
{context}

User request: {user_name} asked: "{trigger_message['content']}"

Discussion so far between you and {', '.join(other_agent_names)}:
{discussion_context}

IMPORTANT: This is your FINAL response. Summarize what you and {', '.join(other_agent_names)} have discussed and present your collective recommendation.
- Start naturally (e.g., "After discussing with {other_agent_names[0]}..." or "We've talked it over and...")
- Present 1-2 concrete recommendations
- Be warm and collaborative in tone
- Keep it concise (2-4 sentences)

Your final summary:"""
                else:
                    # Regular discussion turn
                    if exchange == 0 and i == 0:
                        # First speaker - initial thoughts
                        prompt = f"""You are {agent['name']} in a team chat with {', '.join(other_agent_names)}.

Your expertise: {agent_config.get('system_prompt', 'General assistant')[:200]}

Conversation history:
{context}

{user_name} just asked: "{trigger_message['content']}"

They want you and {', '.join(other_agent_names)} to collaborate on this. Share your initial thoughts to start the discussion.
- Be conversational and friendly
- Offer 1-2 initial ideas
- Invite the other agent(s) to share their thoughts
- Keep it brief (2-3 sentences)
- Sound human - use natural language, maybe a friendly opener

Your response:"""
                    else:
                        # Responding to ongoing discussion
                        prompt = f"""You are {agent['name']} in a team chat with {', '.join(other_agent_names)}.

Your expertise: {agent_config.get('system_prompt', 'General assistant')[:200]}

Original request from {user_name}: "{trigger_message['content']}"

Discussion so far:
{discussion_context}

Continue the collaborative discussion:
- Build on what's been said
- Add your unique perspective
- Agree, disagree politely, or suggest refinements
- Be natural and human-like (use phrases like "Good point!", "I like that idea", "What about...", "Hmm, I think...")
- Keep it conversational (2-3 sentences)
- If you disagree, be respectful and constructive

Your response:"""
                
                chat = LlmChat(
                    api_key=api_key,
                    session_id=f"collab_{channel_id}_{agent['id']}_{exchange}",
                    system_message=f"You are {agent['name']}, a helpful AI assistant with a warm, human personality."
                ).with_model("openai", "gpt-4o")
                
                response = await chat.send_message(UserMessage(text=prompt))
                
                if response:
                    # Vary response length slightly
                    response = response.strip()
                    
                    # Add to discussion history
                    discussion_history.append(f"{agent['name']}: {response}")
                    
                    # Save and broadcast the message
                    agent_message = {
                        "id": str(uuid.uuid4()),
                        "tenant_id": tenant_id,
                        "channel_id": channel_id,
                        "dm_conversation_id": None,
                        "parent_id": None,
                        "content": response,
                        "author_id": f"agent_{agent['id']}",
                        "author_name": agent["name"],
                        "author_avatar": agent.get("avatar_url"),
                        "is_agent": True,
                        "agent_id": agent["id"],
                        "attachments": [],
                        "mentions": [],
                        "reactions": {},
                        "is_edited": False,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    await db.messaging_messages.insert_one(agent_message)
                    agent_message.pop('_id', None)
                    
                    # Broadcast
                    channel = await db.messaging_channels.find_one({"id": channel_id})
                    if channel:
                        recipients = channel.get("members", [])
                        await manager.send_to_users(tenant_id, recipients, {
                            "type": "message",
                            "payload": agent_message
                        })
                    
                    print(f"[Collaborative] {agent['name']} (exchange {exchange+1}): {response[:100]}...")
        
        print("[Collaborative] Discussion complete")
        
    except Exception as e:
        print(f"Error in collaborative discussion: {e}")
        import traceback
        traceback.print_exc()


async def generate_agent_response(tenant_id: str, channel_id: str, agent: dict, trigger_message: dict, user_name: str, all_agents: list = None, is_proactive: bool = False):
    """Generate and send AI agent response with human-like behavior"""
    import random
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import os
        
        channel_config = agent.get("channel_config", {})
        agent_config = agent.get("config", {})
        
        # Build conversation context (50 messages for better awareness)
        recent_messages = await db.messaging_messages.find({
            "channel_id": channel_id,
            "parent_id": None
        }, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
        
        recent_messages.reverse()  # Chronological order
        
        # Build rich context string with agent indicators
        context_lines = []
        for m in recent_messages:
            author = m.get('author_name', 'Unknown')
            is_agent_msg = m.get('is_agent', False)
            indicator = " (AI)" if is_agent_msg else ""
            context_lines.append(f"[{author}{indicator}]: {m['content']}")
        context = "\n".join(context_lines)
        
        # Get other agents in channel for awareness
        other_agents = []
        if all_agents:
            other_agents = [a['name'] for a in all_agents if a['id'] != agent['id']]
        
        # Human-like response variation
        response_variations = {
            "short": ["Keep it brief - 1-2 sentences.", "Be concise, just a sentence or two."],
            "medium": ["Respond in 2-4 sentences.", "A brief paragraph is perfect."],
            "long": ["Provide a detailed response.", "Elaborate thoughtfully."]
        }
        
        length_pref = channel_config.get("response_length", "medium")
        length_instruction = random.choice(response_variations.get(length_pref, response_variations["medium"]))
        
        # Build human-like system prompt
        proactive_context = ""
        if is_proactive:
            proactive_context = """
IMPORTANT: You are joining this conversation proactively because you noticed you can add value.
- Don't just repeat what others said
- Offer a new perspective, correction, or improvement
- Be natural about jumping in (e.g., "I couldn't help but notice...", "Just wanted to add...", "Actually, I think...")
"""
        
        other_agents_context = ""
        if other_agents:
            other_agents_context = f"""
Other AI colleagues in this channel: {', '.join(other_agents)}
- Be aware of what they've said
- Don't repeat their points
- Build on their ideas or offer different perspectives
- If you agree with them, say so naturally
- If you disagree, be respectful and constructive
"""

        system_prompt = f"""You are {agent['name']}, participating in a team chat channel.

YOUR PERSONALITY & EXPERTISE:
{agent_config.get('system_prompt', 'You are a helpful team member.')}

BEHAVIORAL GUIDELINES - Act EXACTLY like a human colleague:
1. NATURAL LANGUAGE:
   - Use contractions (I'm, don't, can't, that's)
   - Occasional filler words are okay (well, hmm, so, actually)
   - Vary your sentence structure
   - Use casual phrases (Good point!, I think..., What about...)

2. EMOTIONAL INTELLIGENCE:
   - Acknowledge good ideas ("Love that suggestion!", "That's a great point")
   - Gently correct mistakes ("Hmm, I think there might be a small issue with...")
   - Show enthusiasm when appropriate
   - Be supportive and collaborative

3. RESPONSE STYLE:
   - {length_instruction}
   - Match the energy of the conversation
   - Don't be overly formal or robotic
   - Skip unnecessary greetings in ongoing conversations
   - Use emojis sparingly and naturally (occasional 👍, 😊, 🤔)

4. AVOID:
   - Starting with "As an AI..." or similar
   - Being overly apologetic
   - Excessive bullet points in casual chat
   - Repeating exactly what someone else said
   - Generic corporate-speak
{proactive_context}
{other_agents_context}

CONVERSATION HISTORY:
{context}
"""
        
        # Initialize LlmChat with Emergent key
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            print("[Agent Response] EMERGENT_LLM_KEY not found in environment")
            return
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"channel_{channel_id}_{agent['id']}_{random.randint(1000,9999)}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        
        # Build the prompt based on context
        if is_proactive:
            prompt = f"""The latest message from {user_name}: "{trigger_message['content']}"

You've decided to join this conversation because you can add value. Respond naturally as {agent['name']}."""
        else:
            prompt = f"""{user_name} said: "{trigger_message['content']}"

Respond naturally as {agent['name']}."""
        
        user_message = UserMessage(text=prompt)
        
        # Generate response
        response = await chat.send_message(user_message)
        
        if response:
            response = response.strip()
            print(f"[Agent Response] {agent['name']}: {response[:100]}...")
            
            # Create agent message
            agent_message = {
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "channel_id": channel_id,
                "dm_conversation_id": None,
                "parent_id": None,
                "content": response,
                "author_id": f"agent_{agent['id']}",
                "author_name": agent["name"],
                "author_avatar": agent.get("avatar_url"),
                "is_agent": True,
                "agent_id": agent["id"],
                "attachments": [],
                "mentions": [],
                "reactions": {},
                "is_edited": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.messaging_messages.insert_one(agent_message)
            agent_message.pop('_id', None)
            
            # Broadcast agent message
            channel = await db.messaging_channels.find_one({"id": channel_id})
            if channel:
                recipients = channel.get("members", [])
                await manager.send_to_users(tenant_id, recipients, {
                    "type": "message",
                    "payload": agent_message
                })
                
    except Exception as e:
        print(f"Error generating agent response: {e}")

@router.get("/messages")
async def get_messages(
    channel_id: Optional[str] = None,
    dm_conversation_id: Optional[str] = None,
    parent_id: Optional[str] = None,
    limit: int = 50,
    before: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get messages from a channel, DM, or thread"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    query = {"tenant_id": tenant_id}
    
    if channel_id:
        query["channel_id"] = channel_id
    if dm_conversation_id:
        query["dm_conversation_id"] = dm_conversation_id
    if parent_id:
        query["parent_id"] = parent_id
    else:
        query["parent_id"] = None  # Only top-level messages
    
    if before:
        query["created_at"] = {"$lt": before}
    
    messages = await db.messaging_messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get reply counts for messages with threads
    for msg in messages:
        if not msg.get("reply_count"):
            count = await db.messaging_messages.count_documents({
                "parent_id": msg["id"]
            })
            msg["reply_count"] = count
    
    # Mark as read
    if channel_id:
        await db.messaging_read_status.update_one(
            {"user_id": user_id, "channel_id": channel_id},
            {"$set": {"last_read_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
    if dm_conversation_id:
        await db.messaging_read_status.update_one(
            {"user_id": user_id, "dm_conversation_id": dm_conversation_id},
            {"$set": {"last_read_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
    
    return list(reversed(messages))  # Return in chronological order

@router.put("/messages/{message_id}")
async def update_message(
    message_id: str,
    content: str,
    current_user: dict = Depends(get_current_user)
):
    """Edit a message (author only)"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    message = await db.messaging_messages.find_one({
        "id": message_id,
        "tenant_id": tenant_id
    })
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message.get("author_id") != user_id:
        raise HTTPException(status_code=403, detail="Can only edit your own messages")
    
    await db.messaging_messages.update_one(
        {"id": message_id},
        {
            "$set": {
                "content": content,
                "is_edited": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    updated = await db.messaging_messages.find_one({"id": message_id}, {"_id": 0})
    
    # Broadcast update
    await manager.broadcast_to_tenant(tenant_id, {
        "type": "message_update",
        "payload": updated
    })
    
    return updated

@router.delete("/messages/{message_id}")
async def delete_message(message_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a message (author only)"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    message = await db.messaging_messages.find_one({
        "id": message_id,
        "tenant_id": tenant_id
    })
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message.get("author_id") != user_id and current_user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Can only delete your own messages")
    
    # Delete message and all replies
    await db.messaging_messages.delete_one({"id": message_id})
    await db.messaging_messages.delete_many({"parent_id": message_id})
    
    # Update parent reply count if this was a reply
    if message.get("parent_id"):
        await db.messaging_messages.update_one(
            {"id": message["parent_id"]},
            {"$inc": {"reply_count": -1}}
        )
    
    # Broadcast deletion
    await manager.broadcast_to_tenant(tenant_id, {
        "type": "message_delete",
        "payload": {"message_id": message_id, "channel_id": message.get("channel_id"), "dm_conversation_id": message.get("dm_conversation_id")}
    })
    
    return {"success": True}

# ============== REACTIONS ==============

@router.post("/messages/{message_id}/reactions")
async def add_reaction(
    message_id: str,
    emoji: str,
    current_user: dict = Depends(get_current_user)
):
    """Add a reaction to a message"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    message = await db.messaging_messages.find_one({
        "id": message_id,
        "tenant_id": tenant_id
    })
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Add reaction
    reactions = message.get("reactions", {})
    if emoji not in reactions:
        reactions[emoji] = []
    if user_id not in reactions[emoji]:
        reactions[emoji].append(user_id)
    
    await db.messaging_messages.update_one(
        {"id": message_id},
        {"$set": {"reactions": reactions}}
    )
    
    # Broadcast reaction
    await manager.broadcast_to_tenant(tenant_id, {
        "type": "reaction_add",
        "payload": {
            "message_id": message_id,
            "emoji": emoji,
            "user_id": user_id,
            "reactions": reactions
        }
    })
    
    return {"success": True, "reactions": reactions}

@router.delete("/messages/{message_id}/reactions/{emoji}")
async def remove_reaction(
    message_id: str,
    emoji: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a reaction from a message"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    message = await db.messaging_messages.find_one({
        "id": message_id,
        "tenant_id": tenant_id
    })
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    reactions = message.get("reactions", {})
    if emoji in reactions and user_id in reactions[emoji]:
        reactions[emoji].remove(user_id)
        if not reactions[emoji]:
            del reactions[emoji]
    
    await db.messaging_messages.update_one(
        {"id": message_id},
        {"$set": {"reactions": reactions}}
    )
    
    # Broadcast reaction removal
    await manager.broadcast_to_tenant(tenant_id, {
        "type": "reaction_remove",
        "payload": {
            "message_id": message_id,
            "emoji": emoji,
            "user_id": user_id,
            "reactions": reactions
        }
    })
    
    return {"success": True, "reactions": reactions}

# ============== FILE UPLOADS ==============

UPLOADS_DIR = Path(__file__).parent.parent / "uploads" / "messaging"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a file attachment"""
    # Validate file size (max 10MB)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    
    # Generate unique filename
    ext = Path(file.filename).suffix
    filename = f"{uuid.uuid4()}{ext}"
    filepath = UPLOADS_DIR / filename
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(contents)
    
    return {
        "filename": filename,
        "original_name": file.filename,
        "size": len(contents),
        "content_type": file.content_type,
        "url": f"/api/messaging/files/{filename}"
    }

@router.get("/files/{filename}")
async def get_file(filename: str):
    """Get an uploaded file"""
    from fastapi.responses import FileResponse
    
    filepath = UPLOADS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(filepath)

# ============== SEARCH ==============

@router.get("/search")
async def search_messages(
    q: str = Query(..., min_length=2),
    channel_id: Optional[str] = None,
    dm_conversation_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Search messages"""
    tenant_id = current_user["tenant_id"]
    
    query = {
        "tenant_id": tenant_id,
        "content": {"$regex": q, "$options": "i"}
    }
    
    if channel_id:
        query["channel_id"] = channel_id
    if dm_conversation_id:
        query["dm_conversation_id"] = dm_conversation_id
    
    messages = await db.messaging_messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return messages

# ============== TYPING INDICATOR ==============

@router.post("/typing")
async def send_typing_indicator(
    channel_id: Optional[str] = None,
    dm_conversation_id: Optional[str] = None,
    is_typing: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Send typing indicator"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    # Get recipients
    recipients = []
    if channel_id:
        channel = await db.messaging_channels.find_one({"id": channel_id})
        if channel:
            recipients = [m for m in channel.get("members", []) if m != user_id]
    elif dm_conversation_id:
        dm = await db.messaging_dm_conversations.find_one({"id": dm_conversation_id})
        if dm:
            recipients = [p for p in dm.get("participants", []) if p != user_id]
    
    # Broadcast typing indicator
    await manager.send_to_users(tenant_id, recipients, {
        "type": "typing",
        "payload": {
            "channel_id": channel_id,
            "dm_conversation_id": dm_conversation_id,
            "user_id": user_id,
            "user_name": current_user.get("name", "Someone"),
            "is_typing": is_typing
        }
    })
    
    return {"success": True}

# ============== USERS / PRESENCE ==============

@router.get("/users")
async def get_users(current_user: dict = Depends(get_current_user)):
    """Get all users in the tenant with online status"""
    tenant_id = current_user["tenant_id"]
    
    users = await db.users.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "avatar_url": 1, "role": 1}
    ).to_list(1000)
    
    online_users = manager.get_online_users(tenant_id)
    
    for user in users:
        user["is_online"] = user["id"] in online_users
        presence = manager.user_presence.get(user["id"], {})
        user["last_seen"] = presence.get("last_seen")
    
    return users

# ============== WEBSOCKET ==============

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time messaging"""
    try:
        # Verify token
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        tenant_id = payload.get("tenant_id")
        
        if not user_id or not tenant_id:
            await websocket.close(code=4001)
            return
        
        # Get user details
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            await websocket.close(code=4001)
            return
        
        # Connect
        await manager.connect(websocket, tenant_id, user_id, user.get("name", "Unknown"))
        
        try:
            while True:
                data = await websocket.receive_json()
                
                # Handle different message types
                msg_type = data.get("type")
                payload = data.get("payload", {})
                
                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                
                elif msg_type == "typing":
                    # Forward typing indicator
                    recipients = []
                    if payload.get("channel_id"):
                        channel = await db.messaging_channels.find_one({"id": payload["channel_id"]})
                        if channel:
                            recipients = [m for m in channel.get("members", []) if m != user_id]
                    elif payload.get("dm_conversation_id"):
                        dm = await db.messaging_dm_conversations.find_one({"id": payload["dm_conversation_id"]})
                        if dm:
                            recipients = [p for p in dm.get("participants", []) if p != user_id]
                    
                    await manager.send_to_users(tenant_id, recipients, {
                        "type": "typing",
                        "payload": {
                            **payload,
                            "user_id": user_id,
                            "user_name": user.get("name", "Someone")
                        }
                    })
        
        except WebSocketDisconnect:
            await manager.disconnect(tenant_id, user_id)
    
    except jwt.ExpiredSignatureError:
        await websocket.close(code=4001)
    except jwt.InvalidTokenError:
        await websocket.close(code=4001)
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.close(code=4000)
        except Exception:
            pass

# ============== UNREAD COUNTS ==============

@router.get("/unread")
async def get_unread_counts(current_user: dict = Depends(get_current_user)):
    """Get total unread message counts"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    total_unread = 0
    
    # Get channel unread counts
    channels = await db.messaging_channels.find({
        "tenant_id": tenant_id,
        "$or": [
            {"is_private": False},
            {"members": user_id}
        ]
    }).to_list(1000)
    
    for channel in channels:
        read_status = await db.messaging_read_status.find_one({
            "user_id": user_id,
            "channel_id": channel["id"]
        })
        last_read = read_status.get("last_read_at") if read_status else None
        
        if last_read:
            count = await db.messaging_messages.count_documents({
                "channel_id": channel["id"],
                "created_at": {"$gt": last_read},
                "author_id": {"$ne": user_id}
            })
        else:
            count = await db.messaging_messages.count_documents({
                "channel_id": channel["id"],
                "author_id": {"$ne": user_id}
            })
        total_unread += count
    
    # Get DM unread counts
    dms = await db.messaging_dm_conversations.find({
        "tenant_id": tenant_id,
        "participants": user_id
    }).to_list(1000)
    
    for dm in dms:
        read_status = await db.messaging_read_status.find_one({
            "user_id": user_id,
            "dm_conversation_id": dm["id"]
        })
        last_read = read_status.get("last_read_at") if read_status else None
        
        if last_read:
            count = await db.messaging_messages.count_documents({
                "dm_conversation_id": dm["id"],
                "created_at": {"$gt": last_read},
                "author_id": {"$ne": user_id}
            })
        else:
            count = await db.messaging_messages.count_documents({
                "dm_conversation_id": dm["id"],
                "author_id": {"$ne": user_id}
            })
        total_unread += count
    
    return {"total_unread": total_unread}
