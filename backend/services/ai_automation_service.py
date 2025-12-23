"""
AI Automation Service - Intelligent automation for CRM and conversations

Features:
1. Conversation Summary - Auto-generate summary when conversation resolves
2. Smart Follow-up Suggestions - AI suggests follow-up type and timing
3. Lead Scoring - Score customers based on conversation analysis
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
from uuid import uuid4

from middleware.database import db

logger = logging.getLogger(__name__)


# Lead scoring weights
LEAD_SCORE_WEIGHTS = {
    "message_count": 2,          # More engagement = higher score
    "response_rate": 15,         # Customer responds quickly
    "sentiment_positive": 20,    # Positive sentiment
    "sentiment_negative": -15,   # Negative sentiment
    "purchase_intent": 25,       # Shows buying interest
    "verified_email": 10,        # Email verified
    "returning_customer": 15,    # Has multiple conversations
    "resolved_quickly": 10,      # Issue resolved quickly
}

# Purchase intent keywords
PURCHASE_INTENT_KEYWORDS = [
    "buy", "purchase", "order", "price", "cost", "how much",
    "discount", "deal", "available", "in stock", "shipping",
    "checkout", "payment", "subscribe", "plan", "upgrade"
]

# Negative sentiment keywords
NEGATIVE_KEYWORDS = [
    "angry", "frustrated", "terrible", "horrible", "worst",
    "hate", "useless", "stupid", "ridiculous", "disappointed",
    "complaint", "refund", "cancel", "problem", "issue", "bug"
]

# Positive sentiment keywords  
POSITIVE_KEYWORDS = [
    "thanks", "thank you", "great", "excellent", "awesome",
    "helpful", "perfect", "amazing", "love", "appreciate",
    "wonderful", "fantastic", "good", "happy", "satisfied"
]


class AIAutomationService:
    """Service for AI-powered CRM automation"""
    
    # ==================== CONVERSATION SUMMARY ====================
    
    @staticmethod
    async def generate_conversation_summary(
        conversation_id: str,
        tenant_id: str,
        use_ai: bool = True
    ) -> Dict[str, Any]:
        """
        Generate a summary of a conversation
        
        Args:
            conversation_id: The conversation to summarize
            tenant_id: Tenant ID for context
            use_ai: Whether to use AI for summary (falls back to rule-based)
            
        Returns:
            Dict with summary, key_points, sentiment, and suggested_actions
        """
        try:
            # Get conversation and messages
            conversation = await db.conversations.find_one(
                {"id": conversation_id, "tenant_id": tenant_id},
                {"_id": 0}
            )
            if not conversation:
                return {"error": "Conversation not found"}
            
            messages = await db.messages.find(
                {"conversation_id": conversation_id},
                {"_id": 0}
            ).sort("created_at", 1).to_list(100)
            
            if not messages:
                return {"error": "No messages in conversation"}
            
            # Analyze messages
            customer_messages = [m for m in messages if m.get("author_type") == "customer"]
            ai_messages = [m for m in messages if m.get("author_type") in ["ai", "agent"]]
            
            # Calculate basic metrics
            total_messages = len(messages)
            customer_message_count = len(customer_messages)
            
            # Detect topics and sentiment
            all_customer_text = " ".join([m.get("content", "") for m in customer_messages]).lower()
            
            # Detect purchase intent
            has_purchase_intent = any(kw in all_customer_text for kw in PURCHASE_INTENT_KEYWORDS)
            
            # Detect sentiment
            positive_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in all_customer_text)
            negative_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in all_customer_text)
            
            if positive_count > negative_count:
                overall_sentiment = "positive"
            elif negative_count > positive_count:
                overall_sentiment = "negative"
            else:
                overall_sentiment = "neutral"
            
            # Extract key topics
            key_topics = []
            topic_keywords = {
                "order_inquiry": ["order", "shipping", "delivery", "tracking"],
                "product_question": ["product", "item", "feature", "specification"],
                "pricing": ["price", "cost", "discount", "deal"],
                "support": ["help", "problem", "issue", "not working"],
                "account": ["account", "login", "password", "profile"],
                "refund": ["refund", "return", "cancel", "money back"]
            }
            
            for topic, keywords in topic_keywords.items():
                if any(kw in all_customer_text for kw in keywords):
                    key_topics.append(topic)
            
            # Generate summary text
            if use_ai:
                summary_text = await AIAutomationService._generate_ai_summary(
                    messages, conversation, tenant_id
                )
            else:
                summary_text = AIAutomationService._generate_rule_based_summary(
                    conversation, messages, key_topics, overall_sentiment
                )
            
            # Generate key points
            key_points = []
            if has_purchase_intent:
                key_points.append("Customer showed purchase interest")
            if "support" in key_topics:
                key_points.append("Customer needed support assistance")
            if "refund" in key_topics:
                key_points.append("Customer inquired about refund/return")
            if conversation.get("status") == "resolved":
                key_points.append("Issue was resolved")
            if overall_sentiment == "positive":
                key_points.append("Customer had positive experience")
            elif overall_sentiment == "negative":
                key_points.append("Customer expressed frustration")
            
            # Suggest follow-up actions
            suggested_actions = []
            if has_purchase_intent and conversation.get("status") != "resolved":
                suggested_actions.append({
                    "action": "follow_up_sale",
                    "description": "Follow up on purchase interest",
                    "priority": "high"
                })
            if overall_sentiment == "negative":
                suggested_actions.append({
                    "action": "satisfaction_check",
                    "description": "Check customer satisfaction",
                    "priority": "high"
                })
            if conversation.get("status") == "resolved":
                suggested_actions.append({
                    "action": "feedback_request",
                    "description": "Request feedback on support experience",
                    "priority": "medium"
                })
            
            return {
                "summary": summary_text,
                "key_points": key_points[:5],
                "topics": key_topics,
                "sentiment": overall_sentiment,
                "metrics": {
                    "total_messages": total_messages,
                    "customer_messages": customer_message_count,
                    "duration_minutes": AIAutomationService._calculate_duration(messages),
                    "has_purchase_intent": has_purchase_intent
                },
                "suggested_actions": suggested_actions,
                "generated_at": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating conversation summary: {str(e)}")
            return {"error": str(e)}
    
    @staticmethod
    def _generate_rule_based_summary(
        conversation: dict,
        messages: list,
        topics: list,
        sentiment: str
    ) -> str:
        """Generate a rule-based summary when AI is not available"""
        customer_name = conversation.get("customer_name", "Customer")
        status = conversation.get("status", "open")
        mode = conversation.get("mode", "ai")
        
        topic_text = ", ".join(topics) if topics else "general inquiry"
        
        summary = f"{customer_name} contacted via {conversation.get('source', 'chat')} "
        summary += f"regarding {topic_text}. "
        
        if mode == "agent":
            summary += "Conversation was handled by a human agent. "
        else:
            summary += "Conversation was handled by AI assistant. "
        
        if status == "resolved":
            summary += f"The matter was resolved. "
        elif status == "waiting":
            summary += "Awaiting customer response. "
        else:
            summary += "Conversation is still open. "
        
        summary += f"Overall sentiment was {sentiment}."
        
        return summary
    
    @staticmethod
    async def _generate_ai_summary(
        messages: list,
        conversation: dict,
        tenant_id: str
    ) -> str:
        """Generate AI-powered summary using configured provider"""
        try:
            # Get agent config for AI provider
            agent_config = await db.company_agent_configs.find_one(
                {"company_id": tenant_id},
                {"_id": 0}
            )
            
            if not agent_config or not agent_config.get("agent_id"):
                return AIAutomationService._generate_rule_based_summary(
                    conversation, messages, [], "neutral"
                )
            
            # Get provider
            agent = await db.agents.find_one(
                {"id": agent_config["agent_id"]},
                {"_id": 0}
            )
            if not agent:
                agent = await db.user_agents.find_one(
                    {"id": agent_config["agent_id"]},
                    {"_id": 0}
                )
            
            if not agent:
                return AIAutomationService._generate_rule_based_summary(
                    conversation, messages, [], "neutral"
                )
            
            provider = await db.providers.find_one(
                {"id": agent["provider_id"]},
                {"_id": 0}
            )
            
            if not provider:
                return AIAutomationService._generate_rule_based_summary(
                    conversation, messages, [], "neutral"
                )
            
            # Format messages for AI
            formatted_messages = []
            for msg in messages[-20:]:  # Last 20 messages
                role = "Customer" if msg.get("author_type") == "customer" else "Support"
                formatted_messages.append(f"{role}: {msg.get('content', '')}")
            
            conversation_text = "\n".join(formatted_messages)
            
            # Generate summary with AI
            prompt = f"""Summarize this customer support conversation in 2-3 sentences. Focus on:
- What the customer needed
- How it was handled
- The outcome

Conversation:
{conversation_text}

Summary:"""
            
            if provider["type"] == "openai":
                import openai
                client = openai.OpenAI(api_key=provider["api_key"])
                
                response = client.chat.completions.create(
                    model="gpt-4o-mini",  # Use fast model for summaries
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=150,
                    temperature=0.3
                )
                return response.choices[0].message.content.strip()
            
            # Fallback for other providers
            return AIAutomationService._generate_rule_based_summary(
                conversation, messages, [], "neutral"
            )
            
        except Exception as e:
            logger.error(f"AI summary generation failed: {str(e)}")
            return AIAutomationService._generate_rule_based_summary(
                conversation, messages, [], "neutral"
            )
    
    @staticmethod
    def _calculate_duration(messages: list) -> int:
        """Calculate conversation duration in minutes"""
        if len(messages) < 2:
            return 0
        
        try:
            first = datetime.fromisoformat(messages[0]["created_at"].replace('Z', '+00:00'))
            last = datetime.fromisoformat(messages[-1]["created_at"].replace('Z', '+00:00'))
            return int((last - first).total_seconds() / 60)
        except:
            return 0
    
    # ==================== SMART FOLLOW-UP SUGGESTIONS ====================
    
    @staticmethod
    async def suggest_followup(
        conversation_id: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """
        Analyze conversation and suggest appropriate follow-up
        
        Returns:
            Dict with follow-up type, timing, priority, and message template
        """
        try:
            # Get conversation summary first
            summary = await AIAutomationService.generate_conversation_summary(
                conversation_id, tenant_id, use_ai=False
            )
            
            if "error" in summary:
                return summary
            
            conversation = await db.conversations.find_one(
                {"id": conversation_id, "tenant_id": tenant_id},
                {"_id": 0}
            )
            
            sentiment = summary.get("sentiment", "neutral")
            has_purchase_intent = summary.get("metrics", {}).get("has_purchase_intent", False)
            status = conversation.get("status", "open")
            topics = summary.get("topics", [])
            
            # Determine follow-up type and timing
            followup = {
                "type": "general_check",
                "priority": "medium",
                "timing": "3_days",
                "timing_hours": 72,
                "reason": "Standard follow-up",
                "message_template": ""
            }
            
            # High priority: Negative sentiment
            if sentiment == "negative":
                followup.update({
                    "type": "satisfaction_recovery",
                    "priority": "high",
                    "timing": "24_hours",
                    "timing_hours": 24,
                    "reason": "Customer expressed dissatisfaction",
                    "message_template": "Hi {name}, I wanted to personally reach out regarding your recent experience. We value your feedback and want to ensure we've addressed your concerns. Is there anything else we can help with?"
                })
            
            # High priority: Purchase intent but not converted
            elif has_purchase_intent and status != "resolved":
                followup.update({
                    "type": "sales_followup",
                    "priority": "high",
                    "timing": "24_hours",
                    "timing_hours": 24,
                    "reason": "Customer showed purchase interest",
                    "message_template": "Hi {name}, I noticed you were interested in our products. I'd be happy to answer any questions or help you complete your purchase. Would you like any additional information?"
                })
            
            # Medium priority: Resolved support issue
            elif status == "resolved" and "support" in topics:
                followup.update({
                    "type": "feedback_request",
                    "priority": "medium",
                    "timing": "3_days",
                    "timing_hours": 72,
                    "reason": "Support issue resolved - collect feedback",
                    "message_template": "Hi {name}, we hope your issue has been fully resolved. We'd love to hear about your experience. Would you mind sharing any feedback?"
                })
            
            # Medium priority: Refund/return inquiry
            elif "refund" in topics:
                followup.update({
                    "type": "retention",
                    "priority": "medium",
                    "timing": "7_days",
                    "timing_hours": 168,
                    "reason": "Customer inquired about refund - retention opportunity",
                    "message_template": "Hi {name}, we noticed you had some concerns recently. Is there anything we can do to improve your experience with us?"
                })
            
            # Low priority: General positive interaction
            elif sentiment == "positive":
                followup.update({
                    "type": "relationship_building",
                    "priority": "low",
                    "timing": "7_days",
                    "timing_hours": 168,
                    "reason": "Positive interaction - nurture relationship",
                    "message_template": "Hi {name}, thank you for your recent interaction with us! We appreciate your business. Let us know if there's anything else we can help with."
                })
            
            # Calculate suggested due date
            due_date = datetime.now(timezone.utc) + timedelta(hours=followup["timing_hours"])
            followup["suggested_due_date"] = due_date.isoformat()
            
            return followup
            
        except Exception as e:
            logger.error(f"Error suggesting follow-up: {str(e)}")
            return {"error": str(e)}
    
    # ==================== LEAD SCORING ====================
    
    @staticmethod
    async def calculate_lead_score(
        customer_id: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """
        Calculate a lead score for a CRM customer based on their interactions
        
        Score range: 0-100
        
        Returns:
            Dict with score, breakdown, and recommendations
        """
        try:
            # Get customer
            customer = await db.crm_customers.find_one(
                {"id": customer_id, "tenant_id": tenant_id},
                {"_id": 0}
            )
            
            if not customer:
                return {"error": "Customer not found"}
            
            # Get all conversations for this customer
            conversations = await db.conversations.find(
                {
                    "tenant_id": tenant_id,
                    "$or": [
                        {"crm_customer_id": customer_id},
                        {"customer_email": customer.get("email")}
                    ]
                },
                {"_id": 0}
            ).to_list(100)
            
            # Initialize score breakdown
            breakdown = {
                "engagement": 0,
                "sentiment": 0,
                "purchase_intent": 0,
                "verification": 0,
                "loyalty": 0
            }
            
            score = 0
            
            # 1. Engagement score (based on conversation count and messages)
            conv_count = len(conversations)
            if conv_count >= 5:
                breakdown["engagement"] = 20
            elif conv_count >= 3:
                breakdown["engagement"] = 15
            elif conv_count >= 1:
                breakdown["engagement"] = 10
            
            # Get all messages from customer's conversations
            all_messages = []
            for conv in conversations:
                messages = await db.messages.find(
                    {"conversation_id": conv["id"], "author_type": "customer"},
                    {"_id": 0, "content": 1}
                ).to_list(100)
                all_messages.extend(messages)
            
            # More messages = more engaged
            msg_count = len(all_messages)
            breakdown["engagement"] += min(msg_count * LEAD_SCORE_WEIGHTS["message_count"], 15)
            
            # 2. Sentiment analysis across all messages
            all_text = " ".join([m.get("content", "") for m in all_messages]).lower()
            
            positive_signals = sum(1 for kw in POSITIVE_KEYWORDS if kw in all_text)
            negative_signals = sum(1 for kw in NEGATIVE_KEYWORDS if kw in all_text)
            
            if positive_signals > negative_signals:
                breakdown["sentiment"] = min(positive_signals * 5, 20)
            elif negative_signals > positive_signals:
                breakdown["sentiment"] = max(negative_signals * -3, -15)
            
            # 3. Purchase intent
            purchase_signals = sum(1 for kw in PURCHASE_INTENT_KEYWORDS if kw in all_text)
            breakdown["purchase_intent"] = min(purchase_signals * 5, 25)
            
            # 4. Email verification bonus
            verified_convs = [c for c in conversations if c.get("email_verified")]
            if verified_convs:
                breakdown["verification"] = 10
            
            # 5. Loyalty (returning customer)
            if conv_count > 1:
                breakdown["loyalty"] = min(conv_count * 3, 15)
            
            # Calculate total score
            score = sum(breakdown.values())
            score = max(0, min(100, score))  # Clamp to 0-100
            
            # Determine grade
            if score >= 80:
                grade = "A"
                grade_label = "Hot Lead"
            elif score >= 60:
                grade = "B"
                grade_label = "Warm Lead"
            elif score >= 40:
                grade = "C"
                grade_label = "Potential Lead"
            elif score >= 20:
                grade = "D"
                grade_label = "Cold Lead"
            else:
                grade = "F"
                grade_label = "Low Priority"
            
            # Generate recommendations
            recommendations = []
            if breakdown["purchase_intent"] > 15:
                recommendations.append("High purchase intent - prioritize sales follow-up")
            if breakdown["sentiment"] < 0:
                recommendations.append("Negative sentiment detected - needs attention")
            if breakdown["verification"] == 0 and customer.get("email"):
                recommendations.append("Email not verified - consider verification outreach")
            if breakdown["loyalty"] > 10:
                recommendations.append("Loyal customer - good candidate for upsell")
            if score < 30:
                recommendations.append("Low engagement - consider re-engagement campaign")
            
            result = {
                "score": score,
                "grade": grade,
                "grade_label": grade_label,
                "breakdown": breakdown,
                "recommendations": recommendations,
                "metrics": {
                    "conversation_count": conv_count,
                    "message_count": msg_count,
                    "has_verified_email": breakdown["verification"] > 0
                },
                "calculated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Update customer record with score
            await db.crm_customers.update_one(
                {"id": customer_id},
                {
                    "$set": {
                        "lead_score": score,
                        "lead_grade": grade,
                        "lead_score_updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error calculating lead score: {str(e)}")
            return {"error": str(e)}
    
    # ==================== AUTO-ACTIONS ON CONVERSATION RESOLVE ====================
    
    @staticmethod
    async def on_conversation_resolved(
        conversation_id: str,
        tenant_id: str,
        resolved_by_user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Automatically run all AI automation when a conversation is resolved
        
        This should be called when conversation status changes to 'resolved'
        
        Returns:
            Dict with all generated data (summary, follow-up, lead score)
        """
        try:
            results = {}
            
            # Get conversation
            conversation = await db.conversations.find_one(
                {"id": conversation_id, "tenant_id": tenant_id},
                {"_id": 0}
            )
            
            if not conversation:
                return {"error": "Conversation not found"}
            
            # 1. Generate summary
            summary = await AIAutomationService.generate_conversation_summary(
                conversation_id, tenant_id, use_ai=True
            )
            results["summary"] = summary
            
            # 2. Generate follow-up suggestion
            followup = await AIAutomationService.suggest_followup(
                conversation_id, tenant_id
            )
            results["followup_suggestion"] = followup
            
            # 3. Calculate lead score if linked to CRM customer
            crm_customer_id = conversation.get("crm_customer_id")
            if crm_customer_id:
                lead_score = await AIAutomationService.calculate_lead_score(
                    crm_customer_id, tenant_id
                )
                results["lead_score"] = lead_score
            
            # 4. Auto-create CRM activity with summary
            if crm_customer_id and "error" not in summary:
                now = datetime.now(timezone.utc).isoformat()
                activity = {
                    "id": str(uuid4()),
                    "tenant_id": tenant_id,
                    "customer_id": crm_customer_id,
                    "type": "conversation_resolved",
                    "title": "Conversation resolved",
                    "description": summary.get("summary", "Conversation completed"),
                    "metadata": {
                        "conversation_id": conversation_id,
                        "sentiment": summary.get("sentiment"),
                        "topics": summary.get("topics", []),
                        "duration_minutes": summary.get("metrics", {}).get("duration_minutes", 0)
                    },
                    "user_id": resolved_by_user_id,
                    "created_at": now
                }
                await db.crm_activities.insert_one(activity)
                results["activity_created"] = True
            
            # 5. Auto-create follow-up if high priority
            if crm_customer_id and "error" not in followup and followup.get("priority") == "high":
                now = datetime.now(timezone.utc).isoformat()
                auto_followup = {
                    "id": str(uuid4()),
                    "tenant_id": tenant_id,
                    "customer_id": crm_customer_id,
                    "title": f"Auto: {followup.get('type', 'Follow-up').replace('_', ' ').title()}",
                    "description": followup.get("reason", ""),
                    "type": "call",
                    "priority": followup.get("priority", "medium"),
                    "status": "pending",
                    "due_date": followup.get("suggested_due_date"),
                    "metadata": {
                        "auto_generated": True,
                        "conversation_id": conversation_id,
                        "message_template": followup.get("message_template", "")
                    },
                    "created_at": now,
                    "updated_at": now
                }
                await db.crm_followups.insert_one(auto_followup)
                results["followup_created"] = True
            
            logger.info(f"AI automation completed for conversation {conversation_id}")
            return results
            
        except Exception as e:
            logger.error(f"Error in on_conversation_resolved: {str(e)}")
            return {"error": str(e)}


# Singleton instance
ai_automation_service = AIAutomationService()
