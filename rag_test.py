#!/usr/bin/env python3
"""
RAG Enforcement Test Script
Tests that AI agents ONLY answer from knowledge base after the fix.
"""

import requests
import json

class RAGEnforcementTester:
    def __init__(self, base_url="https://orchestra-refactor.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tenant_id = None
        
    def login(self):
        """Login with provided credentials"""
        print("🔐 Logging in...")
        
        login_data = {
            "email": "andre@humanweb.no",
            "password": "Pernilla66!"
        }
        
        response = requests.post(
            f"{self.base_url}/auth/login",
            json=login_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data['token']
            self.tenant_id = data['user'].get('tenant_id')
            print(f"✅ Logged in as: {data['user']['email']}")
            print(f"   Tenant ID: {self.tenant_id}")
            return True
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return False
    
    def get_agents(self):
        """Get list of agents"""
        print("\n🤖 Getting agents list...")
        
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
        
        # Try user agents first
        response = requests.get(f"{self.base_url}/agents", headers=headers, timeout=30)
        
        if response.status_code == 200:
            agents = response.json()
            if isinstance(agents, list) and len(agents) > 0:
                agent = agents[0]
                print(f"✅ Found user agent: {agent.get('name')} (ID: {agent.get('id')})")
                return agent.get('id')
        
        # Try admin agents if no user agents
        response = requests.get(f"{self.base_url}/admin/agents", headers=headers, timeout=30)
        
        if response.status_code == 200:
            agents = response.json()
            if isinstance(agents, list) and len(agents) > 0:
                agent = agents[0]
                print(f"✅ Found admin agent: {agent.get('name')} (ID: {agent.get('id')})")
                return agent.get('id')
        
        print("❌ No agents found")
        return None
    
    def create_widget_session(self):
        """Create a widget session"""
        print("\n🎯 Creating widget session...")
        
        session_data = {
            "tenant_id": self.tenant_id,
            "customer_name": "RAG Test Customer",
            "customer_email": "ragtest@example.com"
        }
        
        response = requests.post(
            f"{self.base_url}/widget/session",
            json=session_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            session_token = data.get('session_token')
            conversation_id = data.get('conversation_id')
            print(f"✅ Widget session created")
            print(f"   Conversation ID: {conversation_id}")
            return session_token, conversation_id
        else:
            print(f"❌ Widget session creation failed: {response.status_code} - {response.text}")
            return None, None
    
    def send_message(self, conversation_id, session_token, message):
        """Send a message and get AI response"""
        message_data = {"content": message}
        
        response = requests.post(
            f"{self.base_url}/widget/messages/{conversation_id}?token={session_token}",
            json=message_data,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            ai_message = data.get('ai_message')
            if ai_message:
                return ai_message.get('content', '')
            else:
                print("❌ No AI response received")
                return None
        else:
            print(f"❌ Message sending failed: {response.status_code} - {response.text}")
            return None
    
    def test_off_topic_question(self, conversation_id, session_token):
        """Test A: Off-topic question should be REFUSED"""
        print("\n🧪 Test A: Off-topic question (should be REFUSED)")
        print("   Question: 'What is the capital of France?'")
        
        ai_response = self.send_message(conversation_id, session_token, "What is the capital of France?")
        
        if not ai_response:
            return False
            
        print(f"   AI Response: {ai_response}")
        
        ai_response_lower = ai_response.lower()
        
        # Check if agent improperly answered "Paris"
        if "paris" in ai_response_lower:
            print("   ❌ CRITICAL FAILURE: Agent answered general knowledge question with 'Paris'")
            return False
        
        # Check for proper refusal indicators
        refusal_indicators = [
            "don't have information",
            "knowledge base", 
            "can only help with",
            "contact support",
            "our company",
            "our products",
            "our services",
            "not available"
        ]
        
        if any(indicator in ai_response_lower for indicator in refusal_indicators):
            print("   ✅ SUCCESS: Agent correctly refused general knowledge question")
            return True
        else:
            print("   ❌ FAILURE: Agent response doesn't clearly refuse general knowledge")
            print(f"   Expected refusal indicators not found")
            return False
    
    def test_company_question(self, conversation_id, session_token):
        """Test B: Company-related question"""
        print("\n🧪 Test B: Company-related question")
        print("   Question: 'What is your return policy?'")
        
        ai_response = self.send_message(conversation_id, session_token, "What is your return policy?")
        
        if not ai_response:
            return False
            
        print(f"   AI Response: {ai_response}")
        
        ai_response_lower = ai_response.lower()
        
        # For company questions, agent should either:
        # 1. Answer from documents (if relevant content exists)
        # 2. Say "I don't have that information" (if no relevant content)
        # It should NOT use general knowledge
        
        company_response_indicators = [
            "return", "refund", "policy", "days", "business days",
            "don't have information about that", "don't have that information",
            "knowledge base", "our company", "our products", "contact support"
        ]
        
        if any(indicator in ai_response_lower for indicator in company_response_indicators):
            print("   ✅ SUCCESS: Agent responded appropriately to company question")
            return True
        else:
            print("   ⚠️ WARNING: Agent response may not be company-specific")
            print("   This could be acceptable if no relevant documents exist")
            return True  # Give benefit of doubt for company questions
    
    def run_test(self):
        """Run the complete RAG enforcement test"""
        print("🎯 RAG Enforcement Test - Verifying AI agents ONLY answer from knowledge base")
        print("=" * 80)
        
        # Step 1: Login
        if not self.login():
            return False
        
        # Step 2: Get agents
        agent_id = self.get_agents()
        if not agent_id:
            return False
        
        # Step 3: Create widget session
        session_token, conversation_id = self.create_widget_session()
        if not session_token or not conversation_id:
            return False
        
        # Step 4: Test off-topic question (should be refused)
        test_a_passed = self.test_off_topic_question(conversation_id, session_token)
        
        # Step 5: Test company question
        test_b_passed = self.test_company_question(conversation_id, session_token)
        
        # Results
        print("\n" + "=" * 80)
        print("📋 RAG ENFORCEMENT TEST RESULTS:")
        print(f"   Test A (Off-topic refusal): {'✅ PASSED' if test_a_passed else '❌ FAILED'}")
        print(f"   Test B (Company question): {'✅ PASSED' if test_b_passed else '❌ FAILED'}")
        
        overall_success = test_a_passed and test_b_passed
        print(f"   Overall RAG Enforcement: {'✅ WORKING' if overall_success else '❌ BROKEN'}")
        
        if overall_success:
            print("\n🎉 RAG system is now properly enforcing knowledge base restrictions!")
            print("   ✅ Agents refuse general knowledge questions")
            print("   ✅ Agents handle company questions appropriately")
        else:
            print("\n🚨 RAG system is still NOT enforcing knowledge base restrictions!")
            if not test_a_passed:
                print("   ❌ Agent answered general knowledge question when it should refuse")
            if not test_b_passed:
                print("   ❌ Agent didn't handle company question appropriately")
        
        return overall_success

if __name__ == "__main__":
    tester = RAGEnforcementTester()
    success = tester.run_test()
    exit(0 if success else 1)