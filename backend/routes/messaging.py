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

# ============== DIRECT MESSAGES ==============

@router.post("/dm")
async def create_or_get_dm(
    participant_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Create or get existing DM conversation"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["id"]
    
    if participant_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot create DM with yourself")
    
    # Check if DM already exists
    existing = await db.messaging_dm_conversations.find_one({
        "tenant_id": tenant_id,
        "participants": {"$all": [user_id, participant_id]}
    }, {"_id": 0})
    
    if existing:
        return existing
    
    # Create new DM conversation
    dm = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "participants": [user_id, participant_id],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messaging_dm_conversations.insert_one(dm)
    dm.pop('_id', None)
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
        other_user_id = [p for p in dm["participants"] if p != user_id][0]
        other_user = await db.users.find_one(
            {"id": other_user_id},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "avatar_url": 1}
        )
        dm["other_user"] = other_user
        
        # Check if online
        dm["is_online"] = other_user_id in manager.get_online_users(tenant_id)
        
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
                
                # Send notification via WebSocket
                await manager.send_to_users(tenant_id, [mentioned_user_id], {
                    "type": "notification",
                    "payload": notification
                })
    
    return message

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
