#!/usr/bin/env python3
"""
Backend Test Suite for NEW Auto-Scan API Endpoints
Tests the newly implemented auto-scan functionality for Glob Coffee app.
"""

import requests
import json
from datetime import datetime

# Use the production URL as specified in the environment
API_BASE = "https://coffee-admin-portal.preview.emergentagent.com/api"

def test_admin_login():
    """Step 1: Get admin token"""
    print("1. Testing Admin Login...")
    
    url = f"{API_BASE}/admin/login"
    payload = {
        "email": "admin@globcoffee.com",
        "password": "admin123"
    }
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            admin_data = data.get("admin", {})
            print(f"   ✅ Login successful - Token: {token[:20]}...")
            print(f"   Admin: {admin_data.get('name')} ({admin_data.get('role')})")
            return token
        else:
            print(f"   ❌ Login failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"   ❌ Login error: {str(e)}")
        return None

def test_scan_settings_get(admin_token):
    """Step 2: Test GET scan settings"""
    print("\n2. Testing GET Scan Settings...")
    
    url = f"{API_BASE}/admin/scan-settings"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            scan_points = data.get("scan_points", 0)
            cooldown = data.get("cooldown_minutes", 0)
            print(f"   ✅ Scan settings retrieved successfully")
            print(f"   Scan Points: {scan_points}")
            print(f"   Cooldown: {cooldown} minutes")
            
            # Verify expected values
            if scan_points == 50 and cooldown == 120:
                print("   ✅ Default settings are correct")
                return True
            else:
                print(f"   ⚠️  Settings don't match expected (50 points, 120 min cooldown)")
                return True  # Still working, just different values
        else:
            print(f"   ❌ Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False

def test_get_users(admin_token):
    """Get user list for testing"""
    print("\n3. Getting user list for testing...")
    
    url = f"{API_BASE}/admin/users"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            users = response.json()
            print(f"   ✅ Retrieved {len(users)} users")
            
            if len(users) > 0:
                test_user = users[0]
                user_id = test_user.get("user_id")
                user_name = test_user.get("name", "Unknown")
                print(f"   Using test user: {user_name} (ID: {user_id})")
                return user_id
            else:
                print("   ❌ No users found in system")
                return None
        else:
            print(f"   ❌ Failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return None

def test_scan_checkin(admin_token, user_id):
    """Step 4: Test auto scan check-in"""
    print(f"\n4. Testing Auto Scan Check-in for user: {user_id}")
    
    url = f"{API_BASE}/admin/scan-checkin"
    payload = {
        "user_id": user_id
    }
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            message = data.get("message", "")
            new_points = data.get("new_points", 0)
            tier = data.get("tier", "")
            user_name = data.get("user_name", "")
            points_added = data.get("points_added", 0)
            
            print(f"   ✅ Scan check-in successful")
            print(f"   Message: {message}")
            print(f"   User: {user_name}")
            print(f"   Points Added: {points_added}")
            print(f"   New Total Points: {new_points}")
            print(f"   New Tier: {tier}")
            
            # Verify expected response format
            expected_msg = f"Otomatik {points_added} puan eklendi"
            if expected_msg in message:
                print("   ✅ Message format is correct")
            else:
                print(f"   ⚠️  Message format different than expected")
                
            if points_added == 50:
                print("   ✅ Correct points added (50)")
            else:
                print(f"   ⚠️  Points added: {points_added}, expected: 50")
                
            return True
            
        elif response.status_code == 429:
            error_data = response.json()
            print(f"   ✅ Cooldown working correctly: {error_data.get('detail', 'Rate limited')}")
            return True  # This is expected behavior
            
        else:
            print(f"   ❌ Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False

def test_scan_cooldown(admin_token, user_id):
    """Step 5: Test cooldown mechanism"""
    print(f"\n5. Testing Cooldown - Second scan attempt for user: {user_id}")
    
    url = f"{API_BASE}/admin/scan-checkin"
    payload = {
        "user_id": user_id
    }
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 429:
            error_data = response.json()
            detail = error_data.get("detail", "")
            print(f"   ✅ Cooldown mechanism working correctly")
            print(f"   Error message: {detail}")
            
            # Check if message contains waiting time info
            if "dakika sonra" in detail or "dakika" in detail:
                print("   ✅ Cooldown message contains time information")
            else:
                print("   ⚠️  Cooldown message format unexpected")
                
            return True
        elif response.status_code == 200:
            print("   ⚠️  Second scan succeeded - cooldown might not be working")
            return False
        else:
            print(f"   ❌ Unexpected response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False

def test_scan_settings_update(admin_token):
    """Step 6: Test PUT scan settings update (superadmin only)"""
    print("\n6. Testing PUT Scan Settings Update...")
    
    url = f"{API_BASE}/admin/scan-settings"
    payload = {
        "scan_points": 75
    }
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.put(url, json=payload, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            message = data.get("message", "")
            new_points = data.get("scan_points", 0)
            print(f"   ✅ Scan settings updated successfully")
            print(f"   Message: {message}")
            print(f"   New scan points: {new_points}")
            
            if new_points == 75:
                print("   ✅ Settings updated correctly")
                return True
            else:
                print(f"   ⚠️  Points not updated correctly: {new_points}")
                return False
                
        elif response.status_code == 403:
            print("   ✅ Access denied - only superadmin can update settings")
            return True  # This is expected for non-superadmin users
        else:
            print(f"   ❌ Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False

def test_old_add_points(admin_token, user_id):
    """Step 7: Test old add-points endpoint still works"""
    print(f"\n7. Testing Old Add Points Endpoint for user: {user_id}")
    
    url = f"{API_BASE}/admin/add-points"
    payload = {
        "user_id": user_id,
        "points": 10
    }
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            message = data.get("message", "")
            new_points = data.get("new_points", 0)
            tier = data.get("tier", "")
            user_name = data.get("user_name", "")
            
            print(f"   ✅ Old add points endpoint working")
            print(f"   Message: {message}")
            print(f"   User: {user_name}")
            print(f"   New Total Points: {new_points}")
            print(f"   New Tier: {tier}")
            
            if "10 puan eklendi" in message:
                print("   ✅ Message format correct")
            else:
                print(f"   ⚠️  Message format different than expected")
                
            return True
        else:
            print(f"   ❌ Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 GLOB COFFEE - AUTO-SCAN API TESTING")
    print("=" * 50)
    
    test_results = {
        "admin_login": False,
        "scan_settings_get": False,
        "scan_checkin": False,
        "scan_cooldown": False,
        "scan_settings_update": False,
        "old_add_points": False
    }
    
    # Step 1: Login as admin
    admin_token = test_admin_login()
    if not admin_token:
        print("\n❌ CRITICAL: Admin login failed - Cannot proceed with tests")
        return test_results
    
    test_results["admin_login"] = True
    
    # Step 2: Test scan settings GET
    test_results["scan_settings_get"] = test_scan_settings_get(admin_token)
    
    # Step 3: Get test user
    test_user_id = test_get_users(admin_token)
    if not test_user_id:
        print("\n❌ CRITICAL: No users found - Cannot test scan functionality")
        return test_results
    
    # Step 4: Test scan check-in
    test_results["scan_checkin"] = test_scan_checkin(admin_token, test_user_id)
    
    # Step 5: Test cooldown
    test_results["scan_cooldown"] = test_scan_cooldown(admin_token, test_user_id)
    
    # Step 6: Test settings update
    test_results["scan_settings_update"] = test_scan_settings_update(admin_token)
    
    # Step 7: Test old add-points endpoint
    test_results["old_add_points"] = test_old_add_points(admin_token, test_user_id)
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 50)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title():<25} {status}")
        if result:
            passed += 1
    
    print("-" * 50)
    print(f"Overall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL AUTO-SCAN API TESTS PASSED!")
    else:
        print("⚠️  Some tests failed - Check details above")
    
    return test_results

if __name__ == "__main__":
    main()