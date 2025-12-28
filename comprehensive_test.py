import requests
import sys
import json
from datetime import datetime

class ComprehensiveOrchestrationTester:
    def __init__(self, base_url="https://sticky-header-2.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tenant_id = "1c752635-c958-435d-8a48-a1f1209cccd4"  # Specific tenant from review
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.session_token = None
        self.conversation_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            result = {
                'name': name,
                'success': success,
                'status_code': response.status_code,
                'expected_status': expected_status
            }
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    result['response'] = response_data
                    self.test_results.append(result)
                    return success, response_data
                except:
                    result['response'] = {}
                    self.test_results.append(result)
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                    result['error'] = error_data
                except:
                    print(f"   Response: {response.text}")
                    result['error'] = response.text
                self.test_results.append(result)
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            result = {
                'name': name,
                'success': False,
                'error': str(e)
            }
            self.test_results.append(result)
            return False, {}

    def login(self):
        """Login with provided credentials"""
        login_data = {
            "email": "andre@humanweb.no",
            "password": "Pernilla66!"
        }
        
        success, response = self.run_test(
            "Login with Test Credentials",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_data = response['user']
            print(f"   Logged in as: {self.user_data['email']}")
            print(f"   Is Super Admin: {response['user'].get('is_super_admin', False)}")
            return True
        return False

    def test_company_level_mother_agent(self):
        """PART 1: Company-Level Mother Agent Testing"""
        print(f"\n🎯 PART 1: COMPANY-LEVEL MOTHER AGENT TESTING")
        
        # Test 1.1: Switch to Company Agent as Mother
        print(f"\n--- Test 1.1: Switch to Company Agent as Mother ---")
        
        # Get company agents
        success, agents_response = self.run_test(
            "Get Company Agents",
            "GET",
            "agents",
            200
        )
        
        if not success:
            print("❌ Failed to get company agents")
            return False
            
        print(f"   Found {len(agents_response)} company agents")
        
        # Find E-commerce Support Agent
        ecommerce_agent = None
        for agent in agents_response:
            if "E-commerce Support Agent" in agent.get('name', '') or agent.get('id', '').startswith('7b883064'):
                ecommerce_agent = agent
                break
        
        if not ecommerce_agent:
            print("❌ E-commerce Support Agent not found")
            # Use first available agent
            if agents_response:
                ecommerce_agent = agents_response[0]
                print(f"   Using first available agent: {ecommerce_agent.get('name')}")
            else:
                print("❌ No agents available")
                return False
        
        print(f"   Using agent: {ecommerce_agent.get('name')} (ID: {ecommerce_agent.get('id')})")
        
        # Set company agent as mother
        orchestration_config = {
            "enabled": True,
            "mother_user_agent_id": ecommerce_agent.get('id'),
            "mother_admin_agent_id": None,
            "allowed_child_agent_ids": []
        }
        
        success, config_response = self.run_test(
            "Set Company Agent as Mother",
            "PUT",
            "settings/orchestration",
            200,
            data=orchestration_config
        )
        
        if not success:
            print("❌ Failed to set company agent as mother")
            return False
            
        # Verify mother_agent_type is "company"
        success, verify_response = self.run_test(
            "Verify Mother Agent Type is Company",
            "GET",
            "settings/orchestration",
            200
        )
        
        if not success:
            print("❌ Failed to verify orchestration settings")
            return False
            
        mother_agent_type = verify_response.get('mother_agent_type')
        if mother_agent_type == "company":
            print("✅ Mother agent type correctly set to 'company'")
        else:
            print(f"❌ Expected mother_agent_type='company', got '{mother_agent_type}'")
            return False
        
        # Test 1.2: Test Widget with Company Mother Agent
        print(f"\n--- Test 1.2: Test Widget with Company Mother Agent ---")
        
        # Create widget session
        session_data = {
            "tenant_id": self.tenant_id
        }
        
        success, session_response = self.run_test(
            "Create Widget Session",
            "POST",
            "widget/session",
            200,
            data=session_data
        )
        
        if not success:
            print("❌ Failed to create widget session")
            return False
            
        self.session_token = session_response.get('session_token')
        self.conversation_id = session_response.get('conversation_id')
        
        if not self.session_token or not self.conversation_id:
            print("❌ Missing session_token or conversation_id")
            return False
            
        print(f"   Widget session created: {self.conversation_id}")
        
        # Send general knowledge question - should be refused
        message_data = {
            "content": "What is 2+2?"
        }
        
        success, message_response = self.run_test(
            "Send General Knowledge Question (Should Refuse)",
            "POST",
            f"widget/messages/{self.conversation_id}?token={self.session_token}",
            200,
            data=message_data
        )
        
        if not success:
            print("❌ Failed to send message")
            return False
            
        ai_message = message_response.get('ai_message')
        if not ai_message:
            print("❌ No AI response received")
            return False
            
        ai_content = ai_message.get('content', '').lower()
        print(f"   AI Response: {ai_message.get('content')}")
        
        # Check if AI refused to answer
        refusal_indicators = ['knowledge base', 'support team', 'contact', "don't have", 'not available', 'company documentation']
        refused = any(indicator in ai_content for indicator in refusal_indicators)
        
        if refused:
            print("✅ AI correctly refused general knowledge question")
        else:
            print("❌ AI may have answered general knowledge question (RAG enforcement failed)")
            return False
        
        # Test 1.3: Switch Back to Admin Agent
        print(f"\n--- Test 1.3: Switch Back to Admin Agent ---")
        
        # Set admin agent as mother
        admin_orchestration_config = {
            "enabled": True,
            "mother_admin_agent_id": "cb4928cf-907c-4ee5-8f3e-13b94334d36f",
            "mother_user_agent_id": None,
            "allowed_child_agent_ids": []
        }
        
        success, admin_config_response = self.run_test(
            "Set Admin Agent as Mother",
            "PUT",
            "settings/orchestration",
            200,
            data=admin_orchestration_config
        )
        
        if not success:
            print("❌ Failed to set admin agent as mother")
            return False
            
        # Verify mother_agent_type is "admin"
        success, admin_verify_response = self.run_test(
            "Verify Mother Agent Type is Admin",
            "GET",
            "settings/orchestration",
            200
        )
        
        if not success:
            print("❌ Failed to verify admin orchestration settings")
            return False
            
        admin_mother_agent_type = admin_verify_response.get('mother_agent_type')
        if admin_mother_agent_type == "admin":
            print("✅ Mother agent type correctly set to 'admin'")
        else:
            print(f"❌ Expected mother_agent_type='admin', got '{admin_mother_agent_type}'")
            return False
        
        print("✅ PART 1: Company-Level Mother Agent Testing PASSED")
        return True

    def test_rag_system_enforcement(self):
        """PART 2: RAG System Enforcement Testing"""
        print(f"\n🎯 PART 2: RAG SYSTEM ENFORCEMENT TESTING")
        
        # Create new widget session for RAG testing
        session_data = {
            "tenant_id": self.tenant_id
        }
        
        success, session_response = self.run_test(
            "Create New Widget Session for RAG Testing",
            "POST",
            "widget/session",
            200,
            data=session_data
        )
        
        if not success:
            print("❌ Failed to create widget session for RAG testing")
            return False
            
        rag_session_token = session_response.get('session_token')
        rag_conversation_id = session_response.get('conversation_id')
        
        print(f"   RAG test session created: {rag_conversation_id}")
        
        # Test 2.1: General Knowledge Question (Must REFUSE)
        print(f"\n--- Test 2.1: General Knowledge Question (Must REFUSE) ---")
        
        message_data = {
            "content": "Who is the president of the United States?"
        }
        
        success, response = self.run_test(
            "General Knowledge - US President",
            "POST",
            f"widget/messages/{rag_conversation_id}?token={rag_session_token}",
            200,
            data=message_data
        )
        
        if not success:
            print("❌ Failed to send US president question")
            return False
            
        ai_message = response.get('ai_message')
        if not ai_message:
            print("❌ No AI response received")
            return False
            
        ai_content = ai_message.get('content', '').lower()
        print(f"   AI Response: {ai_message.get('content')}")
        
        # Check if AI refused
        refusal_indicators = ['knowledge base', 'support team', 'contact', "don't have", 'company', 'documentation']
        refused = any(indicator in ai_content for indicator in refusal_indicators)
        
        # Check if AI provided actual answer (FAIL condition)
        answer_indicators = ['biden', 'trump', 'president', 'united states', 'america']
        answered = any(indicator in ai_content for indicator in answer_indicators) and not refused
        
        if answered:
            print("❌ FAIL: AI provided actual answer instead of refusing")
            return False
        elif refused:
            print("✅ PASS: AI correctly refused general knowledge question")
        else:
            print("⚠️ Unclear response - may need manual review")
        
        # Test 2.2: Another General Knowledge Question
        print(f"\n--- Test 2.2: Another General Knowledge Question ---")
        
        message_data = {
            "content": "How many planets are in the solar system?"
        }
        
        success, response = self.run_test(
            "General Knowledge - Solar System",
            "POST",
            f"widget/messages/{rag_conversation_id}?token={rag_session_token}",
            200,
            data=message_data
        )
        
        if not success:
            print("❌ Failed to send solar system question")
            return False
            
        ai_message = response.get('ai_message')
        if not ai_message:
            print("❌ No AI response received")
            return False
            
        ai_content = ai_message.get('content', '').lower()
        print(f"   AI Response: {ai_message.get('content')}")
        
        # Check if AI refused
        refused = any(indicator in ai_content for indicator in refusal_indicators)
        
        # Check if AI provided actual answer (FAIL condition)
        answer_indicators = ['8', 'eight', 'nine', 'planets', 'mercury', 'venus', 'earth', 'mars']
        answered = any(indicator in ai_content for indicator in answer_indicators) and not refused
        
        if answered:
            print("❌ FAIL: AI provided actual answer instead of refusing")
            return False
        elif refused:
            print("✅ PASS: AI correctly refused general knowledge question")
        else:
            print("⚠️ Unclear response - may need manual review")
        
        # Test 2.3: Math Question (Must REFUSE)
        print(f"\n--- Test 2.3: Math Question (Must REFUSE) ---")
        
        message_data = {
            "content": "Calculate 15 * 23"
        }
        
        success, response = self.run_test(
            "Math Question - Calculation",
            "POST",
            f"widget/messages/{rag_conversation_id}?token={rag_session_token}",
            200,
            data=message_data
        )
        
        if not success:
            print("❌ Failed to send math question")
            return False
            
        ai_message = response.get('ai_message')
        if not ai_message:
            print("❌ No AI response received")
            return False
            
        ai_content = ai_message.get('content', '').lower()
        print(f"   AI Response: {ai_message.get('content')}")
        
        # Check if AI refused
        refused = any(indicator in ai_content for indicator in refusal_indicators)
        
        # Check if AI provided calculation (FAIL condition)
        answer_indicators = ['345', '15', '23', 'multiply', 'calculation', 'equals']
        answered = any(indicator in ai_content for indicator in answer_indicators) and not refused
        
        if answered:
            print("❌ FAIL: AI provided calculation instead of refusing")
            return False
        elif refused:
            print("✅ PASS: AI correctly refused math question")
        else:
            print("⚠️ Unclear response - may need manual review")
        
        # Test 2.4: Company-Related Question
        print(f"\n--- Test 2.4: Company-Related Question ---")
        
        message_data = {
            "content": "What products do you sell?"
        }
        
        success, response = self.run_test(
            "Company Question - Products",
            "POST",
            f"widget/messages/{rag_conversation_id}?token={rag_session_token}",
            200,
            data=message_data
        )
        
        if not success:
            print("❌ Failed to send company question")
            return False
            
        ai_message = response.get('ai_message')
        if not ai_message:
            print("❌ No AI response received")
            return False
            
        ai_content = ai_message.get('content', '').lower()
        print(f"   AI Response: {ai_message.get('content')}")
        
        # This should NOT be a direct refusal - should respond appropriately
        direct_refusal = "i can only help with questions about our company" in ai_content
        
        if direct_refusal:
            print("❌ AI incorrectly refused company-related question")
            return False
        else:
            print("✅ PASS: AI responded appropriately to company question")
        
        # Test 2.5: Greeting (Should work)
        print(f"\n--- Test 2.5: Greeting (Should work) ---")
        
        message_data = {
            "content": "Hello!"
        }
        
        success, response = self.run_test(
            "Greeting Test",
            "POST",
            f"widget/messages/{rag_conversation_id}?token={rag_session_token}",
            200,
            data=message_data
        )
        
        if not success:
            print("❌ Failed to send greeting")
            return False
            
        ai_message = response.get('ai_message')
        if not ai_message:
            print("❌ No AI response received")
            return False
            
        ai_content = ai_message.get('content', '').lower()
        print(f"   AI Response: {ai_message.get('content')}")
        
        # Should respond with a greeting
        greeting_indicators = ['hello', 'hi', 'help', 'assist', 'welcome']
        responded = any(indicator in ai_content for indicator in greeting_indicators)
        
        if responded:
            print("✅ PASS: AI responded appropriately to greeting")
        else:
            print("⚠️ AI response may not be appropriate for greeting")
        
        print("✅ PART 2: RAG System Enforcement Testing COMPLETED")
        return True

    def test_edge_cases(self):
        """PART 3: Edge Cases"""
        print(f"\n🎯 PART 3: EDGE CASES TESTING")
        
        # Test 3.1: Invalid Mother Agent ID
        print(f"\n--- Test 3.1: Invalid Mother Agent ID ---")
        
        invalid_config = {
            "enabled": True,
            "mother_user_agent_id": "invalid-agent-id-12345",
            "mother_admin_agent_id": None,
            "allowed_child_agent_ids": []
        }
        
        success, response = self.run_test(
            "Set Invalid Mother Agent ID",
            "PUT",
            "settings/orchestration",
            404,  # Expecting 404 error
            data=invalid_config
        )
        
        if success:
            print("✅ PASS: Invalid mother agent ID correctly returns 404")
        else:
            print("❌ FAIL: Invalid mother agent ID should return 404")
            return False
        
        # Test 3.2: Orchestration Disabled
        print(f"\n--- Test 3.2: Orchestration Disabled ---")
        
        disabled_config = {
            "enabled": False
        }
        
        success, response = self.run_test(
            "Disable Orchestration",
            "PUT",
            "settings/orchestration",
            200,
            data=disabled_config
        )
        
        if not success:
            print("❌ Failed to disable orchestration")
            return False
            
        # Verify orchestration is disabled
        success, verify_response = self.run_test(
            "Verify Orchestration Disabled",
            "GET",
            "settings/orchestration",
            200
        )
        
        if not success:
            print("❌ Failed to verify orchestration status")
            return False
            
        enabled = verify_response.get('enabled')
        if enabled == False:
            print("✅ PASS: Orchestration correctly disabled")
        else:
            print(f"❌ FAIL: Expected enabled=false, got enabled={enabled}")
            return False
        
        # Re-enable orchestration
        reenable_config = {
            "enabled": True,
            "mother_admin_agent_id": "cb4928cf-907c-4ee5-8f3e-13b94334d36f"
        }
        
        success, response = self.run_test(
            "Re-enable Orchestration",
            "PUT",
            "settings/orchestration",
            200,
            data=reenable_config
        )
        
        if success:
            print("✅ PASS: Orchestration re-enabled successfully")
        else:
            print("❌ Failed to re-enable orchestration")
            return False
        
        print("✅ PART 3: Edge Cases Testing COMPLETED")
        return True

    def run_comprehensive_test(self):
        """Run all comprehensive tests"""
        print("🚀 STARTING COMPREHENSIVE ORCHESTRATION AND RAG TESTING")
        print("=" * 80)
        
        # Login first
        if not self.login():
            print("❌ Login failed - cannot continue")
            return False
        
        # Run all test parts
        part1_success = self.test_company_level_mother_agent()
        part2_success = self.test_rag_system_enforcement()
        part3_success = self.test_edge_cases()
        
        # Print final summary
        print("\n" + "=" * 80)
        print("🏁 COMPREHENSIVE TEST RESULTS SUMMARY")
        print("=" * 80)
        
        print(f"PART 1 - Company-Level Mother Agent: {'✅ PASSED' if part1_success else '❌ FAILED'}")
        print(f"PART 2 - RAG System Enforcement: {'✅ PASSED' if part2_success else '❌ FAILED'}")
        print(f"PART 3 - Edge Cases: {'✅ PASSED' if part3_success else '❌ FAILED'}")
        
        overall_success = part1_success and part2_success and part3_success
        
        print(f"\nOVERALL RESULT: {'✅ ALL TESTS PASSED' if overall_success else '❌ SOME TESTS FAILED'}")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        return overall_success

if __name__ == "__main__":
    tester = ComprehensiveOrchestrationTester()
    success = tester.run_comprehensive_test()
    sys.exit(0 if success else 1)