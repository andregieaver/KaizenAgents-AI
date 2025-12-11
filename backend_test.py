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

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_register(self):
        """Test user registration"""
        test_user_data = {
            "email": f"test_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "TestPass123!",
            "name": "Test User"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_data = response['user']
            self.tenant_id = response['user'].get('tenant_id')
            print(f"   Registered user: {self.user_data['email']}")
            print(f"   Tenant ID: {self.tenant_id}")
            return True
        return False

    def test_login(self):
        """Test user login with registered user"""
        if not self.user_data:
            print("❌ No user data available for login test")
            return False
            
        login_data = {
            "email": self.user_data['email'],
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            return True
        return False

    def test_get_me(self):
        """Test get current user endpoint"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_get_stats(self):
        """Test dashboard stats endpoint"""
        success, response = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "stats",
            200
        )
        
        if success:
            expected_keys = ['total_conversations', 'open_conversations', 'resolved_conversations']
            for key in expected_keys:
                if key not in response:
                    print(f"   Warning: Missing key '{key}' in stats response")
        
        return success

    def test_get_settings(self):
        """Test get settings endpoint"""
        success, response = self.run_test(
            "Get Settings",
            "GET",
            "settings",
            200
        )
        return success

    def test_update_settings(self):
        """Test update settings endpoint"""
        settings_data = {
            "brand_name": "Test Support Hub",
            "primary_color": "#FF5722",
            "welcome_message": "Hello! How can we help you today?",
            "ai_tone": "friendly"
        }
        
        success, response = self.run_test(
            "Update Settings",
            "PUT",
            "settings",
            200,
            data=settings_data
        )
        return success

    def test_widget_session_creation(self):
        """Test widget session creation (public endpoint)"""
        if not self.tenant_id:
            print("❌ No tenant ID available for widget session test")
            return False
            
        session_data = {
            "tenant_id": self.tenant_id,
            "customer_name": "Demo Customer",
            "customer_email": "demo@example.com"
        }
        
        success, response = self.run_test(
            "Widget Session Creation",
            "POST",
            "widget/session",
            200,
            data=session_data
        )
        
        if success and 'session_token' in response:
            self.session_token = response['session_token']
            self.conversation_id = response['conversation_id']
            print(f"   Session token: {self.session_token[:20]}...")
            print(f"   Conversation ID: {self.conversation_id}")
            return True
        return False

    def test_widget_message_sending(self):
        """Test sending message through widget"""
        if not self.conversation_id or not self.session_token:
            print("❌ No conversation ID or session token available")
            return False
            
        message_data = {
            "content": "Hello, I need help with my order"
        }
        
        success, response = self.run_test(
            "Widget Message Sending",
            "POST",
            f"widget/messages/{self.conversation_id}?token={self.session_token}",
            200,
            data=message_data
        )
        
        if success:
            if 'customer_message' in response:
                print("   Customer message saved successfully")
            if 'ai_message' in response and response['ai_message']:
                print("   AI response generated successfully")
            else:
                print("   Note: AI response not generated (likely no OpenAI key configured)")
        
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