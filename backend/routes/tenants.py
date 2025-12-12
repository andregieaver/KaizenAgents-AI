"""
Tenant management routes
"""
from fastapi import APIRouter, HTTPException, Depends

from models import TenantResponse, TenantCreate
from middleware import get_current_user
from middleware.database import db

router = APIRouter(prefix="/tenants", tags=["tenants"])

@router.get("/current", response_model=TenantResponse)
async def get_current_tenant(current_user: dict = Depends(get_current_user)):
    """Get current user's tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return tenant

@router.put("/current", response_model=TenantResponse)
async def update_current_tenant(tenant_data: TenantCreate, current_user: dict = Depends(get_current_user)):
    """Update current user's tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    update_data = {k: v for k, v in tenant_data.model_dump().items() if v is not None}
    
    await db.tenants.update_one({"id": tenant_id}, {"$set": update_data})
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    
    return tenant
