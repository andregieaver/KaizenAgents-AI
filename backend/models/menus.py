"""
Menus data models for centralized menu management
"""
from pydantic import BaseModel
from typing import List, Dict, Optional


class MenuItem(BaseModel):
    """Individual menu item"""
    id: str
    label: str
    url: str
    icon: Optional[str] = None
    visibility: Dict[str, bool] = {"desktop": True, "tablet": True, "mobile": True}
    order: int = 0


class MenuBase(BaseModel):
    """Base menu model"""
    name: str
    items: List[Dict] = []


class MenuCreate(MenuBase):
    """Menu creation model"""
    pass


class MenuUpdate(MenuBase):
    """Menu update model"""
    pass


class MenuResponse(MenuBase):
    """Menu response model"""
    menu_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
