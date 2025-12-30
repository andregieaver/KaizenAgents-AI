"""
Agent Credentials API Routes
Manage encrypted credentials for AI agent website authentication
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

import sys
sys.path.append('/app/backend')
from server import db, get_current_user
from services.credential_service import CredentialService, CredentialEncryption

router = APIRouter(prefix="/credentials", tags=["agent-credentials"])

# Initialize credential service
_credential_service = None


def get_credential_service() -> CredentialService:
    global _credential_service
    if _credential_service is None:
        encryption = CredentialEncryption()
        _credential_service = CredentialService(db, encryption)
    return _credential_service


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class CredentialCreate(BaseModel):
    name: str = Field(..., description="Friendly name for this credential")
    site_domain: str = Field(..., description="Domain of the website (e.g., example.com)")
    login_url: str = Field(..., description="Full URL to the login page")
    username: str = Field(..., description="Username or email for login")
    password: str = Field(..., description="Password for login")
    username_selector: Optional[str] = Field(
        default="#username, input[name='username'], input[name='email'], input[type='email']",
        description="CSS selector for username field"
    )
    password_selector: Optional[str] = Field(
        default="#password, input[name='password'], input[type='password']",
        description="CSS selector for password field"
    )
    submit_selector: Optional[str] = Field(
        default="button[type='submit'], input[type='submit']",
        description="CSS selector for submit button"
    )
    success_indicator: Optional[str] = Field(
        default=None,
        description="CSS selector that indicates successful login"
    )
    notes: Optional[str] = Field(default=None, description="Optional notes")


class CredentialUpdate(BaseModel):
    name: Optional[str] = None
    site_domain: Optional[str] = None
    login_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    username_selector: Optional[str] = None
    password_selector: Optional[str] = None
    submit_selector: Optional[str] = None
    success_indicator: Optional[str] = None
    notes: Optional[str] = None


class CredentialResponse(BaseModel):
    id: str
    name: str
    site_domain: str
    login_url: str
    field_selectors: Dict[str, str]
    success_indicator: Optional[str] = None
    notes: Optional[str] = None
    last_used: Optional[str] = None
    last_success: Optional[str] = None
    use_count: int = 0
    created_at: str
    updated_at: str


class CredentialTestRequest(BaseModel):
    """
    Optional request body for testing credentials.
    If empty, will use stored selectors.
    """
    take_screenshot: bool = Field(default=True, description="Capture screenshot after login attempt")


# =============================================================================
# CRUD ENDPOINTS
# =============================================================================

@router.get("", response_model=List[CredentialResponse])
@router.get("/", response_model=List[CredentialResponse])
async def list_credentials(
    current_user: dict = Depends(get_current_user)
):
    """List all stored credentials for the tenant (without sensitive data)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    service = get_credential_service()
    credentials = await service.list_credentials(tenant_id)
    return credentials


@router.post("", response_model=CredentialResponse)
@router.post("/", response_model=CredentialResponse)
async def create_credential(
    credential_data: CredentialCreate,
    current_user: dict = Depends(get_current_user)
):
    """Store a new encrypted credential"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    service = get_credential_service()
    
    # Check if credential with this name already exists
    existing = await service.get_credential_by_name(credential_data.name, tenant_id)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Credential with name '{credential_data.name}' already exists"
        )
    
    credential = await service.store_credential(
        tenant_id=tenant_id,
        name=credential_data.name,
        site_domain=credential_data.site_domain,
        login_url=credential_data.login_url,
        username=credential_data.username,
        password=credential_data.password,
        username_selector=credential_data.username_selector,
        password_selector=credential_data.password_selector,
        submit_selector=credential_data.submit_selector,
        success_indicator=credential_data.success_indicator,
        notes=credential_data.notes
    )
    
    return credential


@router.get("/{credential_id}", response_model=CredentialResponse)
async def get_credential(
    credential_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific credential by ID (without sensitive data)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    service = get_credential_service()
    credential = await service.get_credential(credential_id, tenant_id)
    
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    return credential


@router.put("/{credential_id}", response_model=CredentialResponse)
async def update_credential(
    credential_id: str,
    updates: CredentialUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a credential"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    service = get_credential_service()
    
    # Verify credential exists
    existing = await service.get_credential(credential_id, tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    # Build update dict from non-None fields
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    credential = await service.update_credential(credential_id, tenant_id, update_data)
    
    if not credential:
        raise HTTPException(status_code=500, detail="Failed to update credential")
    
    return credential


@router.delete("/{credential_id}")
async def delete_credential(
    credential_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a credential"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    service = get_credential_service()
    
    # Verify credential exists
    existing = await service.get_credential(credential_id, tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    deleted = await service.delete_credential(credential_id, tenant_id)
    
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete credential")
    
    return {"message": "Credential deleted successfully", "credential_id": credential_id}


# =============================================================================
# TEST ENDPOINT
# =============================================================================

@router.post("/{credential_id}/test")
async def test_credential(
    credential_id: str,
    test_request: CredentialTestRequest = CredentialTestRequest(),
    current_user: dict = Depends(get_current_user)
):
    """
    Test a credential by attempting to log into the website.
    Returns login result and optionally a screenshot.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    service = get_credential_service()
    
    # Get credential with decrypted data
    credential = await service.get_credential(credential_id, tenant_id, include_decrypted=True)
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    if not credential.get("decrypted"):
        raise HTTPException(status_code=500, detail="Failed to decrypt credential")
    
    # Try to login using browser tools
    try:
        from services.browser_tools import BrowserSession, login_with_credential
        
        async with BrowserSession() as session:
            result = await login_with_credential(
                session=session,
                credential=credential,
                take_screenshot=test_request.take_screenshot
            )
            
            # Record the usage
            await service.record_usage(
                credential_id=credential_id,
                tenant_id=tenant_id,
                success=result.get("success", False)
            )
            
            return result
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "credential_name": credential.get("name")
        }


# =============================================================================
# LOOKUP ENDPOINT
# =============================================================================

@router.get("/by-name/{name}", response_model=CredentialResponse)
async def get_credential_by_name(
    name: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a credential by its name"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    service = get_credential_service()
    credential = await service.get_credential_by_name(name, tenant_id)
    
    if not credential:
        raise HTTPException(status_code=404, detail=f"Credential '{name}' not found")
    
    return credential
