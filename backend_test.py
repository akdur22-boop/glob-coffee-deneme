#!/usr/bin/env python3
"""
Comprehensive Backend Test for Push Notification System and Security Features
Tests the complete flow as requested in the review request.
"""

import requests
import json
import time
import sys

# Backend URL from frontend .env
BASE_URL = "https://coffee-admin-portal.preview.emergentagent.com/api"

def log_test(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    print()

def test_push_notification_and_security_flow():
    """Test the complete push notification system and security features end-to-end"""
    
    print("🔥 TESTING PUSH NOTIFICATION SYSTEM AND SECURITY FEATURES")
    print("=" * 70)
    
    session_token = None
    admin_token = None
    test_results = []
    
    # Test 1: Register a test user
    print("1️⃣ REGISTERING TEST USER")
    try:
        response = requests.post(f"{BASE_URL}/auth/register", 
            json={
                "name": "Bildirim Test",
                "email": "bildirim@test.com", 
                "password": "test123456"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 201 or response.status_code == 200:
            data = response.json()
            session_token = data.get("session_token")
            log_test("User Registration", True, f"User registered successfully. Token: {session_token[:20]}...")
            test_results.append(("User Registration", True))
        else:
            log_test("User Registration", False, f"Status: {response.status_code}, Response: {response.text}")
            test_results.append(("User Registration", False))
            return test_results
            
    except Exception as e:
        log_test("User Registration", False, f"Exception: {str(e)}")
        test_results.append(("User Registration", False))
        return test_results
    
    # Test 2: Check user has no notifications (or only welcome notifications)
    print("2️⃣ CHECKING INITIAL NOTIFICATIONS")
    try:
        response = requests.get(f"{BASE_URL}/notifications",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        if response.status_code == 200:
            notifications = response.json()
            log_test("Initial Notifications Check", True, f"Found {len(notifications)} initial notifications")
            test_results.append(("Initial Notifications Check", True))
        else:
            log_test("Initial Notifications Check", False, f"Status: {response.status_code}, Response: {response.text}")
            test_results.append(("Initial Notifications Check", False))
            
    except Exception as e:
        log_test("Initial Notifications Check", False, f"Exception: {str(e)}")
        test_results.append(("Initial Notifications Check", False))
    
    # Test 3: Admin login
    print("3️⃣ ADMIN LOGIN")
    try:
        response = requests.post(f"{BASE_URL}/admin/login",
            json={
                "email": "admin@globcoffee.com",
                "password": "admin123"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            admin_token = data.get("token")
            log_test("Admin Login", True, f"Admin logged in successfully. Token: {admin_token[:20]}...")
            test_results.append(("Admin Login", True))
        else:
            log_test("Admin Login", False, f"Status: {response.status_code}, Response: {response.text}")
            test_results.append(("Admin Login", False))
            return test_results
            
    except Exception as e:
        log_test("Admin Login", False, f"Exception: {str(e)}")
        test_results.append(("Admin Login", False))
        return test_results
    
    # Test 4: Admin sends notification to all users
    print("4️⃣ ADMIN SENDING NOTIFICATION TO ALL USERS")
    try:
        response = requests.post(f"{BASE_URL}/admin/notifications/send",
            json={
                "title": "Test Bildirimi",
                "body": "Bu bir test bildirimidir. Tüm kullanıcılara gönderildi."
            },
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            log_test("Admin Send Notification", True, f"Notification sent: {data.get('message', 'Success')}")
            test_results.append(("Admin Send Notification", True))
        else:
            log_test("Admin Send Notification", False, f"Status: {response.status_code}, Response: {response.text}")
            test_results.append(("Admin Send Notification", False))
            
    except Exception as e:
        log_test("Admin Send Notification", False, f"Exception: {str(e)}")
        test_results.append(("Admin Send Notification", False))
    
    # Test 5: Verify user received the notification
    print("5️⃣ VERIFYING USER RECEIVED NOTIFICATION")
    try:
        # Wait a moment for notification to be processed
        time.sleep(1)
        
        response = requests.get(f"{BASE_URL}/notifications",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        if response.status_code == 200:
            notifications = response.json()
            test_notification_found = False
            
            for notif in notifications:
                if notif.get("title") == "Test Bildirimi":
                    test_notification_found = True
                    break
            
            if test_notification_found:
                log_test("User Received Notification", True, f"Test notification found among {len(notifications)} notifications")
                test_results.append(("User Received Notification", True))
            else:
                log_test("User Received Notification", False, f"Test notification not found among {len(notifications)} notifications")
                test_results.append(("User Received Notification", False))
        else:
            log_test("User Received Notification", False, f"Status: {response.status_code}, Response: {response.text}")
            test_results.append(("User Received Notification", False))
            
    except Exception as e:
        log_test("User Received Notification", False, f"Exception: {str(e)}")
        test_results.append(("User Received Notification", False))
    
    # Test 6: Mark all as read
    print("6️⃣ MARKING ALL NOTIFICATIONS AS READ")
    try:
        response = requests.post(f"{BASE_URL}/notifications/read-all",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            log_test("Mark All Read", True, f"Response: {data.get('message', 'Success')}")
            test_results.append(("Mark All Read", True))
        else:
            log_test("Mark All Read", False, f"Status: {response.status_code}, Response: {response.text}")
            test_results.append(("Mark All Read", False))
            
    except Exception as e:
        log_test("Mark All Read", False, f"Exception: {str(e)}")
        test_results.append(("Mark All Read", False))
    
    # Test 7: Verify all marked read
    print("7️⃣ VERIFYING ALL NOTIFICATIONS MARKED AS READ")
    try:
        response = requests.get(f"{BASE_URL}/notifications",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        if response.status_code == 200:
            notifications = response.json()
            all_read = all(notif.get("read", False) for notif in notifications)
            
            if all_read:
                log_test("Verify All Read", True, f"All {len(notifications)} notifications marked as read")
                test_results.append(("Verify All Read", True))
            else:
                unread_count = sum(1 for notif in notifications if not notif.get("read", False))
                log_test("Verify All Read", False, f"{unread_count} notifications still unread")
                test_results.append(("Verify All Read", False))
        else:
            log_test("Verify All Read", False, f"Status: {response.status_code}, Response: {response.text}")
            test_results.append(("Verify All Read", False))
            
    except Exception as e:
        log_test("Verify All Read", False, f"Exception: {str(e)}")
        test_results.append(("Verify All Read", False))
    
    # Test 8: Test logout endpoint
    print("8️⃣ TESTING LOGOUT ENDPOINT")
    try:
        response = requests.post(f"{BASE_URL}/auth/logout",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            expected_message = "Çıkış yapıldı"
            if data.get("message") == expected_message:
                log_test("Logout", True, f"Logout successful: {data.get('message')}")
                test_results.append(("Logout", True))
            else:
                log_test("Logout", False, f"Unexpected message: {data.get('message')}")
                test_results.append(("Logout", False))
        else:
            log_test("Logout", False, f"Status: {response.status_code}, Response: {response.text}")
            test_results.append(("Logout", False))
            
    except Exception as e:
        log_test("Logout", False, f"Exception: {str(e)}")
        test_results.append(("Logout", False))
    
    # Test 9: Verify session invalidated
    print("9️⃣ VERIFYING SESSION INVALIDATED")
    try:
        response = requests.get(f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        
        if response.status_code == 401:
            log_test("Session Invalidated", True, "Session correctly invalidated (401 response)")
            test_results.append(("Session Invalidated", True))
        else:
            log_test("Session Invalidated", False, f"Session still valid - Status: {response.status_code}")
            test_results.append(("Session Invalidated", False))
            
    except Exception as e:
        log_test("Session Invalidated", False, f"Exception: {str(e)}")
        test_results.append(("Session Invalidated", False))
    
    # Test 10: Test rate limiting
    print("🔟 TESTING RATE LIMITING")
    try:
        rate_limit_triggered = False
        
        for i in range(11):
            response = requests.post(f"{BASE_URL}/auth/login",
                json={
                    "email": "wrong@test.com",
                    "password": "wrongpass"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 429:
                rate_limit_triggered = True
                break
            
            # Small delay between requests
            time.sleep(0.1)
        
        if rate_limit_triggered:
            log_test("Rate Limiting", True, "Rate limiting triggered after multiple failed attempts")
            test_results.append(("Rate Limiting", True))
        else:
            log_test("Rate Limiting", False, "Rate limiting not triggered after 11 attempts")
            test_results.append(("Rate Limiting", False))
            
    except Exception as e:
        log_test("Rate Limiting", False, f"Exception: {str(e)}")
        test_results.append(("Rate Limiting", False))
    
    # Test 11: Test input validation
    print("1️⃣1️⃣ TESTING INPUT VALIDATION")
    
    # Test empty name
    try:
        response = requests.post(f"{BASE_URL}/auth/register",
            json={
                "name": "",
                "email": "x@x.com",
                "password": "123456"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 400:
            log_test("Input Validation - Empty Name", True, "Empty name correctly rejected")
            test_results.append(("Input Validation - Empty Name", True))
        else:
            log_test("Input Validation - Empty Name", False, f"Empty name not rejected - Status: {response.status_code}")
            test_results.append(("Input Validation - Empty Name", False))
            
    except Exception as e:
        log_test("Input Validation - Empty Name", False, f"Exception: {str(e)}")
        test_results.append(("Input Validation - Empty Name", False))
    
    # Test short password
    try:
        response = requests.post(f"{BASE_URL}/auth/register",
            json={
                "name": "A",
                "email": "y@y.com",
                "password": "12"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 400:
            log_test("Input Validation - Short Password", True, "Short password correctly rejected")
            test_results.append(("Input Validation - Short Password", True))
        else:
            log_test("Input Validation - Short Password", False, f"Short password not rejected - Status: {response.status_code}")
            test_results.append(("Input Validation - Short Password", False))
            
    except Exception as e:
        log_test("Input Validation - Short Password", False, f"Exception: {str(e)}")
        test_results.append(("Input Validation - Short Password", False))
    
    # Test invalid email
    try:
        response = requests.post(f"{BASE_URL}/auth/register",
            json={
                "name": "A",
                "email": "notanemail",
                "password": "123456"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 400:
            log_test("Input Validation - Invalid Email", True, "Invalid email correctly rejected")
            test_results.append(("Input Validation - Invalid Email", True))
        else:
            log_test("Input Validation - Invalid Email", False, f"Invalid email not rejected - Status: {response.status_code}")
            test_results.append(("Input Validation - Invalid Email", False))
            
    except Exception as e:
        log_test("Input Validation - Invalid Email", False, f"Exception: {str(e)}")
        test_results.append(("Input Validation - Invalid Email", False))
    
    return test_results

def main():
    """Run all tests and provide summary"""
    print("🚀 STARTING COMPREHENSIVE BACKEND TESTING")
    print("Backend URL:", BASE_URL)
    print()
    
    test_results = test_push_notification_and_security_flow()
    
    # Summary
    print("=" * 70)
    print("📊 TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for _, success in test_results if success)
    total = len(test_results)
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    print()
    
    if total - passed > 0:
        print("❌ FAILED TESTS:")
        for test_name, success in test_results:
            if not success:
                print(f"   • {test_name}")
        print()
    
    print("✅ PASSED TESTS:")
    for test_name, success in test_results:
        if success:
            print(f"   • {test_name}")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)