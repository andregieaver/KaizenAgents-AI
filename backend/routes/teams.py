"""
Teams management routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from middleware import get_current_user
from middleware.database import db

router = APIRouter(prefix="/teams", tags=["teams"])

# Models
class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#6366f1"  # Default indigo color

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    agent_id: Optional[str] = None  # Associated AI agent

class TeamResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    tenant_id: str
    name: str
    description: Optional[str]
    color: str
    agent_id: Optional[str]
    agent_name: Optional[str]
    member_count: int
    created_at: str
    updated_at: str

class TeamMemberAdd(BaseModel):
    user_id: str

class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    team_id: str
    user_name: str
    user_email: str
    user_role: str
    joined_at: str

# Team CRUD
@router.post("", response_model=TeamResponse)
async def create_team(
    team_data: TeamCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new team"""
    # Check permission
    if current_user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owners and admins can create teams")
    
    tenant_id = current_user.get("tenant_id")
    now = datetime.now(timezone.utc).isoformat()
    team_id = str(uuid.uuid4())
    
    team = {
        "id": team_id,
        "tenant_id": tenant_id,
        "name": team_data.name,
        "description": team_data.description,
        "color": team_data.color,
        "agent_id": None,
        "agent_name": None,
        "member_count": 0,
        "created_at": now,
        "updated_at": now
    }
    
    await db.teams.insert_one(team)
    return team

@router.get("", response_model=List[TeamResponse])
async def get_teams(current_user: dict = Depends(get_current_user)):
    """Get all teams for the tenant"""
    tenant_id = current_user.get("tenant_id")
    
    teams = await db.teams.find(
        {"tenant_id": tenant_id},
        {"_id": 0}
    ).sort("name", 1).to_list(100)
    
    # Get member counts
    for team in teams:
        count = await db.team_members.count_documents({"team_id": team["id"]})
        team["member_count"] = count
    
    return teams

@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(team_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific team"""
    tenant_id = current_user.get("tenant_id")
    
    team = await db.teams.find_one(
        {"id": team_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get member count
    team["member_count"] = await db.team_members.count_documents({"team_id": team_id})
    
    return team

@router.patch("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: str,
    team_data: TeamUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a team"""
    if current_user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owners and admins can update teams")
    
    tenant_id = current_user.get("tenant_id")
    
    team = await db.teams.find_one({"id": team_id, "tenant_id": tenant_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    update_data = {k: v for k, v in team_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # If agent_id is being set, get the agent name
    if "agent_id" in update_data and update_data["agent_id"]:
        agent = await db.user_agents.find_one({"id": update_data["agent_id"]}, {"_id": 0})
        if agent:
            update_data["agent_name"] = agent.get("name")
        else:
            # Check agent_templates too
            template = await db.agent_templates.find_one({"id": update_data["agent_id"]}, {"_id": 0})
            if template:
                update_data["agent_name"] = template.get("name")
    elif "agent_id" in update_data and update_data["agent_id"] is None:
        update_data["agent_name"] = None
    
    await db.teams.update_one(
        {"id": team_id},
        {"$set": update_data}
    )
    
    updated = await db.teams.find_one({"id": team_id}, {"_id": 0})
    updated["member_count"] = await db.team_members.count_documents({"team_id": team_id})
    
    return updated

@router.delete("/{team_id}")
async def delete_team(team_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a team"""
    if current_user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owners and admins can delete teams")
    
    tenant_id = current_user.get("tenant_id")
    
    team = await db.teams.find_one({"id": team_id, "tenant_id": tenant_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Delete team members first
    await db.team_members.delete_many({"team_id": team_id})
    
    # Delete the team
    await db.teams.delete_one({"id": team_id})
    
    return {"message": "Team deleted successfully"}

# Team Members
@router.get("/{team_id}/members", response_model=List[TeamMemberResponse])
async def get_team_members(team_id: str, current_user: dict = Depends(get_current_user)):
    """Get all members of a team"""
    tenant_id = current_user.get("tenant_id")
    
    # Verify team exists and belongs to tenant
    team = await db.teams.find_one({"id": team_id, "tenant_id": tenant_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    members = await db.team_members.find(
        {"team_id": team_id},
        {"_id": 0}
    ).to_list(100)
    
    # Enrich with user data
    for member in members:
        user = await db.users.find_one({"id": member["user_id"]}, {"_id": 0})
        if user:
            member["user_name"] = user.get("name", "Unknown")
            member["user_email"] = user.get("email", "")
            member["user_role"] = user.get("role", "agent")
    
    return members

@router.post("/{team_id}/members", response_model=TeamMemberResponse)
async def add_team_member(
    team_id: str,
    member_data: TeamMemberAdd,
    current_user: dict = Depends(get_current_user)
):
    """Add a member to a team"""
    if current_user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owners and admins can add team members")
    
    tenant_id = current_user.get("tenant_id")
    
    # Verify team exists
    team = await db.teams.find_one({"id": team_id, "tenant_id": tenant_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Verify user exists and belongs to tenant
    user = await db.users.find_one(
        {"id": member_data.user_id, "tenant_id": tenant_id},
        {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already a member
    existing = await db.team_members.find_one({
        "team_id": team_id,
        "user_id": member_data.user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this team")
    
    now = datetime.now(timezone.utc).isoformat()
    member = {
        "id": str(uuid.uuid4()),
        "team_id": team_id,
        "user_id": member_data.user_id,
        "user_name": user.get("name", "Unknown"),
        "user_email": user.get("email", ""),
        "user_role": user.get("role", "agent"),
        "joined_at": now
    }
    
    await db.team_members.insert_one(member)
    
    # Update member count
    await db.teams.update_one(
        {"id": team_id},
        {"$inc": {"member_count": 1}}
    )
    
    return member

@router.delete("/{team_id}/members/{user_id}")
async def remove_team_member(
    team_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a member from a team"""
    if current_user.get("role") not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Only owners and admins can remove team members")
    
    tenant_id = current_user.get("tenant_id")
    
    # Verify team exists
    team = await db.teams.find_one({"id": team_id, "tenant_id": tenant_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Remove member
    result = await db.team_members.delete_one({
        "team_id": team_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found in team")
    
    # Update member count
    await db.teams.update_one(
        {"id": team_id},
        {"$inc": {"member_count": -1}}
    )
    
    return {"message": "Member removed from team"}

# Get user's teams
@router.get("/user/{user_id}", response_model=List[TeamResponse])
async def get_user_teams(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get all teams a user belongs to"""
    tenant_id = current_user.get("tenant_id")
    
    # Get team memberships
    memberships = await db.team_members.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    team_ids = [m["team_id"] for m in memberships]
    
    if not team_ids:
        return []
    
    teams = await db.teams.find(
        {"id": {"$in": team_ids}, "tenant_id": tenant_id},
        {"_id": 0}
    ).to_list(100)
    
    return teams
