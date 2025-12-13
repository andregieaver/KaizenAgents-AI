"""
Global Components Management routes - Manage site-wide components (header, footer)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timezone

from middleware import get_current_user
from middleware.database import db

router = APIRouter(prefix="/global-components", tags=["global-components"])

# Models
class ComponentUpdateRequest(BaseModel):
    blocks: List[Dict]

class ComponentResponse(BaseModel):
    component_type: str
    name: str
    blocks: List[Dict]
    is_active: bool
    updated_at: Optional[str] = None

# Super-admin check
def is_super_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Super-admin access required")
    return current_user

# Initialize default components
async def ensure_default_components():
    """Ensure default header and footer components exist"""
    components = [
        {
            "component_type": "header",
            "name": "Main Header",
            "blocks": [],
            "is_active": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "component_type": "footer",
            "name": "Main Footer",
            "blocks": [],
            "is_active": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for component in components:
        existing = await db.global_components.find_one({"component_type": component["component_type"]})
        if not existing:
            await db.global_components.insert_one(component)

# Public endpoint to fetch active components
@router.get("/public/{component_type}", response_model=ComponentResponse)
async def get_public_component(component_type: str):
    """Get active global component (no auth required)"""
    component = await db.global_components.find_one(
        {"component_type": component_type, "is_active": True},
        {"_id": 0}
    )
    
    if not component:
        # Return empty component if not found
        return {
            "component_type": component_type,
            "name": f"Default {component_type.title()}",
            "blocks": [],
            "is_active": True,
            "updated_at": None
        }
    
    return component

# Admin: Get all components
@router.get("/", response_model=List[ComponentResponse])
async def list_components(current_user: dict = Depends(is_super_admin)):
    """List all global components"""
    await ensure_default_components()
    
    components = await db.global_components.find(
        {},
        {"_id": 0}
    ).to_list(100)
    
    return components

# Admin: Get component by type
@router.get("/{component_type}", response_model=ComponentResponse)
async def get_component(
    component_type: str,
    current_user: dict = Depends(is_super_admin)
):
    """Get global component for editing"""
    await ensure_default_components()
    
    component = await db.global_components.find_one(
        {"component_type": component_type},
        {"_id": 0}
    )
    
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    
    return component

# Admin: Update component
@router.put("/{component_type}")
async def update_component(
    component_type: str,
    update_data: ComponentUpdateRequest,
    current_user: dict = Depends(is_super_admin)
):
    """Update global component"""
    component = await db.global_components.find_one({"component_type": component_type})
    
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    
    update_fields = {
        "blocks": update_data.blocks,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.get("email")
    }
    
    await db.global_components.update_one(
        {"component_type": component_type},
        {"$set": update_fields}
    )
    
    return {"message": "Component updated successfully"}
