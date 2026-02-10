"""
Turkish Coffee App Admin Panel Testing
Tests: Admin login, stats, menu/campaigns/stores/managers/orders/rewards/users CRUD, notifications, QR points
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = "admin@kineticr.com"
ADMIN_PASSWORD = "admin123"


class TestTurkishData:
    """Verify Turkish translations in public endpoints"""
    
    def test_menu_has_turkish_items(self):
        """Test menu items have Turkish names"""
        response = requests.get(f"{BASE_URL}/api/menu")
        assert response.status_code == 200
        items = response.json()
        assert len(items) >= 11, f"Expected at least 11 menu items, got {len(items)}"
        
        # Check for Turkish menu item names
        item_names = [item["name"] for item in items]
        turkish_items = ["Klasik Espresso", "Americano", "Macchiato", "Karamel Latte", 
                        "Vanilya Yulaf Latte", "Matcha Latte", "Soğuk Demleme", 
                        "Buzlu Mocha", "Tereyağlı Kruvasan", "Yabanmersinli Muffin", 
                        "Avokado Toast"]
        
        found_count = sum(1 for t_item in turkish_items if t_item in item_names)
        print(f"✓ Found {found_count}/{len(turkish_items)} Turkish menu items")
        assert found_count >= 8, f"Expected at least 8 Turkish menu items, found {found_count}"
    
    def test_stores_have_istanbul_locations(self):
        """Test stores have Istanbul Turkish locations"""
        response = requests.get(f"{BASE_URL}/api/stores")
        assert response.status_code == 200
        stores = response.json()
        assert len(stores) >= 4
        
        # Check for Turkish store names/locations
        store_data = [(s["name"], s["city"]) for s in stores]
        istanbul_count = sum(1 for name, city in store_data if "İstanbul" in city or "İstanbul" in name)
        print(f"✓ Found {istanbul_count} Istanbul locations")
        assert istanbul_count >= 4, "Expected at least 4 Istanbul stores"
    
    def test_rewards_have_turkish_names(self):
        """Test rewards have Turkish translations"""
        response = requests.get(f"{BASE_URL}/api/rewards")
        assert response.status_code == 200
        rewards = response.json()
        assert len(rewards) >= 5
        
        # Check for Turkish reward names
        reward_names = [r["name"] for r in rewards]
        turkish_rewards = ["Ücretsiz Espresso Shot", "Ücretsiz Atıştırmalık", 
                          "Ücretsiz Orta Boy İçecek", "Ücretsiz Büyük Boy İçecek"]
        
        found_count = sum(1 for t_reward in turkish_rewards if t_reward in reward_names)
        print(f"✓ Found {found_count}/{len(turkish_rewards)} Turkish reward names")
        assert found_count >= 3, f"Expected at least 3 Turkish rewards, found {found_count}"


class TestAdminAuth:
    """Test admin authentication endpoints"""
    
    def test_admin_login_success(self):
        """Test POST /api/admin/login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "admin" in data
        assert data["admin"]["email"] == ADMIN_EMAIL
        assert data["admin"]["role"] == "superadmin"
        print(f"✓ Admin login successful: {data['admin']['name']} ({data['admin']['role']})")
        return data["token"]
    
    def test_admin_login_wrong_password(self):
        """Test POST /api/admin/login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "password": "wrongpassword"}
        )
        assert response.status_code == 401
        error = response.json()
        assert "detail" in error
        assert "Geçersiz giriş bilgileri" in error["detail"]
        print(f"✓ Admin login fails with wrong password: {error['detail']}")
    
    def test_admin_login_missing_fields(self):
        """Test POST /api/admin/login without email/password"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={}
        )
        assert response.status_code == 400
        error = response.json()
        assert "Email ve şifre gerekli" in error["detail"]
        print(f"✓ Admin login requires email and password: {error['detail']}")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated tests"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["token"]
    
    def test_admin_me(self, admin_token):
        """Test GET /api/admin/me with valid token"""
        response = requests.get(
            f"{BASE_URL}/api/admin/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        admin = response.json()
        assert admin["email"] == ADMIN_EMAIL
        assert admin["role"] == "superadmin"
        print(f"✓ Admin /me endpoint: {admin['name']} ({admin['role']})")


class TestAdminStats:
    """Test admin statistics endpoint"""
    
    @pytest.fixture
    def admin_headers(self):
        """Get admin headers for authenticated tests"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_admin_stats(self, admin_headers):
        """Test GET /api/admin/stats returns all stats"""
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers)
        assert response.status_code == 200
        stats = response.json()
        
        # Verify all expected stats fields exist
        expected_fields = ["total_users", "total_orders", "total_menu_items", 
                          "total_stores", "total_campaigns", "total_managers", "total_revenue"]
        for field in expected_fields:
            assert field in stats, f"Missing field: {field}"
            assert isinstance(stats[field], (int, float)), f"{field} should be numeric"
        
        print(f"✓ Admin stats: {stats['total_users']} users, {stats['total_orders']} orders, "
              f"{stats['total_menu_items']} menu items, {stats['total_stores']} stores, "
              f"₺{stats['total_revenue']} revenue")


class TestAdminMenu:
    """Test admin menu CRUD operations"""
    
    @pytest.fixture
    def admin_headers(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", 
                                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}", "Content-Type": "application/json"}
    
    def test_create_menu_item(self, admin_headers):
        """Test POST /api/admin/menu creates new menu item"""
        new_item = {
            "name": "TEST_Filtre Kahve",
            "description": "El ile demlenen filtre kahve",
            "price": 65.00,
            "category": "Test Kategori",
            "sizes": ["Küçük", "Orta"],
            "image_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400"
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/menu", 
                                headers=admin_headers, json=new_item)
        assert response.status_code == 200
        item = response.json()
        assert "item_id" in item
        assert item["name"] == new_item["name"]
        assert item["price"] == new_item["price"]
        print(f"✓ Menu item created: {item['name']} (ID: {item['item_id']})")
        
        # Verify persistence via GET
        get_response = requests.get(f"{BASE_URL}/api/menu")
        items = get_response.json()
        assert any(i["item_id"] == item["item_id"] for i in items)
        print(f"✓ Menu item persistence verified")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/menu/{item['item_id']}", headers=admin_headers)
    
    def test_delete_menu_item(self, admin_headers):
        """Test DELETE /api/admin/menu/{item_id}"""
        # Create test item first
        new_item = {"name": "TEST_Delete Item", "description": "To be deleted", 
                   "price": 50.00, "category": "Test"}
        create_response = requests.post(f"{BASE_URL}/api/admin/menu", 
                                       headers=admin_headers, json=new_item)
        item_id = create_response.json()["item_id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/admin/menu/{item_id}", headers=admin_headers)
        assert response.status_code == 200
        assert "silindi" in response.json()["message"]
        print(f"✓ Menu item deleted: {item_id}")
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/menu/{item_id}")
        assert get_response.status_code == 404
        print(f"✓ Menu item deletion verified (404)")


class TestAdminCampaigns:
    """Test admin campaign CRUD operations"""
    
    @pytest.fixture
    def admin_headers(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", 
                                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}", "Content-Type": "application/json"}
    
    def test_list_campaigns(self, admin_headers):
        """Test GET /api/admin/campaigns"""
        response = requests.get(f"{BASE_URL}/api/admin/campaigns", headers=admin_headers)
        assert response.status_code == 200
        campaigns = response.json()
        assert isinstance(campaigns, list)
        print(f"✓ Campaign list retrieved: {len(campaigns)} campaigns")
    
    def test_create_campaign(self, admin_headers):
        """Test POST /api/admin/campaigns"""
        new_campaign = {
            "title": "TEST_Yaz İndirimi",
            "description": "Tüm soğuk içeceklerde %20 indirim",
            "discount_type": "percent",
            "discount_value": 20,
            "active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/campaigns", 
                                headers=admin_headers, json=new_campaign)
        assert response.status_code == 200
        campaign = response.json()
        assert "campaign_id" in campaign
        assert campaign["title"] == new_campaign["title"]
        assert campaign["discount_value"] == 20
        print(f"✓ Campaign created: {campaign['title']} (ID: {campaign['campaign_id']})")
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/admin/campaigns", headers=admin_headers)
        campaigns = get_response.json()
        assert any(c["campaign_id"] == campaign["campaign_id"] for c in campaigns)
        print(f"✓ Campaign persistence verified")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/campaigns/{campaign['campaign_id']}", headers=admin_headers)


class TestAdminNotifications:
    """Test admin notification sending"""
    
    @pytest.fixture
    def admin_headers(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", 
                                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}", "Content-Type": "application/json"}
    
    def test_send_notification_to_all(self, admin_headers):
        """Test POST /api/admin/notifications/send"""
        notif_data = {
            "title": "TEST_Bildirim",
            "body": "Bu bir test bildirimidir"
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/notifications/send", 
                                headers=admin_headers, json=notif_data)
        assert response.status_code == 200
        result = response.json()
        assert "message" in result
        assert "kullanıcıya bildirim gönderildi" in result["message"]
        print(f"✓ Notification sent: {result['message']}")
    
    def test_send_notification_missing_fields(self, admin_headers):
        """Test POST /api/admin/notifications/send without title/body"""
        response = requests.post(f"{BASE_URL}/api/admin/notifications/send", 
                                headers=admin_headers, json={})
        assert response.status_code == 400
        error = response.json()
        assert "Başlık ve mesaj gerekli" in error["detail"]
        print(f"✓ Notification requires title and body: {error['detail']}")


class TestAdminAddPoints:
    """Test admin QR/add points functionality"""
    
    @pytest.fixture
    def admin_headers(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", 
                                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}", "Content-Type": "application/json"}
    
    @pytest.fixture
    def test_user_id(self):
        """Create a test user for points testing"""
        import subprocess
        import json
        result = subprocess.run([
            'mongosh', '--quiet', '--eval',
            """
            use('test_database');
            var userId = 'test_points_user_' + Date.now();
            db.users.insertOne({
                user_id: userId,
                email: 'testpoints.' + Date.now() + '@example.com',
                name: 'Test Points User',
                points: 50,
                tier: 'Bronz',
                created_at: new Date()
            });
            print(JSON.stringify({user_id: userId}));
            """
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            pytest.skip("Failed to create test user")
        return json.loads(result.stdout.strip())['user_id']
    
    def test_add_points_success(self, admin_headers, test_user_id):
        """Test POST /api/admin/add-points"""
        response = requests.post(f"{BASE_URL}/api/admin/add-points",
                                headers=admin_headers,
                                json={"user_id": test_user_id, "points": 100})
        assert response.status_code == 200
        result = response.json()
        assert "new_points" in result
        assert result["new_points"] == 150  # 50 + 100
        assert "tier" in result
        print(f"✓ Points added: {result['user_name']} now has {result['new_points']} points ({result['tier']})")
    
    def test_add_points_user_not_found(self, admin_headers):
        """Test POST /api/admin/add-points with invalid user_id"""
        response = requests.post(f"{BASE_URL}/api/admin/add-points",
                                headers=admin_headers,
                                json={"user_id": "invalid_user", "points": 100})
        assert response.status_code == 404
        error = response.json()
        assert "Kullanıcı bulunamadı" in error["detail"]
        print(f"✓ Add points fails for invalid user: {error['detail']}")


class TestAdminStores:
    """Test admin store CRUD operations"""
    
    @pytest.fixture
    def admin_headers(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", 
                                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}", "Content-Type": "application/json"}
    
    def test_create_store(self, admin_headers):
        """Test POST /api/admin/stores (superadmin only)"""
        new_store = {
            "name": "TEST_Kinetic Roast — Ataşehir",
            "address": "Ataşehir Bulvarı No:42",
            "city": "İstanbul",
            "hours": "08:00 - 22:00",
            "phone": "(216) 555-9999",
            "lat": 40.9823,
            "lng": 29.1244
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/stores", 
                                headers=admin_headers, json=new_store)
        assert response.status_code == 200
        store = response.json()
        assert "store_id" in store
        assert store["name"] == new_store["name"]
        print(f"✓ Store created: {store['name']} (ID: {store['store_id']})")
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/stores")
        stores = get_response.json()
        assert any(s["store_id"] == store["store_id"] for s in stores)
        print(f"✓ Store persistence verified")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/stores/{store['store_id']}", headers=admin_headers)


class TestAdminManagers:
    """Test admin branch manager CRUD operations"""
    
    @pytest.fixture
    def admin_headers(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", 
                                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}", "Content-Type": "application/json"}
    
    def test_list_managers(self, admin_headers):
        """Test GET /api/admin/managers"""
        response = requests.get(f"{BASE_URL}/api/admin/managers", headers=admin_headers)
        assert response.status_code == 200
        managers = response.json()
        assert isinstance(managers, list)
        print(f"✓ Manager list retrieved: {len(managers)} managers")
    
    def test_create_manager(self, admin_headers):
        """Test POST /api/admin/managers (superadmin only)"""
        import time
        new_manager = {
            "name": "TEST_Ahmet Yılmaz",
            "email": f"test.manager.{int(time.time())}@kineticr.com",
            "password": "testpass123",
            "store_id": "store_001"
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/managers", 
                                headers=admin_headers, json=new_manager)
        assert response.status_code == 200
        manager = response.json()
        assert "admin_id" in manager
        assert manager["name"] == new_manager["name"]
        assert manager["role"] == "manager"
        assert "password_hash" not in manager  # Should be excluded
        print(f"✓ Manager created: {manager['name']} ({manager['email']})")
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/admin/managers", headers=admin_headers)
        managers = get_response.json()
        assert any(m["admin_id"] == manager["admin_id"] for m in managers)
        print(f"✓ Manager persistence verified")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/managers/{manager['admin_id']}", headers=admin_headers)


class TestAdminOrders:
    """Test admin order management"""
    
    @pytest.fixture
    def admin_headers(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", 
                                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}", "Content-Type": "application/json"}
    
    def test_list_orders(self, admin_headers):
        """Test GET /api/admin/orders"""
        response = requests.get(f"{BASE_URL}/api/admin/orders", headers=admin_headers)
        assert response.status_code == 200
        orders = response.json()
        assert isinstance(orders, list)
        print(f"✓ Order list retrieved: {len(orders)} orders")
    
    def test_update_order_status(self, admin_headers):
        """Test PUT /api/admin/orders/{order_id}/status"""
        # First, get an existing order (if any)
        list_response = requests.get(f"{BASE_URL}/api/admin/orders", headers=admin_headers)
        orders = list_response.json()
        
        if len(orders) == 0:
            pytest.skip("No orders available for testing")
        
        order_id = orders[0]["order_id"]
        
        # Update status
        response = requests.put(
            f"{BASE_URL}/api/admin/orders/{order_id}/status",
            headers=admin_headers,
            json={"status": "preparing"}
        )
        assert response.status_code == 200
        updated_order = response.json()
        assert updated_order["status"] == "preparing"
        print(f"✓ Order status updated: {order_id} -> preparing")


class TestAdminUsers:
    """Test admin user management"""
    
    @pytest.fixture
    def admin_headers(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", 
                                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}", "Content-Type": "application/json"}
    
    def test_list_users(self, admin_headers):
        """Test GET /api/admin/users"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        
        # Verify user structure
        if len(users) > 0:
            user = users[0]
            assert "user_id" in user
            assert "email" in user
            assert "name" in user
            assert "points" in user
            assert "tier" in user
            print(f"✓ User list retrieved: {len(users)} users")


class TestAdminRewards:
    """Test admin reward CRUD operations"""
    
    @pytest.fixture
    def admin_headers(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", 
                                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return {"Authorization": f"Bearer {response.json()['token']}", "Content-Type": "application/json"}
    
    def test_create_reward(self, admin_headers):
        """Test POST /api/admin/rewards"""
        new_reward = {
            "name": "TEST_Ücretsiz Kurabiye",
            "description": "Herhangi bir kurabiye hediye",
            "points_required": 75,
            "category": "Yiyecek"
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/rewards", 
                                headers=admin_headers, json=new_reward)
        assert response.status_code == 200
        reward = response.json()
        assert "reward_id" in reward
        assert reward["name"] == new_reward["name"]
        print(f"✓ Reward created: {reward['name']} ({reward['points_required']} puan)")
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/rewards")
        rewards = get_response.json()
        assert any(r["reward_id"] == reward["reward_id"] for r in rewards)
        print(f"✓ Reward persistence verified")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/rewards/{reward['reward_id']}", headers=admin_headers)
