import requests
import sys
import json
from datetime import datetime

class EmailTemplatesTester:
    def __init__(self, base_url="https://projectsync-app-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
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
            print(f"   Logged in as: {self.user_data['email']}")
            print(f"   Is Super Admin: {response['user'].get('is_super_admin', False)}")
            return True
        return False

    def test_get_all_email_templates(self):
        """Test GET /api/admin/email-templates (Super Admin only)"""
        print(f"\n🔧 Testing GET /api/admin/email-templates")
        
        success, response = self.run_test(
            "Get All Email Templates",
            "GET",
            "admin/email-templates",
            200
        )
        
        if success:
            if isinstance(response, list):
                print(f"   ✅ Retrieved {len(response)} email templates")
                
                # Verify expected categories
                categories = set()
                template_keys = set()
                
                for template in response:
                    categories.add(template.get('category'))
                    template_keys.add(template.get('key'))
                    
                    # Verify required fields
                    required_fields = ['key', 'name', 'description', 'subject', 'html_content', 'variables', 'category', 'is_enabled']
                    for field in required_fields:
                        if field not in template:
                            print(f"   ⚠️ Template missing required field: {field}")
                
                print(f"   Categories found: {sorted(categories)}")
                print(f"   Template keys: {sorted(template_keys)}")
                
                # Check for expected categories
                expected_categories = {'authentication', 'billing', 'notifications', 'team'}
                if expected_categories.issubset(categories):
                    print("   ✅ All expected categories present")
                else:
                    missing = expected_categories - categories
                    print(f"   ⚠️ Missing categories: {missing}")
                
                return True
            else:
                print(f"   ❌ Expected list response, got {type(response)}")
                return False
        
        return success

    def test_get_specific_email_template(self):
        """Test GET /api/admin/email-templates/{template_key} (Super Admin only)"""
        print(f"\n🔧 Testing GET /api/admin/email-templates/password_reset")
        
        success, response = self.run_test(
            "Get Specific Email Template - password_reset",
            "GET",
            "admin/email-templates/password_reset",
            200
        )
        
        if success:
            print(f"   ✅ Retrieved password_reset template")
            print(f"   Template Name: {response.get('name')}")
            print(f"   Category: {response.get('category')}")
            print(f"   Subject: {response.get('subject', '')[:50]}...")
            print(f"   Variables: {response.get('variables', [])}")
            print(f"   Enabled: {response.get('is_enabled')}")
            
            # Verify it's the password reset template
            if response.get('key') == 'password_reset':
                print("   ✅ Correct template key returned")
            else:
                print(f"   ❌ Expected key 'password_reset', got '{response.get('key')}'")
                
            # Verify required fields for password reset
            expected_variables = ['platform_name', 'user_name', 'reset_url', 'expiry_hours', 'year']
            template_variables = response.get('variables', [])
            
            if all(var in template_variables for var in expected_variables):
                print("   ✅ All expected variables present")
            else:
                missing = set(expected_variables) - set(template_variables)
                print(f"   ⚠️ Missing variables: {missing}")
        
        return success

    def test_update_email_template(self):
        """Test PUT /api/admin/email-templates/{template_key} (Super Admin only)"""
        print(f"\n🔧 Testing PUT /api/admin/email-templates/welcome")
        
        # Update welcome template
        update_data = {
            "subject": "Welcome to Our Updated Platform!",
            "is_enabled": True
        }
        
        success, response = self.run_test(
            "Update Welcome Email Template",
            "PUT",
            "admin/email-templates/welcome",
            200,
            data=update_data
        )
        
        if success:
            print(f"   ✅ Welcome template updated successfully")
            print(f"   Updated Subject: {response.get('subject')}")
            print(f"   Enabled Status: {response.get('is_enabled')}")
            
            # Verify the update was applied
            if response.get('subject') == "Welcome to Our Updated Platform!":
                print("   ✅ Subject update verified")
            else:
                print(f"   ❌ Subject not updated correctly")
                
            if response.get('is_enabled') == True:
                print("   ✅ Enabled status update verified")
            else:
                print(f"   ❌ Enabled status not updated correctly")
                
            # Verify updated_at field was set
            if response.get('updated_at'):
                print("   ✅ Updated timestamp set")
            else:
                print("   ⚠️ Updated timestamp missing")
        
        return success

    def test_preview_email_template(self):
        """Test POST /api/admin/email-templates/preview (Super Admin only)"""
        print(f"\n🔧 Testing POST /api/admin/email-templates/preview")
        
        # Test preview with sample HTML content
        preview_data = {
            "subject": "Test Subject - {{platform_name}}",
            "html_content": """
            <div style="font-family: Arial, sans-serif;">
                <h1>Hello {{user_name}}!</h1>
                <p>Welcome to {{platform_name}}.</p>
                <p>Your email is: {{user_email}}</p>
                <p>Year: {{year}}</p>
            </div>
            """
        }
        
        success, response = self.run_test(
            "Preview Email Template with Variables",
            "POST",
            "admin/email-templates/preview",
            200,
            data=preview_data
        )
        
        if success:
            print(f"   ✅ Email template preview generated")
            
            preview_subject = response.get('subject', '')
            preview_html = response.get('html_content', '')
            
            print(f"   Preview Subject: {preview_subject}")
            print(f"   Preview HTML Length: {len(preview_html)} characters")
            
            # Verify variables were replaced with sample data
            if '{{platform_name}}' not in preview_subject and 'Your Platform' in preview_subject:
                print("   ✅ Subject variables replaced correctly")
            else:
                print("   ❌ Subject variables not replaced")
                
            if '{{user_name}}' not in preview_html and 'John Doe' in preview_html:
                print("   ✅ HTML variables replaced correctly")
            else:
                print("   ❌ HTML variables not replaced")
                
            # Check for sample data presence
            sample_indicators = ['Your Platform', 'John Doe', 'john@example.com']
            found_samples = sum(1 for indicator in sample_indicators if preview_html)
            
            if found_samples >= 2:
                print(f"   ✅ Sample data correctly inserted ({found_samples}/3 indicators found)")
            else:
                print(f"   ⚠️ Limited sample data found ({found_samples}/3 indicators)")
        
        return success

    def test_reset_email_template(self):
        """Test POST /api/admin/email-templates/{template_key}/reset (Super Admin only)"""
        print(f"\n🔧 Testing POST /api/admin/email-templates/welcome/reset")
        
        success, response = self.run_test(
            "Reset Welcome Template to Default",
            "POST",
            "admin/email-templates/welcome/reset",
            200
        )
        
        if success:
            print(f"   ✅ Welcome template reset to default")
            
            message = response.get('message', '')
            template = response.get('template', {})
            
            print(f"   Reset Message: {message}")
            
            if 'reset to default' in message.lower():
                print("   ✅ Correct reset message returned")
            else:
                print("   ⚠️ Unexpected reset message")
                
            # Verify template was returned
            if template and template.get('key') == 'welcome':
                print("   ✅ Reset template data returned")
                print(f"   Template Name: {template.get('name')}")
                print(f"   Template Subject: {template.get('subject', '')[:50]}...")
                
                # Verify it has default content (should not be our custom subject)
                if template.get('subject') != "Welcome to Our Updated Platform!":
                    print("   ✅ Template reset to original default content")
                else:
                    print("   ❌ Template may not have been reset properly")
            else:
                print("   ❌ Reset template data not returned")
        
        return success

def main():
    """Main test runner for Email Templates Management"""
    print("🎯 Email Templates Management API Tests")
    print("=" * 60)
    
    tester = EmailTemplatesTester()
    
    # Define test functions to run
    test_functions = [
        ("Super Admin Login", tester.test_super_admin_login),
        ("GET /api/admin/email-templates", tester.test_get_all_email_templates),
        ("GET /api/admin/email-templates/{template_key}", tester.test_get_specific_email_template),
        ("PUT /api/admin/email-templates/{template_key}", tester.test_update_email_template),
        ("POST /api/admin/email-templates/preview", tester.test_preview_email_template),
        ("POST /api/admin/email-templates/{template_key}/reset", tester.test_reset_email_template)
    ]
    
    failed_tests = []
    
    # Run all tests
    for test_name, test_func in test_functions:
        try:
            success = test_func()
            if not success:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Unexpected error: {str(e)}")
            failed_tests.append(test_name)
    
    # Print detailed results
    print("\n" + "=" * 70)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if failed_tests:
        print(f"\n❌ Failed Tests ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   - {test}")
    
    # Print summary
    print(f"\n📋 Email Templates Management Test Summary:")
    categories = {
        "Authentication": ["Super Admin Login"],
        "Email Templates": [
            "GET /api/admin/email-templates",
            "GET /api/admin/email-templates/{template_key}",
            "PUT /api/admin/email-templates/{template_key}",
            "POST /api/admin/email-templates/preview",
            "POST /api/admin/email-templates/{template_key}/reset"
        ]
    }
    
    for category, category_tests in categories.items():
        passed = sum(1 for test in category_tests if test not in failed_tests)
        total = len(category_tests)
        status = "✅" if passed == total else "❌" if passed == 0 else "⚠️"
        print(f"   {status} {category}: {passed}/{total}")
    
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 All Email Templates Management tests passed!")
        return 0
    else:
        print(f"\n⚠️  {tester.tests_run - tester.tests_passed} tests failed - see details above")
        return 1

if __name__ == "__main__":
    sys.exit(main())