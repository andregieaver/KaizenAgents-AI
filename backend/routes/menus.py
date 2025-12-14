"""
Menus management routes - centralized menu creation and management
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
from models.menus import MenuCreate, MenuUpdate, MenuResponse
from middleware.auth import get_current_user
from middleware.database import db
from uuid import uuid4

router = APIRouter(prefix="/api/menus", tags=["menus"])


# Super-admin check
def is_super_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Super-admin access required")
    return current_user


# List all menus
@router.get("/", response_model=List[MenuResponse])
async def list_menus(current_user: dict = Depends(is_super_admin)):
    """List all menus"""
    menus = await db.menus.find({}, {"_id": 0}).to_list(1000)
    return menus


# Get menu by ID
@router.get("/{menu_id}", response_model=MenuResponse)
async def get_menu(menu_id: str, current_user: dict = Depends(is_super_admin)):
    """Get a specific menu by ID"""
    menu = await db.menus.find_one({"menu_id": menu_id}, {"_id": 0})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    return menu


# Get menu by ID (public - no auth required)
@router.get("/public/{menu_id}", response_model=MenuResponse)
async def get_public_menu(menu_id: str):
    """Get a specific menu by ID (public access)"""
    menu = await db.menus.find_one({"menu_id": menu_id}, {"_id": 0})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    return menu


# Create new menu
@router.post("/", response_model=MenuResponse)
async def create_menu(menu: MenuCreate, current_user: dict = Depends(is_super_admin)):
    """Create a new menu"""
    menu_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    new_menu = {
        "menu_id": menu_id,
        "name": menu.name,
        "items": menu.items,
        "created_at": now,
        "updated_at": now
    }
    
    await db.menus.insert_one(new_menu)
    return new_menu


# Update menu
@router.put("/{menu_id}", response_model=MenuResponse)
async def update_menu(
    menu_id: str,
    menu: MenuUpdate,
    current_user: dict = Depends(is_super_admin)
):
    """Update an existing menu"""
    existing = await db.menus.find_one({"menu_id": menu_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    updated_menu = {
        "name": menu.name,
        "items": menu.items,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.menus.update_one(
        {"menu_id": menu_id},
        {"$set": updated_menu}
    )
    
    # Return updated menu
    result = await db.menus.find_one({"menu_id": menu_id}, {"_id": 0})
    return result


# Delete menu
@router.delete("/{menu_id}")
async def delete_menu(menu_id: str, current_user: dict = Depends(is_super_admin)):
    """Delete a menu"""
    result = await db.menus.delete_one({"menu_id": menu_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu not found")
    return {"message": "Menu deleted successfully"}
