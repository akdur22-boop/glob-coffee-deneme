#!/usr/bin/env python3
"""
Specific test for rate limiting functionality
"""

import requests
import time

BASE_URL = "https://coffee-admin-portal.preview.emergentagent.com/api"

def test_rate_limiting_detailed():
    """Test rate limiting with detailed logging"""
    
    print("🔍 DETAILED RATE LIMITING TEST")
    print("=" * 50)
    
    # Test with a non-existent user to ensure we get 401s
    test_email = "nonexistent@test.com"
    test_password = "wrongpassword"
    
    print(f"Testing with email: {test_email}")
    print(f"Max attempts allowed: 10")
    print(f"Window: 5 minutes (300 seconds)")
    print()
    
    for i in range(12):  # Try 12 attempts to be sure
        print(f"Attempt {i+1}:")
        
        try:
            response = requests.post(f"{BASE_URL}/auth/login",
                json={
                    "email": test_email,
                    "password": test_password
                },
                headers={"Content-Type": "application/json"}
            )
            
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.text}")
            
            if response.status_code == 429:
                print("  ✅ Rate limiting triggered!")
                return True
            elif response.status_code == 401:
                print("  ⚠️  Normal auth failure (expected)")
            else:
                print(f"  ❓ Unexpected status: {response.status_code}")
            
        except Exception as e:
            print(f"  ❌ Exception: {str(e)}")
        
        print()
        time.sleep(0.2)  # Small delay between requests
    
    print("❌ Rate limiting was NOT triggered after 12 attempts")
    return False

if __name__ == "__main__":
    test_rate_limiting_detailed()