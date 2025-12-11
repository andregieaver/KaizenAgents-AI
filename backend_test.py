import requests
import sys
import json
import io
from datetime import datetime

class AIAgentHubTester:
    def __init__(self, base_url="https://ai-agent-hub-55.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tenant_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.conversation_id = None
        self.session_token = None
        self.provider_id = None
        self.agent_id = None
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {}
        if not files:  # Only set Content-Type for non-file uploads
            test_headers['Content-Type'] = 'application/json'
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
                if files:
                    response = requests.post(url, files=files, data=data, headers={k: v for k, v in test_headers.items() if k != 'Content-Type'}, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=30)

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

    def test_super_admin_login(self):
        """Test Super Admin login"""
        login_data = {
            "email": "andre@humanweb.no",
            "password": "Pernilla66!"
        }
        
        success, response = self.run_test(
            "Super Admin Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_data = response['user']
            self.tenant_id = response['user'].get('tenant_id')
            print(f"   Logged in as: {self.user_data['email']}")
            print(f"   Is Super Admin: {response['user'].get('is_super_admin', False)}")
            print(f"   Tenant ID: {self.tenant_id}")
            return True
        return False

    def test_auth_me(self):
        """Test /api/auth/me endpoint"""
        success, response = self.run_test(
            "Auth Me Endpoint",
            "GET",
            "auth/me",
            200
        )
        
        if success:
            print(f"   User ID: {response.get('id')}")
            print(f"   Role: {response.get('role')}")
            print(f"   Super Admin: {response.get('is_super_admin', False)}")
        
        return success

    def test_jwt_token_validation(self):
        """Test JWT token generation and validation"""
        if not self.token:
            print("❌ No token available for validation")
            return False
            
        # Test that token works for protected endpoint
        success, response = self.run_test(
            "JWT Token Validation",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_storage_config_get(self):
        """Test GET /api/admin/storage-config"""
        success, response = self.run_test(
            "Get Storage Configuration",
            "GET",
            "admin/storage-config",
            200
        )
        
        if success:
            print(f"   Storage Type: {response.get('storage_type')}")
            print(f"   GCS Bucket: {response.get('gcs_bucket_name')}")
            print(f"   GCS Configured: {response.get('gcs_configured', False)}")
            
            # Verify GCS is configured
            if response.get('gcs_bucket_name') == 'kaizen-agents-ai':
                print("   ✅ Correct GCS bucket configured")
            else:
                print(f"   ⚠️ Expected bucket 'kaizen-agents-ai', got '{response.get('gcs_bucket_name')}'")
        
        return success

    def test_storage_config_test_gcs(self):
        """Test POST /api/admin/storage-config/test-gcs"""
        success, response = self.run_test(
            "Test GCS Connection",
            "POST",
            "admin/storage-config/test-gcs",
            200
        )
        
        if success:
            print(f"   Test Result: {response.get('status', 'unknown')}")
            print(f"   Message: {response.get('message', 'No message')}")
        
        return success

    def test_providers_list(self):
        """Test GET /api/admin/providers"""
        success, response = self.run_test(
            "List AI Providers",
            "GET",
            "admin/providers",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} providers")
            for provider in response:
                print(f"   - {provider.get('name')} ({provider.get('type')}) - Active: {provider.get('is_active', False)}")
                if provider.get('type') == 'openai' and provider.get('is_active'):
                    self.provider_id = provider.get('id')
                    print(f"     Using OpenAI provider ID: {self.provider_id}")
        
        return success

    def test_agents_list(self):
        """Test GET /api/admin/agents"""
        success, response = self.run_test(
            "List AI Agents",
            "GET",
            "admin/agents",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} agents")
            for agent in response:
                print(f"   - {agent.get('name')} (Model: {agent.get('model')}, Provider: {agent.get('provider_name')})")
                print(f"     Temperature: {agent.get('temperature')}, Max Tokens: {agent.get('max_tokens')}")
                print(f"     System Prompt: {agent.get('system_prompt', '')[:50]}...")
                if not self.agent_id:  # Use first agent for testing
                    self.agent_id = agent.get('id')
                    print(f"     Using agent ID for testing: {self.agent_id}")
        
        return success

    def test_agent_conversation(self):
        """Test agent conversation endpoint"""
        if not self.agent_id:
            print("❌ No agent ID available for conversation test")
            return False
            
        # Test with agent's name question
        test_data = {
            "message": "What is your name?",
            "history": []
        }
        
        success, response = self.run_test(
            "Agent Test - Name Question",
            "POST",
            f"admin/agents/{self.agent_id}/test",
            200,
            data=test_data
        )
        
        if success and 'response' in response:
            print(f"   Agent Response: {response['response'][:100]}...")
        
        return success

    def test_agent_knowledge_limitation(self):
        """Test agent refuses general knowledge questions"""
        if not self.agent_id:
            print("❌ No agent ID available for knowledge limitation test")
            return False
            
        # Test with general knowledge question
        test_data = {
            "message": "Who was Obama?",
            "history": []
        }
        
        success, response = self.run_test(
            "Agent Test - Knowledge Limitation",
            "POST",
            f"admin/agents/{self.agent_id}/test",
            200,
            data=test_data
        )
        
        if success and 'response' in response:
            response_text = response['response'].lower()
            print(f"   Agent Response: {response['response'][:100]}...")
            
            # Check if agent properly refuses general knowledge
            refusal_indicators = ['knowledge base', 'support team', 'contact', 'don\'t have', 'not available']
            if any(indicator in response_text for indicator in refusal_indicators):
                print("   ✅ Agent correctly refused general knowledge question")
            else:
                print("   ⚠️ Agent may have answered general knowledge question")
        
        return success

    def test_company_agent_config_get(self):
        """Test GET /api/settings/agent-config"""
        success, response = self.run_test(
            "Get Company Agent Configuration",
            "GET",
            "settings/agent-config",
            200
        )
        
        if success:
            print(f"   Agent ID: {response.get('agent_id')}")
            print(f"   Agent Name: {response.get('agent_name')}")
            print(f"   Custom Instructions: {response.get('custom_instructions', 'None')[:50]}...")
            print(f"   Uploaded Docs: {len(response.get('uploaded_docs', []))}")
            
            # Store for later tests
            if response.get('uploaded_docs'):
                print("   Documents found:")
                for doc in response.get('uploaded_docs', []):
                    print(f"     - {doc.get('filename')} ({doc.get('file_size')} bytes)")
        
        return success

    def test_document_upload(self):
        """Test document upload with RAG processing"""
        # Create a test document
        test_content = """
        Company Policy Document
        
        Our company offers 24/7 customer support through multiple channels.
        We provide refunds within 30 days of purchase for any reason.
        Our premium support includes priority response within 2 hours.
        
        Contact Information:
        - Email: support@company.com
        - Phone: 1-800-SUPPORT
        - Live Chat: Available on our website
        
        Return Policy:
        All items can be returned within 30 days.
        Refunds are processed within 5-7 business days.
        """
        
        # Create file-like object
        file_content = io.BytesIO(test_content.encode('utf-8'))
        files = {'file': ('company_policy.txt', file_content, 'text/plain')}
        
        success, response = self.run_test(
            "Document Upload with RAG",
            "POST",
            "settings/agent-config/upload-document",
            200,
            files=files
        )
        
        if success:
            print(f"   Upload Status: {response.get('status', 'unknown')}")
            print(f"   Chunks Processed: {response.get('chunks_processed', 0)}")
            print(f"   Filename: {response.get('filename', 'unknown')}")
            
            if response.get('chunks_processed', 0) > 0:
                print("   ✅ Document successfully processed with RAG")
            else:
                print("   ⚠️ Document uploaded but no chunks processed")
        
        return success

    def test_conversations_list(self):
        """Test listing conversations"""
        success, response = self.run_test(
            "List Conversations",
            "GET",
            "conversations",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} conversations")
        
        return success

    def test_conversation_detail(self):
        """Test getting conversation details"""
        if not self.conversation_id:
            print("❌ No conversation ID available for detail test")
            return False
            
        success, response = self.run_test(
            "Get Conversation Detail",
            "GET",
            f"conversations/{self.conversation_id}",
            200
        )
        return success

    def test_conversation_messages(self):
        """Test getting conversation messages"""
        if not self.conversation_id:
            print("❌ No conversation ID available for messages test")
            return False
            
        success, response = self.run_test(
            "Get Conversation Messages",
            "GET",
            f"conversations/{self.conversation_id}/messages",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} messages")
        
        return success

    def test_widget_config(self):
        """Test getting widget configuration (public endpoint)"""
        if not self.tenant_id:
            print("❌ No tenant ID available for widget config test")
            return False
            
        success, response = self.run_test(
            "Get Widget Config",
            "GET",
            f"widget/config/{self.tenant_id}",
            200
        )
        return success

def main():
    print("🚀 Starting AI Customer Support Platform API Tests")
    print("=" * 60)
    
    tester = AICustomerSupportTester()
    
    # Test sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("User Registration", tester.test_register),
        ("User Login", tester.test_login),
        ("Get Current User", tester.test_get_me),
        ("Dashboard Stats", tester.test_get_stats),
        ("Get Settings", tester.test_get_settings),
        ("Update Settings", tester.test_update_settings),
        ("Widget Session Creation", tester.test_widget_session_creation),
        ("Widget Message Sending", tester.test_widget_message_sending),
        ("List Conversations", tester.test_conversations_list),
        ("Conversation Detail", tester.test_conversation_detail),
        ("Conversation Messages", tester.test_conversation_messages),
        ("Widget Config", tester.test_widget_config),
    ]
    
    print(f"\n📋 Running {len(tests)} test scenarios...")
    
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} - Unexpected error: {str(e)}")
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())