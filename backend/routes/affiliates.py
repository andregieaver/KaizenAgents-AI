"""
Affiliate program management routes
Store Credit Referral System:
- Referrer earns 20% store credit per successful referral (max 100% per billing cycle)
- Credit auto-deducts from next subscription renewal
- Referred user gets 20% off first payment
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
import uuid
import hashlib

from middleware import get_current_user, get_super_admin_user
from middleware.database import db

router = APIRouter(prefix="/affiliates", tags=["affiliates"])

# Models
class AffiliateUpdate(BaseModel):
    payment_email: Optional[str] = None  # For notifications

class AffiliateResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    affiliate_code: str
    affiliate_link: str
    commission_rate: float  # 20%
    total_referrals: int
    successful_referrals: int
    store_credit: float  # Current store credit percentage (0-100)
    total_credit_earned: float  # Lifetime credit earned
    total_credit_used: float  # Lifetime credit applied
    status: str
    created_at: str

class ReferralResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    referred_email: str
    status: str
    plan_name: Optional[str]
    credit_earned: float  # 20% credit earned for this referral
    created_at: str
    converted_at: Optional[str]

class AffiliateStatsResponse(BaseModel):
    total_referrals: int
    successful_referrals: int
    conversion_rate: float
    store_credit: float  # Current available credit (0-100%)
    total_credit_earned: float
    total_credit_used: float
    this_month_referrals: int
    this_cycle_successful: int  # Successful referrals this billing cycle

class ReferralDiscountResponse(BaseModel):
    """Response for checking if user has referral discount"""
    has_discount: bool
    discount_percentage: float
    referred_by_code: Optional[str]


# Helper functions
def generate_affiliate_code(user_id: str) -> str:
    """Generate a unique affiliate code based on user_id"""
    hash_input = f"{user_id}-{datetime.now().timestamp()}"
    return hashlib.md5(hash_input.encode()).hexdigest()[:8].upper()

def get_affiliate_link(code: str) -> str:
    """Generate affiliate link"""
    import os
    base_url = os.environ.get("FRONTEND_URL", "https://app.example.com")
    return f"{base_url}/register?ref={code}"


# User endpoints
@router.get("/my", response_model=AffiliateResponse)
async def get_my_affiliate(current_user: dict = Depends(get_current_user)):
    """Get current user's affiliate information"""
    user_id = current_user.get("id")
    
    affiliate = await db.affiliates.find_one({"user_id": user_id}, {"_id": 0})
    
    if not affiliate:
        # Auto-create affiliate account for user
        affiliate_code = generate_affiliate_code(user_id)
        
        now = datetime.now(timezone.utc).isoformat()
        affiliate = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "tenant_id": current_user.get("tenant_id"),
            "affiliate_code": affiliate_code,
            "affiliate_link": get_affiliate_link(affiliate_code),
            "commission_rate": 20,  # 20% store credit per referral
            "total_referrals": 0,
            "successful_referrals": 0,
            "store_credit": 0,  # Current credit (0-100%)
            "total_credit_earned": 0,  # Lifetime
            "total_credit_used": 0,  # Lifetime
            "status": "active",
            "created_at": now,
            "updated_at": now
        }
        
        await db.affiliates.insert_one(affiliate)
    else:
        # Migrate existing affiliate if needed - add new fields with defaults
        needs_update = False
        updates = {}
        
        if "store_credit" not in affiliate:
            updates["store_credit"] = 0
            needs_update = True
        if "total_credit_earned" not in affiliate:
            updates["total_credit_earned"] = 0
            needs_update = True
        if "total_credit_used" not in affiliate:
            updates["total_credit_used"] = 0
            needs_update = True
        if "tenant_id" not in affiliate:
            updates["tenant_id"] = current_user.get("tenant_id")
            needs_update = True
            
        if needs_update:
            await db.affiliates.update_one(
                {"user_id": user_id},
                {"$set": updates}
            )
            # Merge updates into response
            affiliate = {**affiliate, **updates}
    
    return affiliate

@router.patch("/my", response_model=AffiliateResponse)
async def update_my_affiliate(
    data: AffiliateUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update affiliate settings"""
    user_id = current_user.get("id")
    
    affiliate = await db.affiliates.find_one({"user_id": user_id})
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate account not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.affiliates.update_one(
        {"user_id": user_id},
        {"$set": update_data}
    )
    
    updated = await db.affiliates.find_one({"user_id": user_id}, {"_id": 0})
    return updated

@router.get("/stats", response_model=AffiliateStatsResponse)
async def get_affiliate_stats(current_user: dict = Depends(get_current_user)):
    """Get affiliate statistics"""
    user_id = current_user.get("id")
    tenant_id = current_user.get("tenant_id")
    
    affiliate = await db.affiliates.find_one({"user_id": user_id}, {"_id": 0})
    if not affiliate:
        return AffiliateStatsResponse(
            total_referrals=0,
            successful_referrals=0,
            conversion_rate=0,
            store_credit=0,
            total_credit_earned=0,
            total_credit_used=0,
            this_month_referrals=0,
            this_cycle_successful=0
        )
    
    # Calculate this month stats
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    this_month_referrals = await db.referrals.count_documents({
        "affiliate_id": affiliate["id"],
        "created_at": {"$gte": month_start.isoformat()}
    })
    
    # Get current billing cycle successful referrals
    # Find the user's subscription to get billing cycle dates
    subscription = await db.subscriptions.find_one({"tenant_id": tenant_id}, {"_id": 0})
    cycle_start = subscription.get("current_period_start") if subscription else month_start.isoformat()
    
    this_cycle_successful = await db.referrals.count_documents({
        "affiliate_id": affiliate["id"],
        "status": "converted",
        "converted_at": {"$gte": cycle_start}
    })
    
    conversion_rate = (affiliate["successful_referrals"] / affiliate["total_referrals"] * 100) if affiliate["total_referrals"] > 0 else 0
    
    return AffiliateStatsResponse(
        total_referrals=affiliate["total_referrals"],
        successful_referrals=affiliate["successful_referrals"],
        conversion_rate=round(conversion_rate, 1),
        store_credit=affiliate.get("store_credit", 0),
        total_credit_earned=affiliate.get("total_credit_earned", 0),
        total_credit_used=affiliate.get("total_credit_used", 0),
        this_month_referrals=this_month_referrals,
        this_cycle_successful=this_cycle_successful
    )

@router.get("/referrals", response_model=List[ReferralResponse])
async def get_my_referrals(
    status: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get list of referrals"""
    user_id = current_user.get("id")
    
    affiliate = await db.affiliates.find_one({"user_id": user_id}, {"_id": 0})
    if not affiliate:
        return []
    
    query = {"affiliate_id": affiliate["id"]}
    if status:
        query["status"] = status
    
    referrals = await db.referrals.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return referrals

@router.get("/credit-history")
async def get_credit_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get store credit usage history"""
    user_id = current_user.get("id")
    
    affiliate = await db.affiliates.find_one({"user_id": user_id}, {"_id": 0})
    if not affiliate:
        return []
    
    history = await db.affiliate_credit_history.find(
        {"affiliate_id": affiliate["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return history


# Track referral (called when someone registers with referral code)
@router.post("/track/{affiliate_code}")
async def track_referral(
    affiliate_code: str,
    referred_email: str
):
    """Track a new referral (internal use)"""
    affiliate = await db.affiliates.find_one({"affiliate_code": affiliate_code.upper()}, {"_id": 0})
    if not affiliate:
        return {"tracked": False, "reason": "Invalid affiliate code"}
    
    # Check if email already referred
    existing = await db.referrals.find_one({"referred_email": referred_email})
    if existing:
        return {"tracked": False, "reason": "Email already referred"}
    
    now = datetime.now(timezone.utc).isoformat()
    referral = {
        "id": str(uuid.uuid4()),
        "affiliate_id": affiliate["id"],
        "affiliate_code": affiliate_code.upper(),
        "referred_email": referred_email,
        "status": "pending",
        "plan_name": None,
        "credit_earned": 0,  # Will be set when converted
        "created_at": now,
        "converted_at": None
    }
    
    await db.referrals.insert_one(referral)
    
    # Update affiliate total referrals
    await db.affiliates.update_one(
        {"id": affiliate["id"]},
        {"$inc": {"total_referrals": 1}}
    )
    
    # Mark the referred user as eligible for 20% discount
    await db.referral_discounts.update_one(
        {"email": referred_email},
        {
            "$set": {
                "email": referred_email,
                "referred_by_code": affiliate_code.upper(),
                "referred_by_affiliate_id": affiliate["id"],
                "discount_percentage": 20,
                "used": False,
                "created_at": now
            }
        },
        upsert=True
    )
    
    return {"tracked": True, "referral_id": referral["id"]}


# Check if user has referral discount
@router.get("/check-discount/{email}", response_model=ReferralDiscountResponse)
async def check_referral_discount(email: str):
    """Check if an email has a referral discount (public endpoint for checkout)"""
    discount = await db.referral_discounts.find_one(
        {"email": email, "used": False},
        {"_id": 0}
    )
    
    if discount:
        return ReferralDiscountResponse(
            has_discount=True,
            discount_percentage=discount.get("discount_percentage", 20),
            referred_by_code=discount.get("referred_by_code")
        )
    
    return ReferralDiscountResponse(
        has_discount=False,
        discount_percentage=0,
        referred_by_code=None
    )


# Convert referral (called when referred user subscribes to paid plan)
@router.post("/convert/{referral_id}")
async def convert_referral(
    referral_id: str,
    plan_name: str,
    plan_price: float
):
    """Convert a referral to successful (internal use) - awards store credit"""
    referral = await db.referrals.find_one({"id": referral_id}, {"_id": 0})
    if not referral:
        return {"converted": False, "reason": "Referral not found"}
    
    if referral["status"] == "converted":
        return {"converted": False, "reason": "Already converted"}
    
    affiliate = await db.affiliates.find_one({"id": referral["affiliate_id"]}, {"_id": 0})
    if not affiliate:
        return {"converted": False, "reason": "Affiliate not found"}
    
    # Calculate credit (20% of subscription value as store credit percentage)
    # Each successful referral = 20% credit, max 100% per billing cycle
    credit_to_add = 20  # 20% store credit
    current_credit = affiliate.get("store_credit", 0)
    new_credit = min(current_credit + credit_to_add, 100)  # Cap at 100%
    actual_credit_added = new_credit - current_credit
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update referral
    await db.referrals.update_one(
        {"id": referral_id},
        {"$set": {
            "status": "converted",
            "plan_name": plan_name,
            "credit_earned": actual_credit_added,
            "converted_at": now
        }}
    )
    
    # Update affiliate stats and store credit
    await db.affiliates.update_one(
        {"id": affiliate["id"]},
        {
            "$inc": {
                "successful_referrals": 1,
                "total_credit_earned": actual_credit_added
            },
            "$set": {
                "store_credit": new_credit,
                "updated_at": now
            }
        }
    )
    
    # Log credit history
    await db.affiliate_credit_history.insert_one({
        "id": str(uuid.uuid4()),
        "affiliate_id": affiliate["id"],
        "type": "earned",
        "amount": actual_credit_added,
        "description": f"Referral converted: {plan_name}",
        "referral_id": referral_id,
        "balance_after": new_credit,
        "created_at": now
    })
    
    return {
        "converted": True, 
        "credit_added": actual_credit_added,
        "total_credit": new_credit,
        "capped": actual_credit_added < credit_to_add  # True if we hit the 100% cap
    }


# Apply store credit to renewal (called during subscription renewal)
@router.post("/apply-credit/{tenant_id}")
async def apply_store_credit(tenant_id: str, renewal_amount: float):
    """Apply store credit to subscription renewal (internal use)"""
    
    # Find affiliate by tenant_id
    affiliate = await db.affiliates.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not affiliate or affiliate.get("store_credit", 0) <= 0:
        return {
            "applied": False,
            "credit_used": 0,
            "discount_amount": 0,
            "final_amount": renewal_amount
        }
    
    credit_percentage = affiliate.get("store_credit", 0)
    discount_amount = renewal_amount * (credit_percentage / 100)
    final_amount = max(renewal_amount - discount_amount, 0)
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Reset store credit after use
    await db.affiliates.update_one(
        {"id": affiliate["id"]},
        {
            "$set": {
                "store_credit": 0,  # Reset after renewal
                "updated_at": now
            },
            "$inc": {
                "total_credit_used": credit_percentage
            }
        }
    )
    
    # Log credit usage
    await db.affiliate_credit_history.insert_one({
        "id": str(uuid.uuid4()),
        "affiliate_id": affiliate["id"],
        "type": "used",
        "amount": credit_percentage,
        "description": f"Applied to subscription renewal (${discount_amount:.2f} off)",
        "balance_after": 0,
        "created_at": now
    })
    
    return {
        "applied": True,
        "credit_used": credit_percentage,
        "discount_amount": round(discount_amount, 2),
        "final_amount": round(final_amount, 2)
    }


# Mark referral discount as used
@router.post("/use-discount/{email}")
async def use_referral_discount(email: str, plan_name: str, original_price: float):
    """Mark referral discount as used and convert the referral (internal use)"""
    
    discount = await db.referral_discounts.find_one({"email": email, "used": False}, {"_id": 0})
    if not discount:
        return {"used": False, "reason": "No discount available"}
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Mark discount as used
    await db.referral_discounts.update_one(
        {"email": email},
        {"$set": {"used": True, "used_at": now}}
    )
    
    # Find and convert the referral
    referral = await db.referrals.find_one({
        "referred_email": email,
        "status": "pending"
    }, {"_id": 0})
    
    if referral:
        # Convert the referral (awards credit to referrer)
        result = await convert_referral(referral["id"], plan_name, original_price)
        return {
            "used": True,
            "discount_percentage": discount["discount_percentage"],
            "referral_converted": result.get("converted", False),
            "referrer_credit_added": result.get("credit_added", 0)
        }
    
    return {
        "used": True,
        "discount_percentage": discount["discount_percentage"],
        "referral_converted": False
    }


# Admin endpoints
@router.get("/admin/all", response_model=List[AffiliateResponse])
async def get_all_affiliates(
    status: Optional[str] = None,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Get all affiliates (Super Admin only)"""
    query = {}
    if status:
        query["status"] = status
    
    affiliates = await db.affiliates.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return affiliates

@router.get("/admin/stats")
async def get_admin_affiliate_stats(admin_user: dict = Depends(get_super_admin_user)):
    """Get platform-wide affiliate statistics (Super Admin only)"""
    
    total_affiliates = await db.affiliates.count_documents({})
    total_referrals = await db.referrals.count_documents({})
    converted_referrals = await db.referrals.count_documents({"status": "converted"})
    
    # Total credit outstanding
    pipeline = [
        {"$group": {
            "_id": None,
            "total_credit": {"$sum": "$store_credit"},
            "total_earned": {"$sum": "$total_credit_earned"},
            "total_used": {"$sum": "$total_credit_used"}
        }}
    ]
    credit_stats = await db.affiliates.aggregate(pipeline).to_list(1)
    
    return {
        "total_affiliates": total_affiliates,
        "total_referrals": total_referrals,
        "converted_referrals": converted_referrals,
        "conversion_rate": round((converted_referrals / total_referrals * 100), 1) if total_referrals > 0 else 0,
        "total_credit_outstanding": credit_stats[0]["total_credit"] if credit_stats else 0,
        "total_credit_earned": credit_stats[0]["total_earned"] if credit_stats else 0,
        "total_credit_used": credit_stats[0]["total_used"] if credit_stats else 0
    }


# Settings endpoint
@router.get("/settings")
async def get_affiliate_settings():
    """Get public affiliate program settings"""
    settings = await db.platform_settings.find_one({"key": "affiliate_settings"}, {"_id": 0})
    
    default_settings = {
        "commission_rate": 20,  # 20% store credit per referral
        "max_credit_per_cycle": 100,  # Max 100% credit (5 referrals)
        "referral_discount": 20,  # 20% off for referred users
        "cookie_duration_days": 30,
        "program_enabled": True
    }
    
    if settings and settings.get("value"):
        return {**default_settings, **settings["value"]}
    
    return default_settings
