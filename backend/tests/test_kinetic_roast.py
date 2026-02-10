"""
Kinetic Roast API Test Suite
Tests menu, stores, rewards, auth, orders, and notifications endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

class TestPublicEndpoints:
    """Test public endpoints that don't require authentication"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root working: {data['message']}")
    
    def test_get_menu_returns_12_items(self):
        """Test GET /api/menu returns 12 menu items"""
        response = requests.get(f"{BASE_URL}/api/menu")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 12, f"Expected 12 menu items, got {len(data)}"
        
        # Verify item structure
        item = data[0]
        assert "item_id" in item
        assert "name" in item
        assert "price" in item
        assert "category" in item
        assert "image_url" in item
        assert "description" in item
        print(f"✓ Menu endpoint returns 12 items with correct structure")
    
    def test_get_specific_menu_item(self):
        """Test GET /api/menu/esp_001 returns specific item"""
        response = requests.get(f"{BASE_URL}/api/menu/esp_001")
        assert response.status_code == 200
        item = response.json()
        assert item["item_id"] == "esp_001"
        assert item["name"] == "Classic Espresso"
        assert item["price"] == 3.50
        assert item["category"] == "Espresso"
        print(f"✓ Specific menu item (esp_001) retrieved successfully: {item['name']}")
    
    def test_get_menu_item_not_found(self):
        """Test GET /api/menu with invalid ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/menu/invalid_item")
        assert response.status_code == 404
        print("✓ Invalid menu item returns 404 as expected")
    
    def test_get_stores_returns_4_stores(self):
        """Test GET /api/stores returns 4 store locations"""
        response = requests.get(f"{BASE_URL}/api/stores")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 4, f"Expected 4 stores, got {len(data)}"
        
        # Verify store structure
        store = data[0]
        assert "store_id" in store
        assert "name" in store
        assert "address" in store
        assert "city" in store
        assert "hours" in store
        assert "phone" in store
        assert "lat" in store
        assert "lng" in store
        assert "image_url" in store
        print(f"✓ Stores endpoint returns 4 stores with correct structure")
    
    def test_get_rewards_returns_5_rewards(self):
        """Test GET /api/rewards returns 5 rewards"""
        response = requests.get(f"{BASE_URL}/api/rewards")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 5, f"Expected 5 rewards, got {len(data)}"
        
        # Verify reward structure
        reward = data[0]
        assert "reward_id" in reward
        assert "name" in reward
        assert "description" in reward
        assert "points_required" in reward
        assert "category" in reward
        print(f"✓ Rewards endpoint returns 5 rewards with correct structure")


class TestAuthenticatedEndpoints:
    """Test endpoints that require authentication"""
    
    @pytest.fixture
    def auth_headers(self):
        """Create test user and session for authenticated tests"""
        import subprocess
        import json
        
        # Create test user and session via mongosh
        result = subprocess.run([
            'mongosh', '--quiet', '--eval',
            """
            use('test_database');
            var userId = 'test_user_' + Date.now();
            var sessionToken = 'test_session_' + Date.now();
            db.users.insertOne({
                user_id: userId,
                email: 'test.kinetic.' + Date.now() + '@example.com',
                name: 'Test Kinetic User',
                picture: 'https://via.placeholder.com/150',
                points: 250,
                tier: 'Silver',
                created_at: new Date()
            });
            db.user_sessions.insertOne({
                user_id: userId,
                session_token: sessionToken,
                expires_at: new Date(Date.now() + 7*24*60*60*1000),
                created_at: new Date()
            });
            print(JSON.stringify({session_token: sessionToken, user_id: userId}));
            """
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            pytest.skip("Failed to create test user")
        
        data = json.loads(result.stdout.strip())
        session_token = data['session_token']
        print(f"\n✓ Created test user with session: {session_token[:20]}...")
        
        return {
            'Authorization': f'Bearer {session_token}',
            'Content-Type': 'application/json'
        }
    
    def test_auth_me_with_valid_token(self, auth_headers):
        """Test GET /api/auth/me with valid token returns user data"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        user = response.json()
        assert "user_id" in user
        assert "email" in user
        assert "name" in user
        assert "points" in user
        assert "tier" in user
        assert user["points"] == 250
        assert user["tier"] == "Silver"
        print(f"✓ Auth /me endpoint working: {user['name']} ({user['email']})")
    
    def test_auth_me_without_token(self):
        """Test GET /api/auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Auth /me without token returns 401 as expected")
    
    def test_create_order(self, auth_headers):
        """Test POST /api/orders creates an order"""
        order_data = {
            "items": [
                {
                    "item_id": "esp_001",
                    "name": "Classic Espresso",
                    "size": "Double",
                    "quantity": 2,
                    "price": 3.50
                }
            ],
            "store_id": "store_001",
            "store_name": "Kinetic Roast — Downtown",
            "total": 7.00
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders",
            headers=auth_headers,
            json=order_data
        )
        assert response.status_code == 200
        order = response.json()
        assert "order_id" in order
        assert "user_id" in order
        assert order["total"] == 7.00
        assert order["status"] == "confirmed"
        assert "points_earned" in order
        assert order["points_earned"] == 70  # 10 points per dollar
        print(f"✓ Order created successfully: {order['order_id']}, earned {order['points_earned']} points")
        
        # Verify order was persisted
        get_response = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers)
        assert get_response.status_code == 200
        orders = get_response.json()
        assert len(orders) > 0
        assert orders[0]["order_id"] == order["order_id"]
        print(f"✓ Order persistence verified via GET /api/orders")
    
    def test_get_orders_list(self, auth_headers):
        """Test GET /api/orders returns user's orders"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=auth_headers)
        assert response.status_code == 200
        orders = response.json()
        assert isinstance(orders, list)
        print(f"✓ Orders endpoint returns list: {len(orders)} orders found")
    
    def test_get_notifications(self, auth_headers):
        """Test GET /api/notifications returns user notifications"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert response.status_code == 200
        notifs = response.json()
        assert isinstance(notifs, list)
        print(f"✓ Notifications endpoint returns list: {len(notifs)} notifications")
    
    def test_redeem_reward_insufficient_points(self, auth_headers):
        """Test POST /api/rewards/redeem with insufficient points"""
        # User has 250 points (from fixture), try to redeem 500 point reward
        response = requests.post(
            f"{BASE_URL}/api/rewards/redeem",
            headers=auth_headers,
            json={"reward_id": "rwd_005"}  # $10 Off Order - 500 points
        )
        assert response.status_code == 400
        error = response.json()
        assert "detail" in error
        print(f"✓ Reward redemption correctly fails with insufficient points: {error['detail']}")
    
    def test_redeem_reward_success(self, auth_headers):
        """Test POST /api/rewards/redeem with sufficient points"""
        # User has 250 points, redeem 50 point reward
        response = requests.post(
            f"{BASE_URL}/api/rewards/redeem",
            headers=auth_headers,
            json={"reward_id": "rwd_001"}  # Free Espresso Shot - 50 points
        )
        assert response.status_code == 200
        result = response.json()
        assert "message" in result
        assert "new_points" in result
        assert result["new_points"] == 200  # 250 - 50
        print(f"✓ Reward redeemed successfully: {result['message']}, new balance: {result['new_points']} pts")


class TestAuthSession:
    """Test auth session exchange (requires mock session_id from Emergent Auth)"""
    
    def test_auth_session_without_session_id(self):
        """Test POST /api/auth/session without session_id returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            headers={'Content-Type': 'application/json'},
            json={}
        )
        assert response.status_code == 400
        error = response.json()
        assert "session_id" in error["detail"].lower()
        print(f"✓ Auth session without session_id returns 400: {error['detail']}")
