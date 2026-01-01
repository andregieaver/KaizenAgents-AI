#!/usr/bin/env python3
"""
Discount Code Functionality Tests
Test the Discount Code functionality end-to-end as requested in review.
"""

import requests
import sys
import json
from datetime import datetime

class DiscountCodeTester:
    def __init__(self, base_url="https://projectsync-app-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tenant_id = None
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

    def test_list_existing_discount_codes(self):
        """Test 1: GET /api/discounts - Should return list including TEST25 code"""
        print(f"\n🔧 Testing 1: List existing discount codes")
        
        success, response = self.run_test(
            "GET /api/discounts - List Existing Codes",
            "GET",
            "discounts",
            200
        )
        
        if not success:
            print("❌ Failed to get discount codes list")
            return False
            
        # Verify response is an array
        if not isinstance(response, list):
            print(f"❌ Expected array response, got {type(response)}")
            return False
            
        print(f"   ✅ Found {len(response)} discount codes")
        
        # Look for TEST25 code specifically
        test25_found = False
        for code in response:
            print(f"   - {code.get('code', 'Unknown')} ({code.get('name', 'No name')}) - {code.get('discount_type', 'Unknown')} - {code.get('value', 0)}{'%' if code.get('discount_type') == 'percentage' else ''}")
            if code.get('code') == 'TEST25':
                test25_found = True
                print(f"     ✅ TEST25 code found: {code.get('name', 'No name')}")
                
        if test25_found:
            print(f"   ✅ TEST25 code is present in the list")
        else:
            print(f"   ⚠️ TEST25 code not found - may need to be created first")
            # Try to create TEST25 code for testing
            self._create_test25_code()
            
        return True

    def _create_test25_code(self):
        """Helper method to create TEST25 code if it doesn't exist"""
        print(f"   🔧 Creating TEST25 code for testing...")
        
        test_code_data = {
            "code": "TEST25",
            "name": "Test 25% Discount",
            "description": "Test discount code for automated testing",
            "discount_type": "percentage",
            "value": 25.0,
            "max_uses": None,
            "expires_at": None,
            "applicable_plans": None,
            "min_plan_price": None,
            "is_active": True,
            "is_first_time_only": False
        }
        
        success, response = self.run_test(
            "Create TEST25 Code",
            "POST",
            "discounts",
            200,
            data=test_code_data
        )
        
        if success:
            print(f"   ✅ TEST25 code created successfully")
        else:
            print(f"   ⚠️ Could not create TEST25 code - may already exist")

    def test_apply_valid_discount_code(self):
        """Test 2: Apply TEST25 code to monthly plan"""
        print(f"\n🔧 Testing 2: Apply valid discount code (TEST25)")
        
        apply_data = {
            "code": "TEST25",
            "plan_id": "2fa0c312-981c-4fa9-8e9f-4bbd6593764c",
            "billing_cycle": "monthly"
        }
        
        success, response = self.run_test(
            "POST /api/discounts/apply - Valid Code (TEST25)",
            "POST",
            "discounts/apply",
            200,
            data=apply_data
        )
        
        if not success:
            print("❌ Failed to apply valid discount code")
            return False
            
        # Verify response structure
        required_fields = ['valid', 'message']
        for field in required_fields:
            if field not in response:
                print(f"❌ Missing required field: {field}")
                return False
                
        # Check if discount was applied successfully
        if not response.get('valid'):
            print(f"❌ Discount code was not valid: {response.get('message', 'No message')}")
            return False
            
        print(f"   ✅ Discount code applied successfully")
        print(f"   Message: {response.get('message', 'No message')}")
        print(f"   Discount Type: {response.get('discount_type', 'Unknown')}")
        print(f"   Discount Value: {response.get('discount_value', 'Unknown')}")
        print(f"   Original Price: ${response.get('original_price', 'Unknown')}")
        print(f"   Discounted Price: ${response.get('discounted_price', 'Unknown')}")
        
        # Verify discount calculation for 25% off
        original_price = response.get('original_price')
        discounted_price = response.get('discounted_price')
        discount_value = response.get('discount_value')
        
        if original_price and discounted_price and discount_value:
            expected_discount = original_price * (discount_value / 100)
            expected_price = original_price - expected_discount
            
            if abs(discounted_price - expected_price) < 0.01:  # Allow for rounding
                print(f"   ✅ Discount calculation is correct: {discount_value}% off ${original_price} = ${discounted_price}")
            else:
                print(f"   ⚠️ Discount calculation may be incorrect: expected ${expected_price}, got ${discounted_price}")
                
        return True

    def test_apply_invalid_discount_code(self):
        """Test 3: Apply invalid discount code"""
        print(f"\n🔧 Testing 3: Apply invalid discount code (INVALID123)")
        
        apply_data = {
            "code": "INVALID123",
            "plan_id": "2fa0c312-981c-4fa9-8e9f-4bbd6593764c",
            "billing_cycle": "monthly"
        }
        
        success, response = self.run_test(
            "POST /api/discounts/apply - Invalid Code",
            "POST",
            "discounts/apply",
            200,
            data=apply_data
        )
        
        if not success:
            print("❌ Failed to test invalid discount code")
            return False
            
        # Verify response structure
        if 'valid' not in response or 'message' not in response:
            print("❌ Missing required fields in response")
            return False
            
        # Check if discount was properly rejected
        if response.get('valid'):
            print(f"❌ Invalid discount code was accepted - this should not happen")
            return False
            
        print(f"   ✅ Invalid discount code properly rejected")
        print(f"   Message: {response.get('message', 'No message')}")
        
        # Verify error message is appropriate
        error_message = response.get('message', '').lower()
        if 'invalid' in error_message or 'not found' in error_message:
            print(f"   ✅ Error message is appropriate")
        else:
            print(f"   ⚠️ Error message may not be clear: {response.get('message')}")
            
        return True

    def test_yearly_billing_cycle(self):
        """Test 4: Apply TEST25 code to yearly billing cycle"""
        print(f"\n🔧 Testing 4: Apply TEST25 code to yearly billing cycle")
        
        apply_data = {
            "code": "TEST25",
            "plan_id": "2fa0c312-981c-4fa9-8e9f-4bbd6593764c",
            "billing_cycle": "yearly"
        }
        
        success, response = self.run_test(
            "POST /api/discounts/apply - Yearly Billing",
            "POST",
            "discounts/apply",
            200,
            data=apply_data
        )
        
        if not success:
            print("❌ Failed to apply discount to yearly billing")
            return False
            
        # Verify response structure and validity
        if not response.get('valid'):
            print(f"❌ Discount code was not valid for yearly billing: {response.get('message', 'No message')}")
            return False
            
        print(f"   ✅ Discount code applied to yearly billing successfully")
        print(f"   Message: {response.get('message', 'No message')}")
        print(f"   Original Price (Yearly): ${response.get('original_price', 'Unknown')}")
        print(f"   Discounted Price (Yearly): ${response.get('discounted_price', 'Unknown')}")
        
        # Store yearly price for comparison
        yearly_original = response.get('original_price')
        yearly_discounted = response.get('discounted_price')
        
        # Verify yearly pricing is different from monthly
        # (This assumes yearly pricing is different - typically it's discounted)
        if yearly_original:
            print(f"   ✅ Yearly pricing retrieved: ${yearly_original}")
            
            # Verify discount calculation
            discount_value = response.get('discount_value', 25)  # Should be 25%
            if yearly_discounted:
                expected_yearly = yearly_original * (1 - discount_value / 100)
                if abs(yearly_discounted - expected_yearly) < 0.01:
                    print(f"   ✅ Yearly discount calculation is correct")
                else:
                    print(f"   ⚠️ Yearly discount calculation may be incorrect")
                    
        return True

    def test_verify_discount_code_incrementing(self):
        """Test 5: Verify discount code usage incrementing"""
        print(f"\n🔧 Testing 5: Verify discount code usage incrementing")
        
        # First, get current usage count for TEST25
        success, response = self.run_test(
            "GET /api/discounts - Check Current Usage",
            "GET",
            "discounts",
            200
        )
        
        if not success:
            print("❌ Failed to get discount codes for usage check")
            return False
            
        # Find TEST25 code and its current usage
        test25_code = None
        initial_uses = 0
        
        for code in response:
            if code.get('code') == 'TEST25':
                test25_code = code
                initial_uses = code.get('current_uses', 0)
                break
                
        if not test25_code:
            print("❌ TEST25 code not found for usage verification")
            return False
            
        print(f"   Current usage count for TEST25: {initial_uses}")
        
        # Test the usage increment endpoint
        success, response = self.run_test(
            "POST /api/discounts/use/TEST25 - Increment Usage",
            "POST",
            "discounts/use/TEST25",
            200
        )
        
        if not success:
            print("❌ Failed to increment discount code usage")
            return False
            
        print(f"   ✅ Usage increment endpoint called successfully")
        print(f"   Message: {response.get('message', 'No message')}")
        
        # Verify usage count increased
        success, response = self.run_test(
            "GET /api/discounts - Verify Usage Incremented",
            "GET",
            "discounts",
            200
        )
        
        if success:
            for code in response:
                if code.get('code') == 'TEST25':
                    new_uses = code.get('current_uses', 0)
                    print(f"   New usage count for TEST25: {new_uses}")
                    
                    if new_uses > initial_uses:
                        print(f"   ✅ Usage count incremented correctly: {initial_uses} → {new_uses}")
                        return True
                    else:
                        print(f"   ⚠️ Usage count did not increment: {initial_uses} → {new_uses}")
                        return False
                        
        print("❌ Could not verify usage increment")
        return False

    def run_discount_tests(self):
        """Run all discount code tests"""
        print("🎯 Starting Discount Code Functionality Tests")
        print(f"   Base URL: {self.base_url}")
        print(f"   Credentials: andre@humanweb.no / Pernilla66!")
        print(f"   Test started at: {datetime.now()}")
        
        # Authentication test
        if not self.test_super_admin_login():
            print("❌ Login failed - stopping tests")
            return False
            
        # Run all discount code tests as requested in review
        list_codes_test = self.test_list_existing_discount_codes()
        apply_valid_test = self.test_apply_valid_discount_code()
        apply_invalid_test = self.test_apply_invalid_discount_code()
        yearly_billing_test = self.test_yearly_billing_cycle()
        verify_increment_test = self.test_verify_discount_code_incrementing()
        
        # Summary of discount code tests
        print(f"\n📋 Discount Code Functionality Test Results:")
        print(f"   1. List existing discount codes: {'✅ PASSED' if list_codes_test else '❌ FAILED'}")
        print(f"   2. Apply valid discount code: {'✅ PASSED' if apply_valid_test else '❌ FAILED'}")
        print(f"   3. Apply invalid discount code: {'✅ PASSED' if apply_invalid_test else '❌ FAILED'}")
        print(f"   4. Test yearly billing cycle: {'✅ PASSED' if yearly_billing_test else '❌ FAILED'}")
        print(f"   5. Verify discount code incrementing: {'✅ PASSED' if verify_increment_test else '❌ FAILED'}")
        
        # Print final summary
        print(f"\n📊 Test Summary:")
        print(f"   Tests Run: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        all_passed = all([list_codes_test, apply_valid_test, apply_invalid_test, yearly_billing_test, verify_increment_test])
        
        if all_passed:
            print("🎉 All discount code tests passed!")
        else:
            failed_tests = []
            if not list_codes_test: failed_tests.append("List existing codes")
            if not apply_valid_test: failed_tests.append("Apply valid code")
            if not apply_invalid_test: failed_tests.append("Apply invalid code")
            if not yearly_billing_test: failed_tests.append("Yearly billing cycle")
            if not verify_increment_test: failed_tests.append("Usage incrementing")
            
            print(f"⚠️ Failed tests: {', '.join(failed_tests)}")
            
        return all_passed

if __name__ == "__main__":
    tester = DiscountCodeTester()
    success = tester.run_discount_tests()
    sys.exit(0 if success else 1)