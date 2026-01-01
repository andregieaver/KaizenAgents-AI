import requests
import sys
import json
import io
import time
from datetime import datetime

class MessagingSystemTester:
    def __init__(self, base_url="https://projectmanager-2.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tenant_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.test_channel_id = None
        self.test_message_id = None

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

    def test_messaging_system(self):
        """Test the complete Slack-inspired messaging system"""
        print(f"\n🎯 Testing Slack-Inspired Messaging System")
        
        # Test all messaging features as requested in review
        login_test = self.test_super_admin_login()
        if not login_test:
            print("❌ Login failed - cannot continue with messaging tests")
            return False
        
        # Test messaging features in order
        channel_creation_test = self.test_create_channel()
        channel_list_test = self.test_list_channels()
        channel_details_test = self.test_get_channel_details()
        channel_join_test = self.test_join_channel()
        send_message_test = self.test_send_message()
        get_messages_test = self.test_get_channel_messages()
        add_reaction_test = self.test_add_reaction()
        edit_message_test = self.test_edit_message()
        dm_creation_test = self.test_create_dm()
        dm_list_test = self.test_list_dms()
        search_test = self.test_search_messages()
        users_test = self.test_get_users()
        unread_test = self.test_get_unread_counts()
        remove_reaction_test = self.test_remove_reaction()
        delete_message_test = self.test_delete_message()
        leave_channel_test = self.test_leave_channel()
        delete_channel_test = self.test_delete_channel()
        
        # Summary of messaging tests
        print(f"\n📋 Messaging System Test Results:")
        print(f"   Super Admin Login: {'✅ PASSED' if login_test else '❌ FAILED'}")
        print(f"   Create Channel: {'✅ PASSED' if channel_creation_test else '❌ FAILED'}")
        print(f"   List Channels: {'✅ PASSED' if channel_list_test else '❌ FAILED'}")
        print(f"   Get Channel Details: {'✅ PASSED' if channel_details_test else '❌ FAILED'}")
        print(f"   Join Channel: {'✅ PASSED' if channel_join_test else '❌ FAILED'}")
        print(f"   Send Message: {'✅ PASSED' if send_message_test else '❌ FAILED'}")
        print(f"   Get Channel Messages: {'✅ PASSED' if get_messages_test else '❌ FAILED'}")
        print(f"   Add Reaction: {'✅ PASSED' if add_reaction_test else '❌ FAILED'}")
        print(f"   Edit Message: {'✅ PASSED' if edit_message_test else '❌ FAILED'}")
        print(f"   Create DM: {'✅ PASSED' if dm_creation_test else '❌ FAILED'}")
        print(f"   List DMs: {'✅ PASSED' if dm_list_test else '❌ FAILED'}")
        print(f"   Search Messages: {'✅ PASSED' if search_test else '❌ FAILED'}")
        print(f"   Get Users: {'✅ PASSED' if users_test else '❌ FAILED'}")
        print(f"   Get Unread Counts: {'✅ PASSED' if unread_test else '❌ FAILED'}")
        print(f"   Remove Reaction: {'✅ PASSED' if remove_reaction_test else '❌ FAILED'}")
        print(f"   Delete Message: {'✅ PASSED' if delete_message_test else '❌ FAILED'}")
        print(f"   Leave Channel: {'✅ PASSED' if leave_channel_test else '❌ FAILED'}")
        print(f"   Delete Channel: {'✅ PASSED' if delete_channel_test else '❌ FAILED'}")
        
        return all([login_test, channel_creation_test, channel_list_test, channel_details_test, 
                   channel_join_test, send_message_test, get_messages_test, add_reaction_test,
                   edit_message_test, dm_creation_test, dm_list_test, search_test, users_test,
                   unread_test, remove_reaction_test, delete_message_test, leave_channel_test,
                   delete_channel_test])

    def test_create_channel(self):
        """Test POST /api/messaging/channels - Create channel"""
        print(f"\n🔧 Testing Create Channel")
        
        # Use query parameters instead of JSON body
        success, response = self.run_test(
            "Create Channel - Sales",
            "POST",
            "messaging/channels?name=sales&description=Sales team channel&is_private=false",
            200
        )
        
        if success:
            self.test_channel_id = response.get("id")
            print(f"   ✅ Channel created with ID: {self.test_channel_id}")
            print(f"   Channel name: {response.get('display_name')}")
            print(f"   Description: {response.get('description')}")
            print(f"   Is private: {response.get('is_private')}")
            print(f"   Created by: {response.get('created_by')}")
            
            # Verify no MongoDB _id in response
            if '_id' in response:
                print("   ❌ MongoDB _id found in response - serialization issue")
                return False
            else:
                print("   ✅ No MongoDB _id in response - serialization working")
        
        return success

    def test_list_channels(self):
        """Test GET /api/messaging/channels - List all channels"""
        print(f"\n🔧 Testing List Channels")
        
        success, response = self.run_test(
            "List All Channels",
            "GET",
            "messaging/channels",
            200
        )
        
        if success:
            if isinstance(response, list):
                print(f"   ✅ Found {len(response)} channels")
                for channel in response:
                    print(f"   - {channel.get('display_name')} ({channel.get('name')})")
                    print(f"     ID: {channel.get('id')}")
                    print(f"     Members: {len(channel.get('members', []))}")
                    print(f"     Unread: {channel.get('unread_count', 0)}")
                    
                    # Verify no MongoDB _id in response
                    if '_id' in channel:
                        print("   ❌ MongoDB _id found in channel - serialization issue")
                        return False
                
                print("   ✅ No MongoDB _id in any channel - serialization working")
            else:
                print("   ❌ Expected array response")
                return False
        
        return success

    def test_get_channel_details(self):
        """Test GET /api/messaging/channels/{channel_id} - Get channel details"""
        print(f"\n🔧 Testing Get Channel Details")
        
        if not hasattr(self, 'test_channel_id') or not self.test_channel_id:
            print("❌ No channel ID available for details test")
            return False
        
        success, response = self.run_test(
            "Get Channel Details",
            "GET",
            f"messaging/channels/{self.test_channel_id}",
            200
        )
        
        if success:
            print(f"   ✅ Channel details retrieved")
            print(f"   Name: {response.get('display_name')}")
            print(f"   Description: {response.get('description')}")
            print(f"   Members: {len(response.get('member_details', []))}")
            
            # Check member details structure
            member_details = response.get('member_details', [])
            if member_details:
                print(f"   Member details:")
                for member in member_details:
                    print(f"     - {member.get('name')} ({member.get('email')})")
                    
                    # Verify no MongoDB _id in member details
                    if '_id' in member:
                        print("   ❌ MongoDB _id found in member details - serialization issue")
                        return False
            
            # Verify no MongoDB _id in response
            if '_id' in response:
                print("   ❌ MongoDB _id found in response - serialization issue")
                return False
            else:
                print("   ✅ No MongoDB _id in response - serialization working")
        
        return success

    def test_join_channel(self):
        """Test POST /api/messaging/channels/{channel_id}/join - Join channel"""
        print(f"\n🔧 Testing Join Channel")
        
        if not hasattr(self, 'test_channel_id') or not self.test_channel_id:
            print("❌ No channel ID available for join test")
            return False
        
        success, response = self.run_test(
            "Join Channel",
            "POST",
            f"messaging/channels/{self.test_channel_id}/join",
            200
        )
        
        if success:
            print(f"   ✅ Successfully joined channel")
            print(f"   Message: {response.get('message')}")
        
        return success

    def test_send_message(self):
        """Test POST /api/messaging/messages - Send message"""
        print(f"\n🔧 Testing Send Message")
        
        if not hasattr(self, 'test_channel_id') or not self.test_channel_id:
            print("❌ No channel ID available for message test")
            return False
        
        # Use query parameters instead of JSON body
        success, response = self.run_test(
            "Send Message to Channel",
            "POST",
            f"messaging/messages?content=Test message&channel_id={self.test_channel_id}",
            200
        )
        
        if success:
            self.test_message_id = response.get("id")
            print(f"   ✅ Message sent with ID: {self.test_message_id}")
            print(f"   Content: {response.get('content')}")
            print(f"   Author: {response.get('author_name')}")
            print(f"   Channel ID: {response.get('channel_id')}")
            
            # Verify no MongoDB _id in response
            if '_id' in response:
                print("   ❌ MongoDB _id found in response - serialization issue")
                return False
            else:
                print("   ✅ No MongoDB _id in response - serialization working")
        
        return success

    def test_get_channel_messages(self):
        """Test GET /api/messaging/messages?channel_id={id} - Get channel messages"""
        print(f"\n🔧 Testing Get Channel Messages")
        
        if not hasattr(self, 'test_channel_id') or not self.test_channel_id:
            print("❌ No channel ID available for messages test")
            return False
        
        success, response = self.run_test(
            "Get Channel Messages",
            "GET",
            f"messaging/messages?channel_id={self.test_channel_id}",
            200
        )
        
        if success:
            if isinstance(response, list):
                print(f"   ✅ Found {len(response)} messages")
                for msg in response:
                    print(f"   - {msg.get('author_name')}: {msg.get('content')[:50]}...")
                    print(f"     ID: {msg.get('id')}")
                    print(f"     Created: {msg.get('created_at')}")
                    
                    # Verify no MongoDB _id in response
                    if '_id' in msg:
                        print("   ❌ MongoDB _id found in message - serialization issue")
                        return False
                
                print("   ✅ No MongoDB _id in any message - serialization working")
            else:
                print("   ❌ Expected array response")
                return False
        
        return success

    def test_add_reaction(self):
        """Test POST /api/messaging/messages/{message_id}/reactions - Add reaction"""
        print(f"\n🔧 Testing Add Reaction")
        
        if not hasattr(self, 'test_message_id') or not self.test_message_id:
            print("❌ No message ID available for reaction test")
            return False
        
        # Use query parameter instead of JSON body
        success, response = self.run_test(
            "Add Reaction to Message",
            "POST",
            f"messaging/messages/{self.test_message_id}/reactions?emoji=👍",
            200
        )
        
        if success:
            print(f"   ✅ Reaction added successfully")
            reactions = response.get('reactions', {})
            print(f"   Reactions: {reactions}")
            
            # Verify reaction structure
            if '👍' in reactions and isinstance(reactions['👍'], list):
                print(f"   ✅ Reaction structure is correct")
            else:
                print(f"   ❌ Unexpected reaction structure")
                return False
        
        return success

    def test_edit_message(self):
        """Test PUT /api/messaging/messages/{message_id} - Edit message"""
        print(f"\n🔧 Testing Edit Message")
        
        if not hasattr(self, 'test_message_id') or not self.test_message_id:
            print("❌ No message ID available for edit test")
            return False
        
        # Use query parameter instead of JSON body
        success, response = self.run_test(
            "Edit Message",
            "PUT",
            f"messaging/messages/{self.test_message_id}?content=Edited test message",
            200
        )
        
        if success:
            print(f"   ✅ Message edited successfully")
            print(f"   New content: {response.get('content')}")
            print(f"   Is edited: {response.get('is_edited')}")
            
            # Verify no MongoDB _id in response
            if '_id' in response:
                print("   ❌ MongoDB _id found in response - serialization issue")
                return False
            else:
                print("   ✅ No MongoDB _id in response - serialization working")
        
        return success

    def test_create_dm(self):
        """Test POST /api/messaging/dm - Create or get DM conversation"""
        print(f"\n🔧 Testing Create DM Conversation")
        
        # Use query parameter instead of JSON body
        participant_id = self.user_data.get('id') if self.user_data else "test-user-id"
        
        # This should fail with 400 since we can't DM ourselves
        success, response = self.run_test(
            "Create DM Conversation (Expected to fail)",
            "POST",
            f"messaging/dm?participant_id={participant_id}",
            400  # Expecting 400 error
        )
        
        if success:  # Success means we got the expected 400 error
            print(f"   ✅ DM creation correctly rejected (cannot DM yourself)")
            print(f"   Error message: {response.get('detail', 'No detail')}")
        
        return success

    def test_list_dms(self):
        """Test GET /api/messaging/dm - List DM conversations"""
        print(f"\n🔧 Testing List DM Conversations")
        
        success, response = self.run_test(
            "List DM Conversations",
            "GET",
            "messaging/dm",
            200
        )
        
        if success:
            if isinstance(response, list):
                print(f"   ✅ Found {len(response)} DM conversations")
                for dm in response:
                    print(f"   - DM ID: {dm.get('id')}")
                    other_user = dm.get('other_user', {})
                    print(f"     With: {other_user.get('name', 'Unknown')} ({other_user.get('email', 'No email')})")
                    print(f"     Online: {dm.get('is_online', False)}")
                    print(f"     Unread: {dm.get('unread_count', 0)}")
                    
                    # Verify no MongoDB _id in response
                    if '_id' in dm:
                        print("   ❌ MongoDB _id found in DM - serialization issue")
                        return False
                
                print("   ✅ No MongoDB _id in any DM - serialization working")
            else:
                print("   ❌ Expected array response")
                return False
        
        return success

    def test_search_messages(self):
        """Test GET /api/messaging/search?q=test - Search messages"""
        print(f"\n🔧 Testing Search Messages")
        
        success, response = self.run_test(
            "Search Messages",
            "GET",
            "messaging/search?q=test",
            200
        )
        
        if success:
            if isinstance(response, list):
                print(f"   ✅ Found {len(response)} messages matching 'test'")
                for msg in response:
                    print(f"   - {msg.get('author_name')}: {msg.get('content')[:50]}...")
                    
                    # Verify no MongoDB _id in response
                    if '_id' in msg:
                        print("   ❌ MongoDB _id found in message - serialization issue")
                        return False
                
                print("   ✅ No MongoDB _id in any message - serialization working")
            else:
                print("   ❌ Expected array response")
                return False
        
        return success

    def test_get_users(self):
        """Test GET /api/messaging/users - Get users with online status"""
        print(f"\n🔧 Testing Get Users with Online Status")
        
        success, response = self.run_test(
            "Get Users with Online Status",
            "GET",
            "messaging/users",
            200
        )
        
        if success:
            if isinstance(response, list):
                print(f"   ✅ Found {len(response)} users")
                for user in response:
                    print(f"   - {user.get('name')} ({user.get('email')})")
                    print(f"     Role: {user.get('role')}")
                    print(f"     Online: {user.get('is_online', False)}")
                    print(f"     Last seen: {user.get('last_seen', 'Never')}")
                    
                    # Verify no MongoDB _id in response
                    if '_id' in user:
                        print("   ❌ MongoDB _id found in user - serialization issue")
                        return False
                
                print("   ✅ No MongoDB _id in any user - serialization working")
            else:
                print("   ❌ Expected array response")
                return False
        
        return success

    def test_get_unread_counts(self):
        """Test GET /api/messaging/unread - Get unread counts"""
        print(f"\n🔧 Testing Get Unread Counts")
        
        success, response = self.run_test(
            "Get Unread Counts",
            "GET",
            "messaging/unread",
            200
        )
        
        if success:
            total_unread = response.get('total_unread', 0)
            print(f"   ✅ Total unread messages: {total_unread}")
            
            # Verify response structure
            if 'total_unread' in response and isinstance(total_unread, int):
                print(f"   ✅ Unread count structure is correct")
            else:
                print(f"   ❌ Unexpected unread count structure")
                return False
        
        return success

    def test_remove_reaction(self):
        """Test DELETE /api/messaging/messages/{message_id}/reactions/{emoji} - Remove reaction"""
        print(f"\n🔧 Testing Remove Reaction")
        
        if not hasattr(self, 'test_message_id') or not self.test_message_id:
            print("❌ No message ID available for reaction removal test")
            return False
        
        success, response = self.run_test(
            "Remove Reaction from Message",
            "DELETE",
            f"messaging/messages/{self.test_message_id}/reactions/👍",
            200
        )
        
        if success:
            print(f"   ✅ Reaction removed successfully")
            reactions = response.get('reactions', {})
            print(f"   Remaining reactions: {reactions}")
        
        return success

    def test_delete_message(self):
        """Test DELETE /api/messaging/messages/{message_id} - Delete message"""
        print(f"\n🔧 Testing Delete Message")
        
        if not hasattr(self, 'test_message_id') or not self.test_message_id:
            print("❌ No message ID available for delete test")
            return False
        
        success, response = self.run_test(
            "Delete Message",
            "DELETE",
            f"messaging/messages/{self.test_message_id}",
            200
        )
        
        if success:
            print(f"   ✅ Message deleted successfully")
            print(f"   Success: {response.get('success')}")
        
        return success

    def test_leave_channel(self):
        """Test POST /api/messaging/channels/{channel_id}/leave - Leave channel"""
        print(f"\n🔧 Testing Leave Channel")
        
        if not hasattr(self, 'test_channel_id') or not self.test_channel_id:
            print("❌ No channel ID available for leave test")
            return False
        
        # This should fail since the creator cannot leave their own channel
        success, response = self.run_test(
            "Leave Channel (Expected to fail - creator cannot leave)",
            "POST",
            f"messaging/channels/{self.test_channel_id}/leave",
            400  # Expecting 400 error
        )
        
        if success:  # Success means we got the expected 400 error
            print(f"   ✅ Leave channel correctly rejected (creator cannot leave)")
            print(f"   Error message: {response.get('detail', 'No detail')}")
        
        return success

    def test_delete_channel(self):
        """Test DELETE /api/messaging/channels/{channel_id} - Delete channel"""
        print(f"\n🔧 Testing Delete Channel")
        
        if not hasattr(self, 'test_channel_id') or not self.test_channel_id:
            print("❌ No channel ID available for delete test")
            return False
        
        success, response = self.run_test(
            "Delete Channel",
            "DELETE",
            f"messaging/channels/{self.test_channel_id}",
            200
        )
        
        if success:
            print(f"   ✅ Channel deleted successfully")
            print(f"   Message: {response.get('message')}")
        
        return success


if __name__ == "__main__":
    tester = MessagingSystemTester()
    # Run the messaging system tests as requested
    success = tester.test_messaging_system()
    
    # Print final summary
    print(f"\n📊 Final Test Summary:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    print(f"   Overall Result: {'✅ SUCCESS' if success else '❌ FAILED'}")