"""
Global Components Model - For site-wide reusable components like headers and footers
"""
from pydantic import BaseModel
from typing import List, Optional, Dict

class GlobalComponent(BaseModel):
    component_type: str  # 'header', 'footer', etc.
    name: str
    blocks: List[Dict]  # Content blocks
    is_active: bool = True
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None
