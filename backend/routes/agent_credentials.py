"""
Agent Credentials API Routes
Manage encrypted website credentials for AI agent logins
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

import sys
sys.path.append('/app/backend')
from server import db, get_current_user
from services.credential_service import CredentialService, CredentialEncryption

router = APIRouter(prefix="/agent-credentials", tags=["agent-credentials"])

# Initialize services
_credential_service = None

def get_credential_service() -> CredentialService:
    global _credential_service
    if _credential_service is None:
        _credential_service = CredentialService(db)
    return _credential_service


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class CredentialCreate(BaseModel):
    name: str = Field(..., description="Friendly name for this credential")
    site_domain: str = Field(..., description="Website domain (e.g., example.com)")
    login_url: str = Field(..., description="Full URL to login page")
    username: str = Field(..., description="Username or email")
    password: str = Field(..., description="Password")
    username_selector: str = Field(
        default="#username, input[name='username'], input[name='email'], input[type='email']",
        description="CSS selector for username field"
    )
    password_selector: str = Field(
        default="#password, input[name='password'], input[type='password']",
        description="CSS selector for password field"
    )
    submit_selector: str = Field(
        default="button[type='submit'], input[type='submit']",
        description="CSS selector for submit button"
    )
    additional_fields: Optional[Dict[str, str]] = Field(
        default=None,
        description="Additional form fields {selector: value}"
    )
    success_indicator: Optional[str] = Field(
        default=None,
        description="CSS selector that indicates successful login"
    )
    notes: Optional[str] = Field(default=None, description="Optional notes")


class CredentialUpdate(BaseModel):
    name: Optional[str] = None
    login_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    username_selector: Optional[str] = None
    password_selector: Optional[str] = None
    submit_selector: Optional[str] = None
    success_indicator: Optional[str] = None
    notes: Optional[str] = None


class CredentialTestRequest(BaseModel):
    take_screenshot: bool = Field(default=True, description="Capture screenshot after login")


# =============================================================================
# CREDENTIAL ENDPOINTS
# =============================================================================

@router.get("")
async def list_credentials(
    current_user: dict = Depends(get_current_user)
):
    """List all stored credentials (without sensitive data)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    service = get_credential_service()
    credentials = await service.list_credentials(tenant_id)
    
    return {"credentials": credentials, "count": len(credentials)}


@router.post("")
async def create_credential(
    credential: CredentialCreate,
    current_user: dict = Depends(get_current_user)
):
    """Store a new encrypted credential"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Check for duplicate name
    service = get_credential_service()
    existing = await service.get_credential_by_name(credential.name, tenant_id)
    if existing:
        raise HTTPException(status_code=400, detail=f"Credential with name '{credential.name}' already exists")
    
    result = await service.store_credential(
        tenant_id=tenant_id,
        name=credential.name,
        site_domain=credential.site_domain,
        login_url=credential.login_url,
        username=credential.username,
        password=credential.password,
        username_selector=credential.username_selector,
        password_selector=credential.password_selector,
        submit_selector=credential.submit_selector,
        additional_fields=credential.additional_fields,
        success_indicator=credential.success_indicator,
        notes=credential.notes
    )
    
    return result


@router.get("/{credential_id}")
async def get_credential(
    credential_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a credential by ID (without sensitive data)"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    service = get_credential_service()
    credential = await service.get_credential(credential_id, tenant_id)
    
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    return credential


@router.put("/{credential_id}")
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
    
    # Convert to dict and remove None values
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    result = await service.update_credential(credential_id, tenant_id, update_data)
    
    if not result:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    return result


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
    deleted = await service.delete_credential(credential_id, tenant_id)
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    return {"message": "Credential deleted"}


@router.post("/{credential_id}/test")
async def test_credential(
    credential_id: str,
    request: CredentialTestRequest = CredentialTestRequest(),
    current_user: dict = Depends(get_current_user)
):
    """Test a credential by attempting to log in"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Import here to avoid circular imports
    from services.credential_service import login_to_website
    from services.browser_tools import BrowserSession
    import base64
    
    service = get_credential_service()
    
    # Verify credential exists
    credential = await service.get_credential(credential_id, tenant_id)
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    # Create browser session and attempt login
    async with BrowserSession() as session:
        result = await login_to_website(
            session=session,
            credential_service=service,
            tenant_id=tenant_id,
            credential_id=credential_id
        )
        
        # Take screenshot if requested
        if request.take_screenshot and result.get("success") is not False:
            try:
                screenshot_data = await session.page.screenshot(type='jpeg', quality=80)
                result["screenshot"] = {
                    "format": "jpeg",
                    "data": base64.b64encode(screenshot_data).decode('utf-8'),
                    "size": len(screenshot_data)
                }
            except Exception as e:
                result["screenshot_error"] = str(e)
    
    return result


# =============================================================================
# UTILITY ENDPOINTS
# =============================================================================

@router.get("/search/by-domain/{domain}")
async def search_by_domain(
    domain: str,
    current_user: dict = Depends(get_current_user)
):
    """Search credentials by domain"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Search for credentials matching domain
    cursor = db.agent_credentials.find({
        "tenant_id": tenant_id,
        "site_domain": {"$regex": domain, "$options": "i"}
    }, {"_id": 0, "credentials_encrypted": 0})
    
    credentials = await cursor.to_list(length=20)
    
    return {"credentials": credentials, "count": len(credentials)}


@router.get("/stats")
async def get_credential_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get credential usage statistics"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated")
    
    # Count credentials
    total = await db.agent_credentials.count_documents({"tenant_id": tenant_id})
    
    # Get recently used
    cursor = db.agent_credentials.find(
        {"tenant_id": tenant_id, "last_used": {"$ne": None}},
        {"_id": 0, "credentials_encrypted": 0}
    ).sort("last_used", -1).limit(5)
    
    recently_used = await cursor.to_list(length=5)
    
    # Get most used
    cursor = db.agent_credentials.find(
        {"tenant_id": tenant_id, "use_count": {"$gt": 0}},
        {"_id": 0, "credentials_encrypted": 0}
    ).sort("use_count", -1).limit(5)
    
    most_used = await cursor.to_list(length=5)
    
    return {
        "total_credentials": total,
        "recently_used": recently_used,
        "most_used": most_used
    }
