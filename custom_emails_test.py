#!/usr/bin/env python3
"""
Custom Emails/Campaigns Backend API Tests
Tests the Custom Emails/Campaigns feature as requested in review
"""

import requests
import sys
import json
from datetime import datetime

class CustomEmailsTester:
    def __init__(self, base_url="https://coderefactor-6.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tenant_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_email_id = None
        self.duplicate_email_id = None

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

    def test_get_recipient_categories(self):
        """Test GET /api/custom-emails/categories"""
        print(f"\n🔧 Testing Get Recipient Categories")
        
        success, response = self.run_test(
            "Get Recipient Categories",
            "GET",
            "custom-emails/categories",
            200
        )
        
        if not success:
            print("❌ Failed to get recipient categories")
            return False
            
        if not isinstance(response, list):
            print(f"❌ Expected array response, got {type(response)}")
            return False
            
        print(f"   ✅ Found {len(response)} recipient categories")
        
        # Verify expected categories are present
        expected_categories = [
            "all_users", "waitlist_all", "waitlist_pending", "waitlist_approved",
            "plan_free", "plan_starter", "plan_professional", "paid_users",
            "team_owners", "super_admins"
        ]
        
        found_categories = [cat.get("id") for cat in response]
        
        for expected in expected_categories:
            if expected in found_categories:
                category_data = next((cat for cat in response if cat.get("id") == expected), {})
                print(f"   ✅ {category_data.get('name', expected)}: {category_data.get('count', 0)} recipients")
            else:
                print(f"   ⚠️ Expected category '{expected}' not found")
        
        # Verify category structure
        if response:
            first_category = response[0]
            required_fields = ["id", "name", "description", "count"]
            for field in required_fields:
                if field not in first_category:
                    print(f"   ❌ Missing required field '{field}' in category")
                    return False
            print(f"   ✅ Category structure is correct")
        
        return True

    def test_create_custom_email(self):
        """Test POST /api/custom-emails"""
        print(f"\n🔧 Testing Create Custom Email")
        
        email_data = {
            "name": "Welcome Campaign",
            "subject": "Welcome to {{platform_name}}!",
            "html_content": "<h1>Hello {{user_name}}</h1><p>Welcome to our platform!</p>",
            "recipient_category": "waitlist_all",
            "status": "draft"
        }
        
        success, response = self.run_test(
            "Create Custom Email",
            "POST",
            "custom-emails",
            200,
            data=email_data
        )
        
        if not success:
            print("❌ Failed to create custom email")
            return False
            
        # Verify response structure
        required_fields = [
            "id", "name", "subject", "html_content", "recipient_category", 
            "status", "sent_count", "failed_count", "created_at", "updated_at", "created_by"
        ]
        
        for field in required_fields:
            if field not in response:
                print(f"   ❌ Missing required field '{field}' in response")
                return False
                
        print(f"   ✅ Custom email created successfully")
        print(f"   Email ID: {response.get('id')}")
        print(f"   Name: {response.get('name')}")
        print(f"   Subject: {response.get('subject')}")
        print(f"   Category: {response.get('recipient_category')}")
        print(f"   Status: {response.get('status')}")
        print(f"   Created by: {response.get('created_by')}")
        
        # Store email ID for other tests
        self.created_email_id = response.get('id')
        
        # Verify initial counts
        if response.get('sent_count') != 0:
            print(f"   ❌ Expected sent_count to be 0, got {response.get('sent_count')}")
            return False
            
        if response.get('failed_count') != 0:
            print(f"   ❌ Expected failed_count to be 0, got {response.get('failed_count')}")
            return False
            
        print(f"   ✅ Initial counts are correct (sent: 0, failed: 0)")
        
        return True

    def test_get_all_custom_emails(self):
        """Test GET /api/custom-emails"""
        print(f"\n🔧 Testing Get All Custom Emails")
        
        success, response = self.run_test(
            "Get All Custom Emails",
            "GET",
            "custom-emails",
            200
        )
        
        if not success:
            print("❌ Failed to get all custom emails")
            return False
            
        if not isinstance(response, list):
            print(f"❌ Expected array response, got {type(response)}")
            return False
            
        print(f"   ✅ Retrieved {len(response)} custom emails")
        
        # Verify our created email is in the list
        if hasattr(self, 'created_email_id') and self.created_email_id:
            found_email = next((email for email in response if email.get('id') == self.created_email_id), None)
            if found_email:
                print(f"   ✅ Created email found in list: {found_email.get('name')}")
            else:
                print(f"   ❌ Created email not found in list")
                return False
        
        # Verify email structure if any emails exist
        if response:
            first_email = response[0]
            required_fields = [
                "id", "name", "subject", "html_content", "recipient_category", 
                "status", "sent_count", "failed_count", "created_at", "updated_at"
            ]
            for field in required_fields:
                if field not in first_email:
                    print(f"   ❌ Missing required field '{field}' in email")
                    return False
            print(f"   ✅ Email structure is correct")
        
        return True

    def test_update_custom_email(self):
        """Test PATCH /api/custom-emails/{id}"""
        print(f"\n🔧 Testing Update Custom Email")
        
        if not hasattr(self, 'created_email_id') or not self.created_email_id:
            print("❌ No created email ID available for update test")
            return False
            
        update_data = {
            "subject": "Updated Subject - Welcome to {{platform_name}}!"
        }
        
        success, response = self.run_test(
            "Update Custom Email",
            "PATCH",
            f"custom-emails/{self.created_email_id}",
            200,
            data=update_data
        )
        
        if not success:
            print("❌ Failed to update custom email")
            return False
            
        # Verify the subject was updated
        if response.get('subject') != update_data['subject']:
            print(f"   ❌ Subject not updated correctly")
            print(f"   Expected: {update_data['subject']}")
            print(f"   Got: {response.get('subject')}")
            return False
            
        print(f"   ✅ Custom email updated successfully")
        print(f"   New subject: {response.get('subject')}")
        print(f"   Updated at: {response.get('updated_at')}")
        
        # Verify other fields remain unchanged
        if response.get('name') != "Welcome Campaign":
            print(f"   ❌ Name should remain unchanged")
            return False
            
        if response.get('status') != "draft":
            print(f"   ❌ Status should remain unchanged")
            return False
            
        print(f"   ✅ Other fields remained unchanged as expected")
        
        return True

    def test_duplicate_custom_email(self):
        """Test POST /api/custom-emails/{id}/duplicate"""
        print(f"\n🔧 Testing Duplicate Custom Email")
        
        if not hasattr(self, 'created_email_id') or not self.created_email_id:
            print("❌ No created email ID available for duplicate test")
            return False
            
        success, response = self.run_test(
            "Duplicate Custom Email",
            "POST",
            f"custom-emails/{self.created_email_id}/duplicate",
            200
        )
        
        if not success:
            print("❌ Failed to duplicate custom email")
            return False
            
        # Verify duplicate has different ID
        if response.get('id') == self.created_email_id:
            print(f"   ❌ Duplicate should have different ID")
            return False
            
        # Verify name has "(Copy)" appended
        expected_name = "Welcome Campaign (Copy)"
        if response.get('name') != expected_name:
            print(f"   ❌ Expected name '{expected_name}', got '{response.get('name')}'")
            return False
            
        # Verify status is reset to draft
        if response.get('status') != "draft":
            print(f"   ❌ Duplicate status should be 'draft', got '{response.get('status')}'")
            return False
            
        # Verify counts are reset
        if response.get('sent_count') != 0 or response.get('failed_count') != 0:
            print(f"   ❌ Duplicate counts should be reset to 0")
            return False
            
        print(f"   ✅ Custom email duplicated successfully")
        print(f"   Duplicate ID: {response.get('id')}")
        print(f"   Duplicate name: {response.get('name')}")
        print(f"   Status: {response.get('status')}")
        
        # Store duplicate ID for cleanup
        self.duplicate_email_id = response.get('id')
        
        return True

    def test_delete_custom_email(self):
        """Test DELETE /api/custom-emails/{id}"""
        print(f"\n🔧 Testing Delete Custom Email")
        
        # Delete the duplicate first
        if hasattr(self, 'duplicate_email_id') and self.duplicate_email_id:
            success, response = self.run_test(
                "Delete Duplicate Custom Email",
                "DELETE",
                f"custom-emails/{self.duplicate_email_id}",
                200
            )
            
            if success:
                print(f"   ✅ Duplicate email deleted successfully")
                if response.get('message'):
                    print(f"   Message: {response.get('message')}")
            else:
                print(f"   ❌ Failed to delete duplicate email")
                return False
        
        # Delete the original created email
        if hasattr(self, 'created_email_id') and self.created_email_id:
            success, response = self.run_test(
                "Delete Original Custom Email",
                "DELETE",
                f"custom-emails/{self.created_email_id}",
                200
            )
            
            if success:
                print(f"   ✅ Original email deleted successfully")
                if response.get('message'):
                    print(f"   Message: {response.get('message')}")
                    
                # Verify email is actually deleted by trying to get it
                success, response = self.run_test(
                    "Verify Email Deleted",
                    "GET",
                    f"custom-emails/{self.created_email_id}",
                    404
                )
                
                if success:
                    print(f"   ✅ Email confirmed deleted (404 response)")
                else:
                    print(f"   ❌ Email may not be properly deleted")
                    return False
                    
                return True
            else:
                print(f"   ❌ Failed to delete original email")
                return False
        else:
            print("❌ No created email ID available for delete test")
            return False

    def run_all_tests(self):
        """Run all Custom Emails/Campaigns tests"""
        print("🚀 Starting Custom Emails/Campaigns Backend API Tests")
        print(f"   Base URL: {self.base_url}")
        print("=" * 80)
        
        # Authentication Test
        if not self.test_super_admin_login():
            print("❌ Login failed - stopping tests")
            return False
        
        # Custom Emails Tests
        categories_test = self.test_get_recipient_categories()
        create_test = self.test_create_custom_email()
        get_all_test = self.test_get_all_custom_emails()
        update_test = self.test_update_custom_email()
        duplicate_test = self.test_duplicate_custom_email()
        delete_test = self.test_delete_custom_email()
        
        # Summary
        print("\n" + "=" * 80)
        print(f"📋 Custom Emails/Campaigns Test Results:")
        print(f"   Get Recipient Categories: {'✅ PASSED' if categories_test else '❌ FAILED'}")
        print(f"   Create Custom Email: {'✅ PASSED' if create_test else '❌ FAILED'}")
        print(f"   Get All Custom Emails: {'✅ PASSED' if get_all_test else '❌ FAILED'}")
        print(f"   Update Custom Email: {'✅ PASSED' if update_test else '❌ FAILED'}")
        print(f"   Duplicate Custom Email: {'✅ PASSED' if duplicate_test else '❌ FAILED'}")
        print(f"   Delete Custom Email: {'✅ PASSED' if delete_test else '❌ FAILED'}")
        
        print(f"\n🏁 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        all_tests_passed = all([categories_test, create_test, get_all_test, update_test, duplicate_test, delete_test])
        
        if all_tests_passed:
            print("✅ All Custom Emails/Campaigns tests passed!")
        else:
            print(f"❌ Some tests failed")
            
        return all_tests_passed

if __name__ == "__main__":
    tester = CustomEmailsTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)