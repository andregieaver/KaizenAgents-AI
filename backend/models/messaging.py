"""
Messaging system models for Slack-like instant messaging
"""
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime

# Channel Models
class ChannelCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_private: bool = False
    linked_customer_id: Optional[str] = None  # Link to CRM customer

class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_private: Optional[bool] = None
    linked_customer_id: Optional[str] = None

class ChannelResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: str
    name: str
    description: Optional[str] = None
    is_private: bool
    created_by: str
    created_by_name: Optional[str] = None
    members: List[str] = []
    member_details: Optional[List[dict]] = None
    linked_customer_id: Optional[str] = None
    linked_customer_name: Optional[str] = None
    unread_count: int = 0
    last_message: Optional[dict] = None
    created_at: str
    updated_at: str

# Message Models
class MessageCreate(BaseModel):
    content: str
    channel_id: Optional[str] = None  # For channel messages
    dm_conversation_id: Optional[str] = None  # For DMs
    parent_id: Optional[str] = None  # For thread replies
    attachments: Optional[List[dict]] = None  # File attachments
    mentions: Optional[List[str]] = None  # User IDs mentioned

class MessageUpdate(BaseModel):
    content: str

class ReactionAdd(BaseModel):
    emoji: str  # e.g., "👍", "❤️", "😂"

class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: str
    channel_id: Optional[str] = None
    dm_conversation_id: Optional[str] = None
    parent_id: Optional[str] = None
    content: str
    author_id: str
    author_name: str
    author_avatar: Optional[str] = None
    attachments: List[dict] = []
    mentions: List[str] = []
    reactions: Dict[str, List[str]] = {}  # emoji -> list of user IDs
    reply_count: int = 0
    is_edited: bool = False
    created_at: str
    updated_at: str

# Direct Message Models
class DMConversationCreate(BaseModel):
    participant_id: str  # The other user

class DMConversationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: str
    participants: List[str]
    participant_details: Optional[List[dict]] = None
    unread_count: int = 0
    last_message: Optional[dict] = None
    created_at: str
    updated_at: str

# WebSocket Message Types
class WSMessage(BaseModel):
    type: Literal[
        "message",
        "message_update", 
        "message_delete",
        "reaction_add",
        "reaction_remove",
        "typing",
        "presence",
        "channel_update",
        "notification"
    ]
    payload: Dict[str, Any]

# Typing Indicator
class TypingIndicator(BaseModel):
    channel_id: Optional[str] = None
    dm_conversation_id: Optional[str] = None
    user_id: str
    user_name: str
    is_typing: bool

# User Presence
class UserPresence(BaseModel):
    user_id: str
    status: Literal["online", "away", "offline"]
    last_seen: Optional[str] = None
