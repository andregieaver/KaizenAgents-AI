"""
Seed default subscription plans
Run this once: python seed_plans.py
"""
import asyncio
from datetime import datetime, timezone
import uuid
from middleware.database import db

default_plans = [
    {
        "id": str(uuid.uuid4()),
        "name": "Free",
        "description": "Perfect for trying out our platform",
        "price_monthly": 0,
        "price_yearly": 0,
        "features": {
            "max_conversations": 50,
            "max_agents": 1,
            "analytics_enabled": True,
            "api_access": False,
            "support_level": "email",
            "conversation_history_days": 30,
            "remove_branding": False,
            "custom_integrations": False
        },
        "is_public": True,
        "sort_order": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Starter",
        "description": "Great for small teams getting started",
        "price_monthly": 29,
        "price_yearly": 278.40,  # 20% discount (29 * 12 * 0.8)
        "features": {
            "max_conversations": 500,
            "max_agents": 3,
            "analytics_enabled": True,
            "api_access": False,
            "support_level": "priority",
            "conversation_history_days": 30,
            "remove_branding": True,
            "custom_integrations": False
        },
        "is_public": True,
        "sort_order": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Professional",
        "description": "For growing businesses with advanced needs",
        "price_monthly": 99,
        "price_yearly": 950.40,  # 20% discount
        "features": {
            "max_conversations": 2000,
            "max_agents": 10,
            "analytics_enabled": True,
            "api_access": True,
            "support_level": "priority",
            "conversation_history_days": 365,
            "remove_branding": True,
            "custom_integrations": False
        },
        "is_public": True,
        "sort_order": 2,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Enterprise",
        "description": "Unlimited power for large organizations",
        "price_monthly": 299,
        "price_yearly": 2870.40,  # 20% discount
        "features": {
            "max_conversations": None,  # Unlimited
            "max_agents": None,  # Unlimited
            "analytics_enabled": True,
            "api_access": True,
            "support_level": "premium",
            "conversation_history_days": None,  # Unlimited
            "remove_branding": True,
            "custom_integrations": True
        },
        "is_public": True,
        "sort_order": 3,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
]

default_settings = {
    "key": "subscription_settings",
    "value": {
        "trial_days": 30,
        "yearly_discount_percent": 20,
        "soft_limit_threshold": 90
    },
    "created_at": datetime.now(timezone.utc).isoformat(),
    "updated_at": datetime.now(timezone.utc).isoformat()
}

async def seed_plans():
    """Seed subscription plans into database"""
    print("🌱 Seeding subscription plans...")
    
    # Check if plans already exist
    existing_count = await db.subscription_plans.count_documents({})
    if existing_count > 0:
        print(f"⚠️  Found {existing_count} existing plans. Clearing...")
        await db.subscription_plans.delete_many({})
    
    # Insert all plans
    await db.subscription_plans.insert_many(default_plans)
    
    # Insert platform settings
    await db.platform_settings.update_one(
        {"key": "subscription_settings"},
        {"$set": default_settings},
        upsert=True
    )
    
    print(f"✅ Successfully seeded {len(default_plans)} subscription plans!")
    print("\nPlans created:")
    for plan in default_plans:
        print(f"  • {plan['name']}: ${plan['price_monthly']}/mo (${plan['price_yearly']}/yr)")
        print(f"    - {plan['features']['max_conversations'] or 'Unlimited'} conversations")
        print(f"    - {plan['features']['max_agents'] or 'Unlimited'} agents")
    
    print("\n✅ Platform settings configured:")
    print(f"  • Trial period: {default_settings['value']['trial_days']} days")
    print(f"  • Yearly discount: {default_settings['value']['yearly_discount_percent']}%")
    print(f"  • Soft limit threshold: {default_settings['value']['soft_limit_threshold']}%")

if __name__ == "__main__":
    asyncio.run(seed_plans())
