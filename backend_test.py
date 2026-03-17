#!/usr/bin/env python3
"""
Comprehensive backend API test suite for Glob Coffee app.
Tests all backend endpoints systematically.
"""

import requests
import json
import sys

# Use the production URL from frontend/.env
BASE_URL = "https://coffee-admin-portal.preview.emergentagent.com/api"

class GlobCoffeeAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.admin_token = None
        self.test_results = {}
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Glob-Coffee-Backend-Tester/1.0'
        })

    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results[test_name] = {"success": success, "details": details}

    def test_root_api(self):
        """Test root API endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if data.get("message") == "Glob Coffee API":
                    self.log_test("Root API", True, f"Response: {data}")
                else:
                    self.log_test("Root API", False, f"Unexpected message: {data}")
            else:
                self.log_test("Root API", False, f"Status: {response.status_code}, Body: {response.text}")
        except Exception as e:
            self.log_test("Root API", False, f"Exception: {str(e)}")

    def test_customer_menu(self):
        """Test customer menu endpoints"""
        try:
            # Test GET /api/menu
            response = self.session.get(f"{self.base_url}/menu")
            if response.status_code == 200:
                menu_items = response.json()
                if isinstance(menu_items, list) and len(menu_items) > 0:
                    item = menu_items[0]
                    self.log_test("Customer Menu List", True, f"Found {len(menu_items)} menu items")
                    
                    # Test GET /api/menu/{item_id}
                    if 'item_id' in item:
                        item_response = self.session.get(f"{self.base_url}/menu/{item['item_id']}")
                        if item_response.status_code == 200:
                            self.log_test("Customer Menu Item", True, f"Retrieved item: {item['name']}")
                        else:
                            self.log_test("Customer Menu Item", False, f"Status: {item_response.status_code}")
                    else:
                        self.log_test("Customer Menu Item", False, "No item_id in menu item")
                else:
                    self.log_test("Customer Menu List", False, "Menu is empty or not a list")
            else:
                self.log_test("Customer Menu List", False, f"Status: {response.status_code}, Body: {response.text}")
        except Exception as e:
            self.log_test("Customer Menu", False, f"Exception: {str(e)}")

    def test_customer_stores(self):
        """Test customer stores endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/stores")
            if response.status_code == 200:
                stores = response.json()
                if isinstance(stores, list) and len(stores) > 0:
                    self.log_test("Customer Stores", True, f"Found {len(stores)} stores")
                else:
                    self.log_test("Customer Stores", False, "Stores list is empty")
            else:
                self.log_test("Customer Stores", False, f"Status: {response.status_code}, Body: {response.text}")
        except Exception as e:
            self.log_test("Customer Stores", False, f"Exception: {str(e)}")

    def test_customer_campaigns(self):
        """Test customer campaigns endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/campaigns")
            if response.status_code == 200:
                campaigns = response.json()
                if isinstance(campaigns, list):
                    self.log_test("Customer Campaigns", True, f"Found {len(campaigns)} active campaigns")
                else:
                    self.log_test("Customer Campaigns", False, "Campaigns response is not a list")
            else:
                self.log_test("Customer Campaigns", False, f"Status: {response.status_code}, Body: {response.text}")
        except Exception as e:
            self.log_test("Customer Campaigns", False, f"Exception: {str(e)}")

    def test_customer_wheel_prizes(self):
        """Test customer wheel prizes endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/wheel-prizes")
            if response.status_code == 200:
                prizes = response.json()
                if isinstance(prizes, list) and len(prizes) > 0:
                    self.log_test("Customer Wheel Prizes", True, f"Found {len(prizes)} wheel prizes")
                else:
                    self.log_test("Customer Wheel Prizes", False, "Wheel prizes list is empty")
            else:
                self.log_test("Customer Wheel Prizes", False, f"Status: {response.status_code}, Body: {response.text}")
        except Exception as e:
            self.log_test("Customer Wheel Prizes", False, f"Exception: {str(e)}")

    def test_customer_rewards(self):
        """Test customer rewards endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/rewards")
            if response.status_code == 200:
                rewards = response.json()
                if isinstance(rewards, list) and len(rewards) > 0:
                    self.log_test("Customer Rewards", True, f"Found {len(rewards)} rewards")
                else:
                    self.log_test("Customer Rewards", False, "Rewards list is empty")
            else:
                self.log_test("Customer Rewards", False, f"Status: {response.status_code}, Body: {response.text}")
        except Exception as e:
            self.log_test("Customer Rewards", False, f"Exception: {str(e)}")

    def test_admin_login(self):
        """Test admin login"""
        try:
            login_data = {
                "email": "admin@globcoffee.com",
                "password": "admin123"
            }
            response = self.session.post(f"{self.base_url}/admin/login", json=login_data)
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "admin" in data:
                    self.admin_token = data["token"]
                    self.log_test("Admin Login", True, f"Logged in as: {data['admin']['name']}")
                    return True
                else:
                    self.log_test("Admin Login", False, f"Missing token or admin in response: {data}")
            else:
                self.log_test("Admin Login", False, f"Status: {response.status_code}, Body: {response.text}")
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
        return False

    def admin_request(self, method, endpoint, data=None):
        """Make authenticated admin request"""
        if not self.admin_token:
            raise Exception("Admin token not available")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        url = f"{self.base_url}/admin{endpoint}"
        
        if method.upper() == "GET":
            return self.session.get(url, headers=headers)
        elif method.upper() == "POST":
            return self.session.post(url, json=data, headers=headers)
        elif method.upper() == "PUT":
            return self.session.put(url, json=data, headers=headers)
        elif method.upper() == "DELETE":
            return self.session.delete(url, headers=headers)

    def test_admin_stats(self):
        """Test admin stats endpoint"""
        try:
            response = self.admin_request("GET", "/stats")
            if response.status_code == 200:
                stats = response.json()
                required_fields = ["total_users", "total_orders", "total_menu_items", "total_stores"]
                if all(field in stats for field in required_fields):
                    self.log_test("Admin Stats", True, f"Stats: {stats}")
                else:
                    missing = [f for f in required_fields if f not in stats]
                    self.log_test("Admin Stats", False, f"Missing fields: {missing}")
            else:
                self.log_test("Admin Stats", False, f"Status: {response.status_code}, Body: {response.text}")
        except Exception as e:
            self.log_test("Admin Stats", False, f"Exception: {str(e)}")

    def test_admin_menu_crud(self):
        """Test admin menu CRUD operations"""
        item_id = None
        try:
            # CREATE
            create_data = {
                "name": "Test Kahve",
                "description": "Test açıklama",
                "price": 55,
                "category": "Espresso"
            }
            response = self.admin_request("POST", "/menu", create_data)
            if response.status_code == 200:
                item = response.json()
                item_id = item.get("item_id")
                self.log_test("Admin Menu Create", True, f"Created item: {item['name']} (ID: {item_id})")
                
                # UPDATE
                if item_id:
                    update_data = {
                        "name": "Test Kahve Güncel",
                        "price": 60
                    }
                    update_response = self.admin_request("PUT", f"/menu/{item_id}", update_data)
                    if update_response.status_code == 200:
                        updated_item = update_response.json()
                        if updated_item["name"] == "Test Kahve Güncel" and updated_item["price"] == 60:
                            self.log_test("Admin Menu Update", True, f"Updated item successfully")
                        else:
                            self.log_test("Admin Menu Update", False, f"Update values not reflected: {updated_item}")
                    else:
                        self.log_test("Admin Menu Update", False, f"Update failed: {update_response.status_code}")
            else:
                self.log_test("Admin Menu Create", False, f"Status: {response.status_code}, Body: {response.text}")

        except Exception as e:
            self.log_test("Admin Menu CRUD", False, f"Exception: {str(e)}")
        
        # Clean up - DELETE
        if item_id:
            try:
                delete_response = self.admin_request("DELETE", f"/menu/{item_id}")
                if delete_response.status_code == 200:
                    self.log_test("Admin Menu Delete", True, f"Deleted item: {item_id}")
                else:
                    self.log_test("Admin Menu Delete", False, f"Delete failed: {delete_response.status_code}")
            except Exception as e:
                self.log_test("Admin Menu Delete", False, f"Delete exception: {str(e)}")

    def test_admin_campaign_crud(self):
        """Test admin campaign CRUD operations"""
        campaign_id = None
        try:
            # CREATE
            create_data = {
                "title": "Test Kampanya",
                "description": "Test indirim",
                "discount_value": 15,
                "discount_type": "percent"
            }
            response = self.admin_request("POST", "/campaigns", create_data)
            if response.status_code == 200:
                campaign = response.json()
                campaign_id = campaign.get("campaign_id")
                self.log_test("Admin Campaign Create", True, f"Created campaign: {campaign['title']} (ID: {campaign_id})")
                
                # UPDATE
                if campaign_id:
                    update_data = {"title": "Güncel Kampanya"}
                    update_response = self.admin_request("PUT", f"/campaigns/{campaign_id}", update_data)
                    if update_response.status_code == 200:
                        updated_campaign = update_response.json()
                        if updated_campaign["title"] == "Güncel Kampanya":
                            self.log_test("Admin Campaign Update", True, f"Updated campaign successfully")
                        else:
                            self.log_test("Admin Campaign Update", False, f"Update not reflected: {updated_campaign}")
                    else:
                        self.log_test("Admin Campaign Update", False, f"Update failed: {update_response.status_code}")
            else:
                self.log_test("Admin Campaign Create", False, f"Status: {response.status_code}, Body: {response.text}")

        except Exception as e:
            self.log_test("Admin Campaign CRUD", False, f"Exception: {str(e)}")
        
        # Clean up - DELETE
        if campaign_id:
            try:
                delete_response = self.admin_request("DELETE", f"/campaigns/{campaign_id}")
                if delete_response.status_code == 200:
                    self.log_test("Admin Campaign Delete", True, f"Deleted campaign: {campaign_id}")
                else:
                    self.log_test("Admin Campaign Delete", False, f"Delete failed: {delete_response.status_code}")
            except Exception as e:
                self.log_test("Admin Campaign Delete", False, f"Delete exception: {str(e)}")

    def test_admin_store_crud(self):
        """Test admin store CRUD operations"""
        store_id = None
        try:
            # CREATE
            create_data = {
                "name": "Glob Coffee — Test",
                "address": "Test Cad. No:1",
                "city": "İstanbul",
                "hours": "08:00-22:00",
                "phone": "(212) 555-9999"
            }
            response = self.admin_request("POST", "/stores", create_data)
            if response.status_code == 200:
                store = response.json()
                store_id = store.get("store_id")
                self.log_test("Admin Store Create", True, f"Created store: {store['name']} (ID: {store_id})")
                
                # UPDATE
                if store_id:
                    update_data = {"name": "Glob Coffee — Test Güncel"}
                    update_response = self.admin_request("PUT", f"/stores/{store_id}", update_data)
                    if update_response.status_code == 200:
                        updated_store = update_response.json()
                        if updated_store["name"] == "Glob Coffee — Test Güncel":
                            self.log_test("Admin Store Update", True, f"Updated store successfully")
                        else:
                            self.log_test("Admin Store Update", False, f"Update not reflected: {updated_store}")
                    else:
                        self.log_test("Admin Store Update", False, f"Update failed: {update_response.status_code}")
            else:
                self.log_test("Admin Store Create", False, f"Status: {response.status_code}, Body: {response.text}")

        except Exception as e:
            self.log_test("Admin Store CRUD", False, f"Exception: {str(e)}")
        
        # Clean up - DELETE
        if store_id:
            try:
                delete_response = self.admin_request("DELETE", f"/stores/{store_id}")
                if delete_response.status_code == 200:
                    self.log_test("Admin Store Delete", True, f"Deleted store: {store_id}")
                else:
                    self.log_test("Admin Store Delete", False, f"Delete failed: {delete_response.status_code}")
            except Exception as e:
                self.log_test("Admin Store Delete", False, f"Delete exception: {str(e)}")

    def test_admin_manager_crud(self):
        """Test admin manager CRUD operations"""
        admin_id = None
        try:
            # CREATE
            create_data = {
                "name": "Test Yetkili",
                "email": "test@globcoffee.com",
                "password": "test123",
                "store_id": "store_001"
            }
            response = self.admin_request("POST", "/managers", create_data)
            if response.status_code == 200:
                manager = response.json()
                admin_id = manager.get("admin_id")
                self.log_test("Admin Manager Create", True, f"Created manager: {manager['name']} (ID: {admin_id})")
                
                # LIST
                list_response = self.admin_request("GET", "/managers")
                if list_response.status_code == 200:
                    managers = list_response.json()
                    if isinstance(managers, list):
                        self.log_test("Admin Manager List", True, f"Found {len(managers)} managers")
                    else:
                        self.log_test("Admin Manager List", False, "Response is not a list")
                else:
                    self.log_test("Admin Manager List", False, f"List failed: {list_response.status_code}")
            else:
                self.log_test("Admin Manager Create", False, f"Status: {response.status_code}, Body: {response.text}")

        except Exception as e:
            self.log_test("Admin Manager CRUD", False, f"Exception: {str(e)}")
        
        # Clean up - DELETE
        if admin_id:
            try:
                delete_response = self.admin_request("DELETE", f"/managers/{admin_id}")
                if delete_response.status_code == 200:
                    self.log_test("Admin Manager Delete", True, f"Deleted manager: {admin_id}")
                else:
                    self.log_test("Admin Manager Delete", False, f"Delete failed: {delete_response.status_code}")
            except Exception as e:
                self.log_test("Admin Manager Delete", False, f"Delete exception: {str(e)}")

    def test_admin_wheel_prize_crud(self):
        """Test admin wheel prize CRUD operations"""
        prize_id = None
        try:
            # CREATE
            create_data = {
                "label": "100 Puan",
                "type": "points",
                "value": 100,
                "color": "#FF0000",
                "probability": 5
            }
            response = self.admin_request("POST", "/wheel-prizes", create_data)
            if response.status_code == 200:
                prize = response.json()
                prize_id = prize.get("prize_id")
                self.log_test("Admin Wheel Prize Create", True, f"Created prize: {prize['label']} (ID: {prize_id})")
                
                # LIST
                list_response = self.admin_request("GET", "/wheel-prizes")
                if list_response.status_code == 200:
                    prizes = list_response.json()
                    if isinstance(prizes, list):
                        self.log_test("Admin Wheel Prize List", True, f"Found {len(prizes)} wheel prizes")
                    else:
                        self.log_test("Admin Wheel Prize List", False, "Response is not a list")
                else:
                    self.log_test("Admin Wheel Prize List", False, f"List failed: {list_response.status_code}")
            else:
                self.log_test("Admin Wheel Prize Create", False, f"Status: {response.status_code}, Body: {response.text}")

        except Exception as e:
            self.log_test("Admin Wheel Prize CRUD", False, f"Exception: {str(e)}")
        
        # Clean up - DELETE
        if prize_id:
            try:
                delete_response = self.admin_request("DELETE", f"/wheel-prizes/{prize_id}")
                if delete_response.status_code == 200:
                    self.log_test("Admin Wheel Prize Delete", True, f"Deleted prize: {prize_id}")
                else:
                    self.log_test("Admin Wheel Prize Delete", False, f"Delete failed: {delete_response.status_code}")
            except Exception as e:
                self.log_test("Admin Wheel Prize Delete", False, f"Delete exception: {str(e)}")

    def test_admin_notifications(self):
        """Test admin notifications send"""
        try:
            send_data = {
                "title": "Test Bildirim",
                "body": "Bu bir test bildirimidir."
            }
            response = self.admin_request("POST", "/notifications/send", send_data)
            if response.status_code == 200:
                result = response.json()
                if "message" in result:
                    self.log_test("Admin Notifications Send", True, f"Result: {result['message']}")
                else:
                    self.log_test("Admin Notifications Send", False, f"No message in response: {result}")
            else:
                self.log_test("Admin Notifications Send", False, f"Status: {response.status_code}, Body: {response.text}")
        except Exception as e:
            self.log_test("Admin Notifications Send", False, f"Exception: {str(e)}")

    def test_admin_add_points(self):
        """Test admin add points (QR) endpoint"""
        try:
            # First get a user to add points to (get from users endpoint)
            users_response = self.admin_request("GET", "/users")
            if users_response.status_code == 200:
                users = users_response.json()
                if isinstance(users, list) and len(users) > 0:
                    test_user_id = users[0]["user_id"]
                    
                    add_points_data = {
                        "user_id": test_user_id,
                        "points": 50
                    }
                    response = self.admin_request("POST", "/add-points", add_points_data)
                    if response.status_code == 200:
                        result = response.json()
                        if "message" in result and "new_points" in result:
                            self.log_test("Admin Add Points", True, f"Added points: {result['message']}")
                        else:
                            self.log_test("Admin Add Points", False, f"Missing expected fields: {result}")
                    else:
                        self.log_test("Admin Add Points", False, f"Status: {response.status_code}, Body: {response.text}")
                else:
                    self.log_test("Admin Add Points", False, "No users found to test adding points")
            else:
                self.log_test("Admin Add Points", False, f"Could not get users: {users_response.status_code}")
        except Exception as e:
            self.log_test("Admin Add Points", False, f"Exception: {str(e)}")

    def test_admin_users_and_orders(self):
        """Test admin users and orders endpoints"""
        try:
            # Test users endpoint
            users_response = self.admin_request("GET", "/users")
            if users_response.status_code == 200:
                users = users_response.json()
                if isinstance(users, list):
                    self.log_test("Admin Users", True, f"Found {len(users)} users")
                else:
                    self.log_test("Admin Users", False, "Users response is not a list")
            else:
                self.log_test("Admin Users", False, f"Status: {users_response.status_code}, Body: {users_response.text}")

            # Test orders endpoint
            orders_response = self.admin_request("GET", "/orders")
            if orders_response.status_code == 200:
                orders = orders_response.json()
                if isinstance(orders, list):
                    self.log_test("Admin Orders", True, f"Found {len(orders)} orders")
                else:
                    self.log_test("Admin Orders", False, "Orders response is not a list")
            else:
                self.log_test("Admin Orders", False, f"Status: {orders_response.status_code}, Body: {orders_response.text}")

        except Exception as e:
            self.log_test("Admin Users and Orders", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"🚀 Starting comprehensive backend API tests for Glob Coffee")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 80)

        # Test public endpoints first
        self.test_root_api()
        self.test_customer_menu()
        self.test_customer_stores()
        self.test_customer_campaigns()
        self.test_customer_wheel_prizes()
        self.test_customer_rewards()

        print("\n🔐 ADMIN TESTS (requires authentication)")
        print("-" * 50)

        # Admin authentication and tests
        if self.test_admin_login():
            self.test_admin_stats()
            self.test_admin_menu_crud()
            self.test_admin_campaign_crud()
            self.test_admin_store_crud()
            self.test_admin_manager_crud()
            self.test_admin_wheel_prize_crud()
            self.test_admin_notifications()
            self.test_admin_users_and_orders()
            self.test_admin_add_points()
        else:
            print("❌ Cannot proceed with admin tests - login failed")

        # Test summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for test_name, result in self.test_results.items():
                if not result["success"]:
                    print(f"  - {test_name}: {result['details']}")

        return failed_tests == 0

if __name__ == "__main__":
    tester = GlobCoffeeAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)