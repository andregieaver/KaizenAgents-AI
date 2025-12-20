"""
Onboarding API Routes
Handles user onboarding flow after subscription
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

from middleware.database import db
from middleware import get_current_user
from services.email_service import EmailService

router = APIRouter(prefix="/onboarding", tags=["onboarding"])
logger = logging.getLogger("app")


# ============== MODELS ==============

class CompanyInfo(BaseModel):
    """Company/brand information"""
    name: str
    brand_name: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None  # 1-10, 11-50, 51-200, 201-500, 500+


class OnboardingStep(BaseModel):
    """Onboarding step status"""
    id: str
    name: str
    description: str
    completed: bool
    link: str
    tab: Optional[str] = None


class OnboardingStatus(BaseModel):
    """Complete onboarding status"""
    model_config = ConfigDict(extra="ignore")
    is_complete: bool
    completion_percentage: int
    steps: List[OnboardingStep]
    company_name: Optional[str] = None
    brand_name: Optional[str] = None


# ============== ONBOARDING STEPS DEFINITION ==============

ONBOARDING_STEPS = [
    {
        "id": "company_info",
        "name": "Company Information",
        "description": "Set up your company name and brand details",
        "link": "/dashboard/settings",
        "tab": "general",
        "check_field": "company_setup_complete"
    },
    {
        "id": "brand_logo",
        "name": "Brand Logo",
        "description": "Upload your company logo for branding",
        "link": "/dashboard/settings",
        "tab": "general",
        "check_field": "brand_logo_complete"
    },
    {
        "id": "first_agent",
        "name": "Create First Agent",
        "description": "Set up your first AI support agent",
        "link": "/dashboard/agents",
        "tab": None,
        "check_field": "first_agent_complete"
    },
    {
        "id": "team_member",
        "name": "Invite Team Member",
        "description": "Add team members to collaborate",
        "link": "/dashboard/team",
        "tab": None,
        "check_field": "team_member_complete"
    },
    {
        "id": "widget_setup",
        "name": "Install Chat Widget",
        "description": "Add the chat widget to your website",
        "link": "/dashboard/settings",
        "tab": "embed",
        "check_field": "widget_setup_complete"
    }
]


# ============== HELPER FUNCTIONS ==============

async def calculate_onboarding_status(tenant_id: str) -> dict:
    """Calculate onboarding completion status for a tenant"""
    
    # Get onboarding record
    onboarding = await db.onboarding.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not onboarding:
        onboarding = {"tenant_id": tenant_id}
    
    # Get tenant/company info
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    company_name = tenant.get("name") if tenant else None
    brand_name = tenant.get("brand_name") if tenant else None
    
    # Check each step
    steps = []
    completed_count = 0
    
    for step_def in ONBOARDING_STEPS:
        step_id = step_def["id"]
        is_completed = False
        
        # Check based on step type
        if step_id == "company_info":
            # Check if brand_name is set in settings
            settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
            is_completed = bool(settings and settings.get("brand_name"))
        elif step_id == "brand_logo":
            settings = await db.settings.find_one({"tenant_id": tenant_id}, {"_id": 0})
            is_completed = bool(settings and settings.get("brand_logo"))
        elif step_id == "first_agent":
            # Check user_agents collection for custom agents created by this tenant
            agent_count = await db.user_agents.count_documents({"tenant_id": tenant_id})
            is_completed = agent_count > 0
        elif step_id == "team_member":
            user_count = await db.users.count_documents({"tenant_id": tenant_id})
            is_completed = user_count > 1  # More than just the owner
        elif step_id == "widget_setup":
            # Check if widget has been viewed/configured
            is_completed = onboarding.get("widget_setup_complete", False)
        else:
            is_completed = onboarding.get(step_def["check_field"], False)
        
        if is_completed:
            completed_count += 1
        
        steps.append({
            "id": step_id,
            "name": step_def["name"],
            "description": step_def["description"],
            "completed": is_completed,
            "link": step_def["link"],
            "tab": step_def.get("tab")
        })
    
    total_steps = len(ONBOARDING_STEPS)
    completion_percentage = int((completed_count / total_steps) * 100) if total_steps > 0 else 0
    
    return {
        "is_complete": completed_count == total_steps,
        "completion_percentage": completion_percentage,
        "steps": steps,
        "company_name": company_name,
        "brand_name": brand_name
    }


async def send_welcome_email(user_email: str, user_name: str, plan_name: str):
    """Send welcome email after subscription"""
    
    # Get platform info
    platform_info = await db.platform_info.find_one({}, {"_id": 0})
    platform_name = platform_info.get("name", "AI Support Hub") if platform_info else "AI Support Hub"
    
    variables = {
        "platform_name": platform_name,
        "user_name": user_name,
        "user_email": user_email,
        "plan_name": plan_name,
        "year": str(datetime.now().year)
    }
    
    success = await EmailService.send_email(
        to_email=user_email,
        template_key="subscription_welcome",
        variables=variables,
        fallback_subject=f"Welcome to {platform_name}! Let's get started",
        fallback_content=f"<p>Hi {user_name},</p><p>Welcome to {platform_name}!</p>"
    )
    
    if success:
        logger.info(f"Welcome email sent to {user_email}")
    else:
        logger.warning(f"Failed to send welcome email to {user_email}")
    
    return success


# ============== ROUTES ==============

@router.get("/status", response_model=OnboardingStatus)
async def get_onboarding_status(current_user: dict = Depends(get_current_user)):
    """Get current onboarding status and progress"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    status = await calculate_onboarding_status(tenant_id)
    return status


@router.post("/company")
async def save_company_info(
    info: CompanyInfo,
    current_user: dict = Depends(get_current_user)
):
    """Save company/brand information during onboarding"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update tenant with company info
    update_data = {
        "name": info.name,
        "brand_name": info.brand_name or info.name,
        "updated_at": now
    }
    
    if info.website:
        update_data["website"] = info.website
    if info.industry:
        update_data["industry"] = info.industry
    if info.size:
        update_data["company_size"] = info.size
    
    await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": update_data}
    )
    
    # Update onboarding status
    await db.onboarding.update_one(
        {"tenant_id": tenant_id},
        {
            "$set": {
                "company_setup_complete": True,
                "updated_at": now
            },
            "$setOnInsert": {
                "tenant_id": tenant_id,
                "created_at": now
            }
        },
        upsert=True
    )
    
    logger.info(f"Company info saved for tenant {tenant_id}")
    
    return {"message": "Company information saved successfully"}


@router.post("/complete-step/{step_id}")
async def complete_onboarding_step(
    step_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark an onboarding step as complete"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    # Find the step
    step = next((s for s in ONBOARDING_STEPS if s["id"] == step_id), None)
    if not step:
        raise HTTPException(status_code=404, detail="Onboarding step not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update onboarding status
    await db.onboarding.update_one(
        {"tenant_id": tenant_id},
        {
            "$set": {
                step["check_field"]: True,
                "updated_at": now
            },
            "$setOnInsert": {
                "tenant_id": tenant_id,
                "created_at": now
            }
        },
        upsert=True
    )
    
    logger.info(f"Onboarding step '{step_id}' completed for tenant {tenant_id}")
    
    return {"message": f"Step '{step['name']}' marked as complete"}


@router.post("/skip")
async def skip_onboarding(current_user: dict = Depends(get_current_user)):
    """Skip/dismiss the onboarding widget"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.onboarding.update_one(
        {"tenant_id": tenant_id},
        {
            "$set": {
                "dismissed": True,
                "dismissed_at": now,
                "updated_at": now
            },
            "$setOnInsert": {
                "tenant_id": tenant_id,
                "created_at": now
            }
        },
        upsert=True
    )
    
    return {"message": "Onboarding dismissed"}


@router.get("/dismissed")
async def is_onboarding_dismissed(current_user: dict = Depends(get_current_user)):
    """Check if onboarding has been dismissed"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        return {"dismissed": False}
    
    onboarding = await db.onboarding.find_one({"tenant_id": tenant_id}, {"_id": 0})
    
    return {"dismissed": onboarding.get("dismissed", False) if onboarding else False}


@router.post("/send-welcome-email")
async def trigger_welcome_email(current_user: dict = Depends(get_current_user)):
    """Manually trigger welcome email (for testing)"""
    user_email = current_user.get("email")
    user_name = current_user.get("name", "there")
    
    # Get subscription plan
    subscription = await db.subscriptions.find_one(
        {"user_id": current_user.get("id")},
        {"_id": 0}
    )
    plan_name = subscription.get("plan_name", "your plan") if subscription else "your plan"
    
    success = await send_welcome_email(user_email, user_name, plan_name)
    
    if success:
        return {"message": "Welcome email sent successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send welcome email")
