"""
Affiliate program management routes
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
class AffiliateRegister(BaseModel):
    payment_email: Optional[str] = None
    payment_method: Literal["paypal", "bank_transfer", "crypto"] = "paypal"

class AffiliateUpdate(BaseModel):
    payment_email: Optional[str] = None
    payment_method: Optional[Literal["paypal", "bank_transfer", "crypto"]] = None

class AffiliateResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    affiliate_code: str
    affiliate_link: str
    payment_email: Optional[str]
    payment_method: str
    commission_rate: float
    total_referrals: int
    successful_referrals: int
    total_earnings: float
    pending_earnings: float
    paid_earnings: float
    status: str
    created_at: str

class ReferralResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    referred_email: str
    status: str
    plan_name: Optional[str]
    commission_amount: float
    created_at: str
    converted_at: Optional[str]

class PayoutRequest(BaseModel):
    amount: Optional[float] = None  # None = request all pending

class PayoutResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    amount: float
    status: str
    payment_method: str
    payment_email: Optional[str]
    requested_at: str
    processed_at: Optional[str]
    notes: Optional[str]

class AffiliateStatsResponse(BaseModel):
    total_referrals: int
    successful_referrals: int
    conversion_rate: float
    total_earnings: float
    pending_earnings: float
    paid_earnings: float
    this_month_referrals: int
    this_month_earnings: float

# Helper functions
def generate_affiliate_code(user_id: str) -> str:
    """Generate a unique affiliate code based on user_id"""
    hash_input = f"{user_id}-{datetime.now().timestamp()}"
    return hashlib.md5(hash_input.encode()).hexdigest()[:8].upper()

def get_affiliate_link(code: str) -> str:
    """Generate affiliate link"""
    # This should be configured from environment/settings
    base_url = "https://app.example.com"  # Will be replaced with actual domain
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
        
        # Get platform settings for commission rate
        settings = await db.platform_settings.find_one({"key": "affiliate_settings"}, {"_id": 0})
        commission_rate = settings.get("value", {}).get("default_commission_rate", 20) if settings else 20
        
        now = datetime.now(timezone.utc).isoformat()
        affiliate = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "affiliate_code": affiliate_code,
            "affiliate_link": get_affiliate_link(affiliate_code),
            "payment_email": current_user.get("email"),
            "payment_method": "paypal",
            "commission_rate": commission_rate,
            "total_referrals": 0,
            "successful_referrals": 0,
            "total_earnings": 0,
            "pending_earnings": 0,
            "paid_earnings": 0,
            "status": "active",
            "created_at": now,
            "updated_at": now
        }
        
        await db.affiliates.insert_one(affiliate)
    
    return affiliate

@router.patch("/my", response_model=AffiliateResponse)
async def update_my_affiliate(
    data: AffiliateUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update affiliate payment settings"""
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
    
    affiliate = await db.affiliates.find_one({"user_id": user_id}, {"_id": 0})
    if not affiliate:
        # Return empty stats if no affiliate account
        return AffiliateStatsResponse(
            total_referrals=0,
            successful_referrals=0,
            conversion_rate=0,
            total_earnings=0,
            pending_earnings=0,
            paid_earnings=0,
            this_month_referrals=0,
            this_month_earnings=0
        )
    
    # Calculate this month stats
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    this_month_referrals = await db.referrals.count_documents({
        "affiliate_id": affiliate["id"],
        "created_at": {"$gte": month_start.isoformat()}
    })
    
    this_month_earnings_cursor = db.referrals.aggregate([
        {
            "$match": {
                "affiliate_id": affiliate["id"],
                "status": "converted",
                "converted_at": {"$gte": month_start.isoformat()}
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$commission_amount"}
            }
        }
    ])
    this_month_earnings_result = await this_month_earnings_cursor.to_list(1)
    this_month_earnings = this_month_earnings_result[0]["total"] if this_month_earnings_result else 0
    
    conversion_rate = (affiliate["successful_referrals"] / affiliate["total_referrals"] * 100) if affiliate["total_referrals"] > 0 else 0
    
    return AffiliateStatsResponse(
        total_referrals=affiliate["total_referrals"],
        successful_referrals=affiliate["successful_referrals"],
        conversion_rate=round(conversion_rate, 1),
        total_earnings=affiliate["total_earnings"],
        pending_earnings=affiliate["pending_earnings"],
        paid_earnings=affiliate["paid_earnings"],
        this_month_referrals=this_month_referrals,
        this_month_earnings=this_month_earnings
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

@router.get("/payouts", response_model=List[PayoutResponse])
async def get_my_payouts(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get payout history"""
    user_id = current_user.get("id")
    
    affiliate = await db.affiliates.find_one({"user_id": user_id}, {"_id": 0})
    if not affiliate:
        return []
    
    payouts = await db.affiliate_payouts.find(
        {"affiliate_id": affiliate["id"]},
        {"_id": 0}
    ).sort("requested_at", -1).to_list(limit)
    
    return payouts

@router.post("/payouts/request", response_model=PayoutResponse)
async def request_payout(
    request: PayoutRequest,
    current_user: dict = Depends(get_current_user)
):
    """Request a payout of pending earnings"""
    user_id = current_user.get("id")
    
    affiliate = await db.affiliates.find_one({"user_id": user_id}, {"_id": 0})
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate account not found")
    
    # Get minimum payout amount from settings
    settings = await db.platform_settings.find_one({"key": "affiliate_settings"}, {"_id": 0})
    min_payout = settings.get("value", {}).get("min_payout_amount", 50) if settings else 50
    
    # Determine payout amount
    payout_amount = request.amount if request.amount else affiliate["pending_earnings"]
    
    if payout_amount <= 0:
        raise HTTPException(status_code=400, detail="No pending earnings to withdraw")
    
    if payout_amount > affiliate["pending_earnings"]:
        raise HTTPException(status_code=400, detail="Insufficient pending earnings")
    
    if payout_amount < min_payout:
        raise HTTPException(status_code=400, detail=f"Minimum payout amount is ${min_payout}")
    
    # Check for pending payout request
    existing_pending = await db.affiliate_payouts.find_one({
        "affiliate_id": affiliate["id"],
        "status": "pending"
    })
    if existing_pending:
        raise HTTPException(status_code=400, detail="You already have a pending payout request")
    
    now = datetime.now(timezone.utc).isoformat()
    payout = {
        "id": str(uuid.uuid4()),
        "affiliate_id": affiliate["id"],
        "user_id": user_id,
        "amount": payout_amount,
        "status": "pending",
        "payment_method": affiliate["payment_method"],
        "payment_email": affiliate["payment_email"],
        "requested_at": now,
        "processed_at": None,
        "notes": None
    }
    
    await db.affiliate_payouts.insert_one(payout)
    
    # Update affiliate pending earnings
    await db.affiliates.update_one(
        {"user_id": user_id},
        {"$inc": {"pending_earnings": -payout_amount}}
    )
    
    return payout

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
        "commission_amount": 0,
        "created_at": now,
        "converted_at": None
    }
    
    await db.referrals.insert_one(referral)
    
    # Update affiliate total referrals
    await db.affiliates.update_one(
        {"id": affiliate["id"]},
        {"$inc": {"total_referrals": 1}}
    )
    
    return {"tracked": True, "referral_id": referral["id"]}

# Convert referral (called when referred user subscribes to paid plan)
@router.post("/convert/{referral_id}")
async def convert_referral(
    referral_id: str,
    plan_name: str,
    plan_price: float
):
    """Convert a referral to successful (internal use)"""
    referral = await db.referrals.find_one({"id": referral_id}, {"_id": 0})
    if not referral:
        return {"converted": False, "reason": "Referral not found"}
    
    if referral["status"] == "converted":
        return {"converted": False, "reason": "Already converted"}
    
    affiliate = await db.affiliates.find_one({"id": referral["affiliate_id"]}, {"_id": 0})
    if not affiliate:
        return {"converted": False, "reason": "Affiliate not found"}
    
    # Calculate commission
    commission = plan_price * (affiliate["commission_rate"] / 100)
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update referral
    await db.referrals.update_one(
        {"id": referral_id},
        {"$set": {
            "status": "converted",
            "plan_name": plan_name,
            "commission_amount": commission,
            "converted_at": now
        }}
    )
    
    # Update affiliate stats
    await db.affiliates.update_one(
        {"id": affiliate["id"]},
        {
            "$inc": {
                "successful_referrals": 1,
                "total_earnings": commission,
                "pending_earnings": commission
            }
        }
    )
    
    return {"converted": True, "commission": commission}

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

@router.get("/admin/payouts/pending", response_model=List[PayoutResponse])
async def get_pending_payouts(admin_user: dict = Depends(get_super_admin_user)):
    """Get all pending payout requests (Super Admin only)"""
    payouts = await db.affiliate_payouts.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("requested_at", 1).to_list(100)
    
    return payouts

@router.patch("/admin/payouts/{payout_id}")
async def process_payout(
    payout_id: str,
    status: Literal["approved", "rejected", "completed"],
    notes: Optional[str] = None,
    admin_user: dict = Depends(get_super_admin_user)
):
    """Process a payout request (Super Admin only)"""
    payout = await db.affiliate_payouts.find_one({"id": payout_id})
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    update_data = {
        "status": status,
        "processed_at": now
    }
    if notes:
        update_data["notes"] = notes
    
    await db.affiliate_payouts.update_one(
        {"id": payout_id},
        {"$set": update_data}
    )
    
    # If completed, update paid earnings
    if status == "completed":
        await db.affiliates.update_one(
            {"id": payout["affiliate_id"]},
            {"$inc": {"paid_earnings": payout["amount"]}}
        )
    
    # If rejected, restore pending earnings
    if status == "rejected":
        await db.affiliates.update_one(
            {"id": payout["affiliate_id"]},
            {"$inc": {"pending_earnings": payout["amount"]}}
        )
    
    return {"message": f"Payout {status}"}

# Settings endpoint
@router.get("/settings")
async def get_affiliate_settings():
    """Get public affiliate program settings"""
    settings = await db.platform_settings.find_one({"key": "affiliate_settings"}, {"_id": 0})
    
    default_settings = {
        "default_commission_rate": 20,
        "min_payout_amount": 50,
        "cookie_duration_days": 30,
        "program_enabled": True
    }
    
    if settings and settings.get("value"):
        return {**default_settings, **settings["value"]}
    
    return default_settings
