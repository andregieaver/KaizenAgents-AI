"""
Discount codes management routes (Super Admin only)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone
import uuid

from middleware import get_current_user, get_super_admin_user
from middleware.database import db

router = APIRouter(prefix="/discounts", tags=["discounts"])

# Models
class DiscountCodeCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    discount_type: Literal["percentage", "fixed_amount", "free_trial_days", "free_months"]
    value: float  # percentage (0-100), fixed amount in dollars, or days/months
    max_uses: Optional[int] = None  # None = unlimited
    expires_at: Optional[str] = None  # ISO date string
    applicable_plans: Optional[List[str]] = None  # None = all plans
    min_plan_price: Optional[float] = None  # Minimum plan price to apply
    is_active: bool = True
    is_first_time_only: bool = False  # Only for new subscribers

class DiscountCodeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[Literal["percentage", "fixed_amount", "free_trial_days", "free_months"]] = None
    value: Optional[float] = None
    max_uses: Optional[int] = None
    expires_at: Optional[str] = None
    applicable_plans: Optional[List[str]] = None
    min_plan_price: Optional[float] = None
    is_active: Optional[bool] = None
    is_first_time_only: Optional[bool] = None

class DiscountCodeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    code: str
    name: str
    description: Optional[str]
    discount_type: str
    value: float
    max_uses: Optional[int]
    current_uses: int
    expires_at: Optional[str]
    applicable_plans: Optional[List[str]]
    min_plan_price: Optional[float]
    is_active: bool
    is_first_time_only: bool
    created_at: str
    updated_at: str

class ApplyDiscountRequest(BaseModel):
    code: str
    plan_id: str
    billing_cycle: Literal["monthly", "yearly"] = "monthly"

class ApplyDiscountResponse(BaseModel):
    valid: bool
    message: str
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    original_price: Optional[float] = None
    discounted_price: Optional[float] = None
    free_trial_days: Optional[int] = None
    free_months: Optional[int] = None

# Admin endpoints
@router.post("", response_model=DiscountCodeResponse)
async def create_discount_code(
    code_data: DiscountCodeCreate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Create a new discount code (Super Admin only)"""
    
    # Check if code already exists
    existing = await db.discount_codes.find_one({"code": code_data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Discount code already exists")
    
    # Validate discount value
    if code_data.discount_type == "percentage" and (code_data.value < 0 or code_data.value > 100):
        raise HTTPException(status_code=400, detail="Percentage must be between 0 and 100")
    
    if code_data.discount_type == "fixed_amount" and code_data.value < 0:
        raise HTTPException(status_code=400, detail="Fixed amount must be positive")
    
    now = datetime.now(timezone.utc).isoformat()
    code_id = str(uuid.uuid4())
    
    discount_code = {
        "id": code_id,
        "code": code_data.code.upper(),
        "name": code_data.name,
        "description": code_data.description,
        "discount_type": code_data.discount_type,
        "value": code_data.value,
        "max_uses": code_data.max_uses,
        "current_uses": 0,
        "expires_at": code_data.expires_at,
        "applicable_plans": code_data.applicable_plans,
        "min_plan_price": code_data.min_plan_price,
        "is_active": code_data.is_active,
        "is_first_time_only": code_data.is_first_time_only,
        "created_at": now,
        "updated_at": now
    }
    
    await db.discount_codes.insert_one(discount_code)
    return discount_code

@router.get("", response_model=List[DiscountCodeResponse])
async def get_discount_codes(
    include_inactive: bool = False,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Get all discount codes (Super Admin only)"""
    query = {} if include_inactive else {"is_active": True}
    codes = await db.discount_codes.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return codes

@router.get("/{code_id}", response_model=DiscountCodeResponse)
async def get_discount_code(
    code_id: str,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Get specific discount code (Super Admin only)"""
    code = await db.discount_codes.find_one({"id": code_id}, {"_id": 0})
    if not code:
        raise HTTPException(status_code=404, detail="Discount code not found")
    return code

@router.patch("/{code_id}", response_model=DiscountCodeResponse)
async def update_discount_code(
    code_id: str,
    code_data: DiscountCodeUpdate,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Update a discount code (Super Admin only)"""
    existing = await db.discount_codes.find_one({"id": code_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Discount code not found")
    
    update_data = {k: v for k, v in code_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.discount_codes.update_one(
        {"id": code_id},
        {"$set": update_data}
    )
    
    updated = await db.discount_codes.find_one({"id": code_id}, {"_id": 0})
    return updated

@router.delete("/{code_id}")
async def delete_discount_code(
    code_id: str,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Delete a discount code (Super Admin only)"""
    result = await db.discount_codes.delete_one({"id": code_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Discount code not found")
    return {"message": "Discount code deleted successfully"}

# Public endpoint to validate and apply discount
@router.post("/apply", response_model=ApplyDiscountResponse)
async def apply_discount_code(
    request: ApplyDiscountRequest,
    current_user: dict = Depends(get_current_user)
):
    """Validate and apply a discount code to a plan"""
    
    # Find the discount code
    discount = await db.discount_codes.find_one(
        {"code": request.code.upper()},
        {"_id": 0}
    )
    
    if not discount:
        return ApplyDiscountResponse(valid=False, message="Invalid discount code")
    
    # Check if active
    if not discount.get("is_active"):
        return ApplyDiscountResponse(valid=False, message="This discount code is no longer active")
    
    # Check expiry
    if discount.get("expires_at"):
        expiry = datetime.fromisoformat(discount["expires_at"].replace("Z", "+00:00"))
        if expiry < datetime.now(timezone.utc):
            return ApplyDiscountResponse(valid=False, message="This discount code has expired")
    
    # Check max uses
    if discount.get("max_uses") and discount.get("current_uses", 0) >= discount["max_uses"]:
        return ApplyDiscountResponse(valid=False, message="This discount code has reached its usage limit")
    
    # Check first-time only
    if discount.get("is_first_time_only"):
        tenant_id = current_user.get("tenant_id")
        existing_sub = await db.subscriptions.find_one({
            "tenant_id": tenant_id,
            "stripe_subscription_id": {"$ne": None}
        })
        if existing_sub:
            return ApplyDiscountResponse(valid=False, message="This discount code is for new subscribers only")
    
    # Get the plan
    plan = await db.subscription_plans.find_one({"id": request.plan_id}, {"_id": 0})
    if not plan:
        return ApplyDiscountResponse(valid=False, message="Invalid plan")
    
    # Check applicable plans
    if discount.get("applicable_plans") and request.plan_id not in discount["applicable_plans"]:
        return ApplyDiscountResponse(valid=False, message="This discount code is not valid for this plan")
    
    # Get price based on billing cycle
    original_price = plan["price_yearly"] if request.billing_cycle == "yearly" else plan["price_monthly"]
    
    # Check minimum plan price
    if discount.get("min_plan_price") and original_price < discount["min_plan_price"]:
        return ApplyDiscountResponse(
            valid=False, 
            message=f"This discount code requires a minimum plan price of ${discount['min_plan_price']}"
        )
    
    # Calculate discount
    discount_type = discount["discount_type"]
    value = discount["value"]
    
    if discount_type == "percentage":
        discounted_price = original_price * (1 - value / 100)
        return ApplyDiscountResponse(
            valid=True,
            message=f"{value}% discount applied!",
            discount_type=discount_type,
            discount_value=value,
            original_price=original_price,
            discounted_price=round(discounted_price, 2)
        )
    
    elif discount_type == "fixed_amount":
        discounted_price = max(0, original_price - value)
        return ApplyDiscountResponse(
            valid=True,
            message=f"${value} discount applied!",
            discount_type=discount_type,
            discount_value=value,
            original_price=original_price,
            discounted_price=round(discounted_price, 2)
        )
    
    elif discount_type == "free_trial_days":
        return ApplyDiscountResponse(
            valid=True,
            message=f"{int(value)} days free trial!",
            discount_type=discount_type,
            discount_value=value,
            original_price=original_price,
            discounted_price=original_price,
            free_trial_days=int(value)
        )
    
    elif discount_type == "free_months":
        return ApplyDiscountResponse(
            valid=True,
            message=f"{int(value)} month(s) free!",
            discount_type=discount_type,
            discount_value=value,
            original_price=original_price,
            discounted_price=original_price,
            free_months=int(value)
        )
    
    return ApplyDiscountResponse(valid=False, message="Unknown discount type")

# Track discount usage (called when subscription is created)
@router.post("/use/{code}")
async def use_discount_code(
    code: str,
    current_user: dict = Depends(get_current_user)
):
    """Increment usage count for a discount code"""
    result = await db.discount_codes.update_one(
        {"code": code.upper()},
        {"$inc": {"current_uses": 1}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Discount code not found")
    
    return {"message": "Discount code usage recorded"}
