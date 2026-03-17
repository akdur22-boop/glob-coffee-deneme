#!/usr/bin/env python3
"""
Backend Authentication Testing for Glob Coffee App
Tests user authentication endpoints: register, login, profile, logout
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://coffee-admin-portal.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def log_test(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    return success

def test_user_register():
    """Test user registration endpoint"""
    print("\n=== Testing User Registration ===")
    
    # Test 1: Successful registration
    test_user = {
        "name": "Test Kullanıcı",
        "email": "test@example.com", 
        "password": "test123456"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/register", 
                               json=test_user, headers=HEADERS, timeout=10)
        
        if response.status_code == 201 or response.status_code == 200:
            data = response.json()
            success = (
                "user" in data and 
                "session_token" in data and
                data["user"]["email"] == test_user["email"] and
                data["user"]["name"] == test_user["name"] and
                data["user"]["points"] == 100 and
                data["user"]["tier"] == "Bronz" and
                "password_hash" not in data["user"]  # Should not return password
            )
            
            if success:
                # Store session token for later tests
                global session_token
                session_token = data["session_token"]
                log_test("Register new user", True, 
                        f"User created with 100 points, Bronz tier, session_token returned")
                return data
            else:
                log_test("Register new user", False, f"Invalid response structure: {data}")
                return None
                
        else:
            log_test("Register new user", False, 
                    f"HTTP {response.status_code}: {response.text}")
            return None
            
    except Exception as e:
        log_test("Register new user", False, f"Exception: {str(e)}")
        return None

def test_user_login(email="test@example.com", password="test123456"):
    """Test user login endpoint"""
    print("\n=== Testing User Login ===")
    
    login_data = {"email": email, "password": password}
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login",
                               json=login_data, headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            success = (
                "user" in data and
                "session_token" in data and
                data["user"]["email"] == email and
                "password_hash" not in data["user"]  # Should not return password
            )
            
            if success:
                global session_token
                session_token = data["session_token"]
                log_test("Login with correct credentials", True,
                        f"Login successful, session_token returned")
                return data
            else:
                log_test("Login with correct credentials", False,
                        f"Invalid response structure: {data}")
                return None
                
        else:
            log_test("Login with correct credentials", False,
                    f"HTTP {response.status_code}: {response.text}")
            return None
            
    except Exception as e:
        log_test("Login with correct credentials", False, f"Exception: {str(e)}")
        return None

def test_get_user_profile():
    """Test getting user profile with session token"""
    print("\n=== Testing User Profile ===")
    
    if not session_token:
        log_test("Get user profile", False, "No session token available")
        return None
        
    auth_headers = {
        "Authorization": f"Bearer {session_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(f"{BACKEND_URL}/auth/me",
                              headers=auth_headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            success = (
                "email" in data and
                "name" in data and
                "points" in data and
                "tier" in data and
                "password_hash" not in data  # Should not return password
            )
            
            if success:
                log_test("Get user profile with token", True,
                        f"Profile retrieved: {data['name']} ({data['email']}) - {data['points']} points, {data['tier']} tier")
                return data
            else:
                log_test("Get user profile with token", False,
                        f"Invalid response structure: {data}")
                return None
                
        else:
            log_test("Get user profile with token", False,
                    f"HTTP {response.status_code}: {response.text}")
            return None
            
    except Exception as e:
        log_test("Get user profile with token", False, f"Exception: {str(e)}")
        return None

def test_duplicate_registration():
    """Test duplicate email registration"""
    print("\n=== Testing Duplicate Registration ===")
    
    duplicate_user = {
        "name": "Test Kullanıcı 2",
        "email": "test@example.com",  # Same email as first user
        "password": "test999999"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/register",
                               json=duplicate_user, headers=HEADERS, timeout=10)
        
        if response.status_code == 409:
            data = response.json()
            expected_message = "Bu email adresi zaten kayıtlı"
            if expected_message in str(data):
                log_test("Duplicate email registration", True,
                        f"Correctly rejected with 409: {data}")
                return True
            else:
                log_test("Duplicate email registration", False,
                        f"Wrong error message: {data}")
                return False
        else:
            log_test("Duplicate email registration", False,
                    f"Expected 409, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Duplicate email registration", False, f"Exception: {str(e)}")
        return False

def test_wrong_password():
    """Test login with wrong password"""
    print("\n=== Testing Wrong Password ===")
    
    wrong_login = {
        "email": "test@example.com",
        "password": "wrongpassword"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login",
                               json=wrong_login, headers=HEADERS, timeout=10)
        
        if response.status_code == 401:
            data = response.json()
            expected_message = "Email veya şifre hatalı"
            if expected_message in str(data):
                log_test("Login with wrong password", True,
                        f"Correctly rejected with 401: {data}")
                return True
            else:
                log_test("Login with wrong password", False,
                        f"Wrong error message: {data}")
                return False
        else:
            log_test("Login with wrong password", False,
                    f"Expected 401, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Login with wrong password", False, f"Exception: {str(e)}")
        return False

def test_short_password():
    """Test registration with short password"""
    print("\n=== Testing Short Password Registration ===")
    
    short_password_user = {
        "name": "Short",
        "email": "short@example.com",
        "password": "123"  # Too short
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/register",
                               json=short_password_user, headers=HEADERS, timeout=10)
        
        if response.status_code == 400:
            data = response.json()
            expected_message = "Şifre en az 6 karakter olmalı"
            if expected_message in str(data):
                log_test("Short password registration", True,
                        f"Correctly rejected with 400: {data}")
                return True
            else:
                log_test("Short password registration", False,
                        f"Wrong error message: {data}")
                return False
        else:
            log_test("Short password registration", False,
                    f"Expected 400, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Short password registration", False, f"Exception: {str(e)}")
        return False

def test_invalid_token():
    """Test profile access with invalid token"""
    print("\n=== Testing Invalid Token ===")
    
    auth_headers = {
        "Authorization": "Bearer invalid_token_here",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(f"{BACKEND_URL}/auth/me",
                              headers=auth_headers, timeout=10)
        
        if response.status_code == 401:
            log_test("Profile access with invalid token", True,
                    f"Correctly rejected with 401: {response.text}")
            return True
        else:
            log_test("Profile access with invalid token", False,
                    f"Expected 401, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Profile access with invalid token", False, f"Exception: {str(e)}")
        return False

def cleanup_test_user():
    """Clean up test user from database"""
    print("\n=== Cleanup ===")
    # Note: In a real scenario, we might want to clean up test data
    # For now, just log that testing is complete
    print("Authentication testing completed. Test user remains in database.")

def main():
    """Main test execution"""
    global session_token
    session_token = None
    
    print("=" * 60)
    print("GLOB COFFEE - USER AUTHENTICATION TESTING")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Time: {datetime.now()}")
    print("=" * 60)
    
    # Track test results
    tests_passed = 0
    total_tests = 0
    
    # Test sequence
    test_functions = [
        test_user_register,
        test_user_login,
        test_get_user_profile,
        test_duplicate_registration,
        test_wrong_password,
        test_short_password,
        test_invalid_token
    ]
    
    for test_func in test_functions:
        try:
            result = test_func()
            total_tests += 1
            if result:
                tests_passed += 1
            time.sleep(0.5)  # Small delay between tests
        except Exception as e:
            print(f"❌ FAIL {test_func.__name__}: Unexpected error: {str(e)}")
            total_tests += 1
    
    # Cleanup
    cleanup_test_user()
    
    # Final results
    print("\n" + "=" * 60)
    print("AUTHENTICATION TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {tests_passed}")
    print(f"Failed: {total_tests - tests_passed}")
    print(f"Success Rate: {(tests_passed/total_tests)*100:.1f}%")
    
    if tests_passed == total_tests:
        print("🎉 ALL AUTHENTICATION TESTS PASSED!")
        return 0
    else:
        print(f"⚠️ {total_tests - tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())