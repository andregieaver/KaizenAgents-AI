"""
Database Indexes and Initialization

Run this once during deployment to ensure all indexes are created.
This improves query performance significantly at scale.
"""
import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
import os

logger = logging.getLogger(__name__)

# Index definitions for each collection
INDEXES = {
    "users": [
        {"keys": [("email", 1)], "unique": True},
        {"keys": [("tenant_id", 1)]},
        {"keys": [("id", 1)], "unique": True},
    ],
    "tenants": [
        {"keys": [("id", 1)], "unique": True},
        {"keys": [("slug", 1)], "unique": True},
    ],
    "conversations": [
        {"keys": [("id", 1)], "unique": True},
        {"keys": [("tenant_id", 1)]},
        {"keys": [("tenant_id", 1), ("status", 1)]},
        {"keys": [("tenant_id", 1), ("created_at", -1)]},
        {"keys": [("customer_email", 1)]},
    ],
    "messages": [
        {"keys": [("conversation_id", 1)]},
        {"keys": [("conversation_id", 1), ("created_at", 1)]},
    ],
    "user_agents": [
        {"keys": [("id", 1)], "unique": True},
        {"keys": [("tenant_id", 1)]},
        {"keys": [("tenant_id", 1), ("is_active", 1)]},
    ],
    "agents": [
        {"keys": [("id", 1)], "unique": True},
        {"keys": [("is_active", 1)]},
        {"keys": [("category", 1)]},
    ],
    "crm_customers": [
        {"keys": [("id", 1)], "unique": True},
        {"keys": [("tenant_id", 1)]},
        {"keys": [("tenant_id", 1), ("email", 1)]},
        {"keys": [("tenant_id", 1), ("status", 1)]},
    ],
    "crm_followups": [
        {"keys": [("id", 1)], "unique": True},
        {"keys": [("tenant_id", 1)]},
        {"keys": [("tenant_id", 1), ("status", 1)]},
        {"keys": [("customer_id", 1)]},
    ],
    "providers": [
        {"keys": [("id", 1)], "unique": True},
        {"keys": [("tenant_id", 1)]},
        {"keys": [("type", 1)]},
    ],
    "settings": [
        {"keys": [("tenant_id", 1)], "unique": True},
    ],
    "company_agent_configs": [
        {"keys": [("company_id", 1)], "unique": True},
    ],
    "agent_documents": [
        {"keys": [("agent_id", 1)]},
        {"keys": [("tenant_id", 1)]},
        {"keys": [("agent_id", 1), ("tenant_id", 1)]},
    ],
    "knowledge_chunks": [
        {"keys": [("agent_id", 1)]},
        {"keys": [("tenant_id", 1)]},
        {"keys": [("agent_id", 1), ("tenant_id", 1)]},
    ],
    "orchestration_runs": [
        {"keys": [("id", 1)], "unique": True},
        {"keys": [("tenant_id", 1)]},
        {"keys": [("tenant_id", 1), ("created_at", -1)]},
    ],
    "verification_codes": [
        {"keys": [("conversation_id", 1)]},
        {"keys": [("created_at", 1)], "expireAfterSeconds": 3600},  # TTL index - auto-delete after 1 hour
    ],
    "rate_limits": [
        {"keys": [("key", 1)], "unique": True},
        {"keys": [("expires_at", 1)], "expireAfterSeconds": 0},  # TTL index
    ],
    "platform_settings": [
        {"keys": [("key", 1)], "unique": True},
    ],
    "subscriptions": [
        {"keys": [("tenant_id", 1)]},
        {"keys": [("stripe_subscription_id", 1)]},
    ],
    "quota_alerts": [
        {"keys": [("tenant_id", 1), ("feature_key", 1), ("alert_type", 1)]},
    ],
}


async def create_indexes(db):
    """Create all indexes for the database"""
    logger.info("Starting index creation...")
    
    for collection_name, indexes in INDEXES.items():
        collection = db[collection_name]
        
        for index_def in indexes:
            try:
                keys = index_def["keys"]
                options = {k: v for k, v in index_def.items() if k != "keys"}
                
                # Create the index
                index_name = await collection.create_index(keys, **options)
                logger.info(f"Created index '{index_name}' on {collection_name}")
                
            except Exception as e:
                # Index might already exist, which is fine
                if "already exists" in str(e).lower():
                    logger.debug(f"Index already exists on {collection_name}: {keys}")
                else:
                    logger.warning(f"Failed to create index on {collection_name}: {e}")
    
    logger.info("Index creation complete!")


async def verify_indexes(db):
    """Verify all indexes exist"""
    logger.info("Verifying indexes...")
    
    missing = []
    for collection_name, indexes in INDEXES.items():
        collection = db[collection_name]
        existing_indexes = await collection.index_information()
        
        for index_def in indexes:
            keys = index_def["keys"]
            key_str = "_".join([f"{k}_{v}" for k, v in keys])
            
            # Check if index exists (simplified check)
            found = any(key_str in idx_name for idx_name in existing_indexes.keys())
            if not found:
                missing.append(f"{collection_name}.{key_str}")
    
    if missing:
        logger.warning(f"Missing indexes: {missing}")
    else:
        logger.info("All indexes verified!")
    
    return missing


async def main():
    """Main function to run index creation"""
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_db")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    await create_indexes(db)
    missing = await verify_indexes(db)
    
    client.close()
    
    return len(missing) == 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    success = asyncio.run(main())
    exit(0 if success else 1)
