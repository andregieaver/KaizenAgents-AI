import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

async def create_homepage():
    """
    Creates the homepage page in the database using the block-based CMS structure.
    This replicates the content from the original Landing.js file.
    """
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'ai_support_hub')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Delete existing homepage if it exists
    await db.pages.delete_one({"slug": "homepage"})
    
    # Create the homepage content with blocks
    homepage = {
        "slug": "homepage",
        "title": "Home - AI Support Platform",
        "is_published": True,
        "is_static": True,  # Static page, not editable in CMS
        "content": [
            # Hero Block
            {
                "id": "hero_1",
                "type": "hero",
                "content": {
                    "badge": "Powered by GPT-4o",
                    "heading": "AI-first customer support that ",
                    "highlight": "actually works",
                    "description": "Deploy intelligent support in minutes. Our AI handles 85% of inquiries instantly, while your team focuses on what matters.",
                    "primaryButton": {
                        "text": "Start for free",
                        "url": "/pricing"
                    },
                    "secondaryButton": {
                        "text": "See demo",
                        "url": "/widget-demo"
                    },
                    "imageUrl": "https://images.unsplash.com/photo-1737505599162-d9932323a889?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2Mzl8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHRlY2hub2xvZ3klMjBjb25uZWN0aW9uJTIwbm9kZXN8ZW58MHx8fHwxNzY1Mzg3MTA2fDA&ixlib=rb-4.1.0&q=85"
                }
            },
            # Features Block
            {
                "id": "features_1",
                "type": "features",
                "content": {
                    "heading": "Everything you need",
                    "description": "A complete support platform that grows with your business",
                    "features": [
                        {
                            "id": "feat_1",
                            "icon": "Bot",
                            "title": "AI-Powered Responses",
                            "description": "GPT-4o powered responses that understand context and provide accurate answers 24/7."
                        },
                        {
                            "id": "feat_2",
                            "icon": "Users",
                            "title": "Human Handoff",
                            "description": "Seamlessly escalate to human agents when AI can't help. Never lose a conversation."
                        },
                        {
                            "id": "feat_3",
                            "icon": "Code",
                            "title": "Easy Integration",
                            "description": "Add our widget to any website with a single line of code. Works everywhere."
                        },
                        {
                            "id": "feat_4",
                            "icon": "Zap",
                            "title": "Instant Setup",
                            "description": "Get started in minutes, not weeks. No complex configuration required."
                        },
                        {
                            "id": "feat_5",
                            "icon": "Shield",
                            "title": "Secure & Private",
                            "description": "Your data stays yours. Enterprise-grade security with full compliance."
                        },
                        {
                            "id": "feat_6",
                            "icon": "BarChart3",
                            "title": "Analytics Dashboard",
                            "description": "Track performance, response times, and customer satisfaction in real-time."
                        }
                    ]
                }
            },
            # CTA Block
            {
                "id": "cta_1",
                "type": "cta",
                "content": {
                    "heading": "Ready to transform your support?",
                    "description": "Join hundreds of businesses using our platform to deliver exceptional customer experiences.",
                    "buttonText": "Get started free",
                    "buttonUrl": "/pricing"
                }
            }
        ],
        "seo_title": "AI Support Platform - Transform Your Customer Support",
        "seo_description": "Deploy intelligent AI-powered customer support in minutes. Handle 85% of inquiries automatically while your team focuses on what matters.",
        "seo_keywords": ["AI support", "customer service", "chatbot", "automation", "GPT-4"],
        "canonical_url": "",
        "og_title": "AI Support Platform - Transform Your Customer Support",
        "og_description": "Deploy intelligent AI-powered customer support in minutes.",
        "og_image": "",
        "twitter_card": "summary_large_image",
        "twitter_title": "",
        "twitter_description": "",
        "no_index": False,
        "no_follow": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Insert the homepage
    result = await db.pages.insert_one(homepage)
    
    print(f"✅ Homepage created successfully with ID: {result.inserted_id}")
    print("   Slug: homepage")
    print("   Blocks: Hero, Features (6 items), CTA")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_homepage())
