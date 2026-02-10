from fastapi import FastAPI, APIRouter, Request, Response, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
import hashlib
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Helpers ───
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

async def get_current_user(request: Request) -> dict:
    token = None
    cookie_token = request.cookies.get("session_token")
    if cookie_token:
        token = cookie_token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    if not token:
        raise HTTPException(status_code=401, detail="Giriş yapılmamış")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Geçersiz oturum")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Oturum süresi dolmuş")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    return user

async def get_admin_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    if not token:
        raise HTTPException(status_code=401, detail="Giriş yapılmamış")
    session = await db.admin_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Geçersiz admin oturumu")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Oturum süresi dolmuş")
    admin = await db.admins.find_one({"admin_id": session["admin_id"]}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin bulunamadı")
    return admin

# ─── Auth (Customer) ───
@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id gerekli")
    async with httpx.AsyncClient() as http_client:
        res = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Geçersiz session_id")
    data = res.json()
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": data["email"]}, {"$set": {"name": data["name"], "picture": data.get("picture", "")}})
    else:
        await db.users.insert_one({
            "user_id": user_id, "email": data["email"], "name": data["name"],
            "picture": data.get("picture", ""), "points": 100, "tier": "Bronz",
            "created_at": datetime.now(timezone.utc)
        })
    session_token = data.get("session_token", str(uuid.uuid4()))
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60)
    return {"user": user, "session_token": session_token}

@api_router.get("/auth/me")
async def auth_me(request: Request):
    return await get_current_user(request)

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Çıkış yapıldı"}

# ─── Admin Auth ───
@api_router.post("/admin/login")
async def admin_login(request: Request):
    body = await request.json()
    email = body.get("email", "")
    password = body.get("password", "")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email ve şifre gerekli")
    admin = await db.admins.find_one({"email": email}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Geçersiz giriş bilgileri")
    if admin["password_hash"] != hash_password(password):
        raise HTTPException(status_code=401, detail="Geçersiz giriş bilgileri")
    session_token = f"admin_{uuid.uuid4().hex}"
    await db.admin_sessions.delete_many({"admin_id": admin["admin_id"]})
    await db.admin_sessions.insert_one({
        "admin_id": admin["admin_id"], "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    return {"token": session_token, "admin": {"admin_id": admin["admin_id"], "name": admin["name"], "email": admin["email"], "role": admin["role"], "store_id": admin.get("store_id")}}

@api_router.get("/admin/me")
async def admin_me(request: Request):
    admin = await get_admin_user(request)
    return {"admin_id": admin["admin_id"], "name": admin["name"], "email": admin["email"], "role": admin["role"], "store_id": admin.get("store_id")}

@api_router.post("/admin/logout")
async def admin_logout(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        await db.admin_sessions.delete_many({"session_token": token})
    return {"message": "Çıkış yapıldı"}

# ─── Admin: Branch Managers ───
@api_router.post("/admin/managers")
async def create_manager(request: Request):
    admin = await get_admin_user(request)
    if admin["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    body = await request.json()
    existing = await db.admins.find_one({"email": body["email"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")
    manager = {
        "admin_id": f"mgr_{uuid.uuid4().hex[:10]}",
        "name": body["name"], "email": body["email"],
        "password_hash": hash_password(body["password"]),
        "role": "manager", "store_id": body.get("store_id", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.admins.insert_one(manager)
    manager.pop("_id", None)
    manager.pop("password_hash", None)
    return manager

@api_router.get("/admin/managers")
async def list_managers(request: Request):
    await get_admin_user(request)
    managers = await db.admins.find({"role": "manager"}, {"_id": 0, "password_hash": 0}).to_list(100)
    return managers

@api_router.delete("/admin/managers/{manager_id}")
async def delete_manager(manager_id: str, request: Request):
    admin = await get_admin_user(request)
    if admin["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    result = await db.admins.delete_one({"admin_id": manager_id, "role": "manager"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Yetkili bulunamadı")
    await db.admin_sessions.delete_many({"admin_id": manager_id})
    return {"message": "Yetkili silindi"}

# ─── Admin: Menu CRUD ───
@api_router.post("/admin/menu")
async def create_menu_item(request: Request):
    await get_admin_user(request)
    body = await request.json()
    item = {
        "item_id": f"item_{uuid.uuid4().hex[:8]}",
        "name": body["name"], "description": body["description"],
        "price": body["price"], "category": body["category"],
        "image_url": body.get("image_url", "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400"),
        "sizes": body.get("sizes", []), "popular": body.get("popular", False)
    }
    await db.menu_items.insert_one(item)
    item.pop("_id", None)
    return item

@api_router.put("/admin/menu/{item_id}")
async def update_menu_item(item_id: str, request: Request):
    await get_admin_user(request)
    body = await request.json()
    update_data = {k: v for k, v in body.items() if k != "item_id"}
    result = await db.menu_items.update_one({"item_id": item_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return await db.menu_items.find_one({"item_id": item_id}, {"_id": 0})

@api_router.delete("/admin/menu/{item_id}")
async def delete_menu_item(item_id: str, request: Request):
    await get_admin_user(request)
    result = await db.menu_items.delete_one({"item_id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return {"message": "Ürün silindi"}

# ─── Admin: Store CRUD ───
@api_router.post("/admin/stores")
async def create_store(request: Request):
    admin = await get_admin_user(request)
    if admin["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    body = await request.json()
    store = {
        "store_id": f"store_{uuid.uuid4().hex[:6]}",
        "name": body["name"], "address": body["address"], "city": body["city"],
        "hours": body.get("hours", "08:00 - 22:00"), "phone": body.get("phone", ""),
        "lat": body.get("lat", 0), "lng": body.get("lng", 0),
        "image_url": body.get("image_url", "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400")
    }
    await db.stores.insert_one(store)
    store.pop("_id", None)
    return store

@api_router.put("/admin/stores/{store_id}")
async def update_store(store_id: str, request: Request):
    admin = await get_admin_user(request)
    if admin["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    body = await request.json()
    update_data = {k: v for k, v in body.items() if k != "store_id"}
    result = await db.stores.update_one({"store_id": store_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Şube bulunamadı")
    return await db.stores.find_one({"store_id": store_id}, {"_id": 0})

@api_router.delete("/admin/stores/{store_id}")
async def delete_store(store_id: str, request: Request):
    admin = await get_admin_user(request)
    if admin["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    result = await db.stores.delete_one({"store_id": store_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Şube bulunamadı")
    return {"message": "Şube silindi"}

# ─── Admin: Campaigns ───
@api_router.get("/admin/campaigns")
async def list_campaigns(request: Request):
    await get_admin_user(request)
    campaigns = await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return campaigns

@api_router.post("/admin/campaigns")
async def create_campaign(request: Request):
    await get_admin_user(request)
    body = await request.json()
    campaign = {
        "campaign_id": f"camp_{uuid.uuid4().hex[:8]}",
        "title": body["title"], "description": body["description"],
        "discount_type": body.get("discount_type", "percent"),
        "discount_value": body.get("discount_value", 10),
        "start_date": body.get("start_date", datetime.now(timezone.utc).isoformat()),
        "end_date": body.get("end_date", (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()),
        "active": body.get("active", True),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.campaigns.insert_one(campaign)
    campaign.pop("_id", None)
    return campaign

@api_router.put("/admin/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, request: Request):
    await get_admin_user(request)
    body = await request.json()
    update_data = {k: v for k, v in body.items() if k != "campaign_id"}
    result = await db.campaigns.update_one({"campaign_id": campaign_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Kampanya bulunamadı")
    return await db.campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})

@api_router.delete("/admin/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, request: Request):
    await get_admin_user(request)
    result = await db.campaigns.delete_one({"campaign_id": campaign_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kampanya bulunamadı")
    return {"message": "Kampanya silindi"}

# ─── Admin: Notifications (send to all) ───
@api_router.post("/admin/notifications/send")
async def send_notification_to_all(request: Request):
    await get_admin_user(request)
    body = await request.json()
    title = body.get("title", "")
    message_body = body.get("body", "")
    if not title or not message_body:
        raise HTTPException(status_code=400, detail="Başlık ve mesaj gerekli")
    users = await db.users.find({}, {"_id": 0, "user_id": 1}).to_list(10000)
    notifs = []
    for u in users:
        notifs.append({
            "notification_id": f"notif_{uuid.uuid4().hex[:10]}",
            "user_id": u["user_id"], "title": title, "body": message_body,
            "read": False, "created_at": datetime.now(timezone.utc).isoformat()
        })
    if notifs:
        await db.notifications.insert_many(notifs)
    return {"message": f"{len(notifs)} kullanıcıya bildirim gönderildi"}

# ─── Admin: QR / Add Points ───
@api_router.post("/admin/add-points")
async def add_points_to_user(request: Request):
    await get_admin_user(request)
    body = await request.json()
    user_id = body.get("user_id", "")
    points = body.get("points", 0)
    if not user_id or points <= 0:
        raise HTTPException(status_code=400, detail="Geçerli kullanıcı ID ve puan gerekli")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    new_points = user.get("points", 0) + points
    tier = "Bronz"
    if new_points >= 500:
        tier = "Altın"
    elif new_points >= 200:
        tier = "Gümüş"
    await db.users.update_one({"user_id": user_id}, {"$set": {"points": new_points, "tier": tier}})
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:10]}",
        "user_id": user_id, "title": "Puan Kazandınız!",
        "body": f"Hesabınıza {points} puan eklendi. Toplam: {new_points} puan.",
        "read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": f"{points} puan eklendi", "new_points": new_points, "tier": tier, "user_name": user["name"]}

# ─── Admin: Orders Management ───
@api_router.get("/admin/orders")
async def admin_list_orders(request: Request):
    await get_admin_user(request)
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return orders

@api_router.put("/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, request: Request):
    await get_admin_user(request)
    body = await request.json()
    new_status = body.get("status", "")
    result = await db.orders.update_one({"order_id": order_id}, {"$set": {"status": new_status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    status_text = {"confirmed": "onaylandı", "preparing": "hazırlanıyor", "ready": "hazır", "completed": "tamamlandı", "cancelled": "iptal edildi"}.get(new_status, new_status)
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:10]}",
        "user_id": order["user_id"], "title": "Sipariş Güncellendi",
        "body": f"#{order_id[-6:]} numaralı siparişiniz {status_text}.",
        "read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return order

# ─── Admin: Users ───
@api_router.get("/admin/users")
async def admin_list_users(request: Request):
    await get_admin_user(request)
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return users

# ─── Admin: Stats ───
@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    await get_admin_user(request)
    total_users = await db.users.count_documents({})
    total_orders = await db.orders.count_documents({})
    total_menu = await db.menu_items.count_documents({})
    total_stores = await db.stores.count_documents({})
    total_campaigns = await db.campaigns.count_documents({})
    total_managers = await db.admins.count_documents({"role": "manager"})
    orders = await db.orders.find({}, {"_id": 0, "total": 1}).to_list(10000)
    total_revenue = sum(o.get("total", 0) for o in orders)
    return {
        "total_users": total_users, "total_orders": total_orders,
        "total_menu_items": total_menu, "total_stores": total_stores,
        "total_campaigns": total_campaigns, "total_managers": total_managers,
        "total_revenue": round(total_revenue, 2)
    }

# ─── Admin: Rewards CRUD ───
@api_router.post("/admin/rewards")
async def create_reward(request: Request):
    await get_admin_user(request)
    body = await request.json()
    reward = {
        "reward_id": f"rwd_{uuid.uuid4().hex[:6]}",
        "name": body["name"], "description": body["description"],
        "points_required": body["points_required"], "category": body.get("category", "Genel")
    }
    await db.rewards.insert_one(reward)
    reward.pop("_id", None)
    return reward

@api_router.delete("/admin/rewards/{reward_id}")
async def delete_reward(reward_id: str, request: Request):
    await get_admin_user(request)
    result = await db.rewards.delete_one({"reward_id": reward_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ödül bulunamadı")
    return {"message": "Ödül silindi"}

# ─── Customer: Menu ───
@api_router.get("/menu")
async def get_menu():
    items = await db.menu_items.find({}, {"_id": 0}).to_list(100)
    if not items:
        await seed_menu_data()
        items = await db.menu_items.find({}, {"_id": 0}).to_list(100)
    return items

@api_router.get("/menu/{item_id}")
async def get_menu_item(item_id: str):
    item = await db.menu_items.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return item

# ─── Customer: Orders ───
@api_router.post("/orders")
async def create_order(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    points_earned = int(body["total"] * 10)
    order_doc = {
        "order_id": f"ord_{uuid.uuid4().hex[:10]}", "user_id": user["user_id"],
        "items": body["items"], "store_id": body["store_id"], "store_name": body["store_name"],
        "total": body["total"], "points_earned": points_earned,
        "status": "confirmed", "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order_doc)
    new_points = user.get("points", 0) + points_earned
    tier = "Bronz"
    if new_points >= 500: tier = "Altın"
    elif new_points >= 200: tier = "Gümüş"
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"points": new_points, "tier": tier}})
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:10]}", "user_id": user["user_id"],
        "title": "Sipariş Onaylandı!", "body": f"#{order_doc['order_id'][-6:]} numaralı siparişiniz {body['store_name']} şubesinde hazırlanıyor. {points_earned} puan kazandınız!",
        "read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    order_doc.pop("_id", None)
    return order_doc

@api_router.get("/orders")
async def get_orders(request: Request):
    user = await get_current_user(request)
    return await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

# ─── Customer: Stores ───
@api_router.get("/stores")
async def get_stores():
    stores = await db.stores.find({}, {"_id": 0}).to_list(50)
    if not stores:
        await seed_store_data()
        stores = await db.stores.find({}, {"_id": 0}).to_list(50)
    return stores

# ─── Customer: Rewards ───
@api_router.get("/rewards")
async def get_rewards():
    rewards = await db.rewards.find({}, {"_id": 0}).to_list(50)
    if not rewards:
        await seed_rewards_data()
        rewards = await db.rewards.find({}, {"_id": 0}).to_list(50)
    return rewards

@api_router.post("/rewards/redeem")
async def redeem_reward(request: Request):
    body = await request.json()
    user = await get_current_user(request)
    reward = await db.rewards.find_one({"reward_id": body.get("reward_id")}, {"_id": 0})
    if not reward: raise HTTPException(status_code=404, detail="Ödül bulunamadı")
    if user.get("points", 0) < reward["points_required"]:
        raise HTTPException(status_code=400, detail="Yeterli puanınız yok")
    new_points = user["points"] - reward["points_required"]
    tier = "Bronz"
    if new_points >= 500: tier = "Altın"
    elif new_points >= 200: tier = "Gümüş"
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"points": new_points, "tier": tier}})
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:10]}", "user_id": user["user_id"],
        "title": "Ödül Kullanıldı!", "body": f"'{reward['name']}' ödülünü {reward['points_required']} puan karşılığında kullandınız.",
        "read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Ödül kullanıldı", "new_points": new_points, "tier": tier}

# ─── Customer: Notifications ───
@api_router.get("/notifications")
async def get_notifications(request: Request):
    user = await get_current_user(request)
    return await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

@api_router.post("/notifications/read-all")
async def mark_all_read(request: Request):
    user = await get_current_user(request)
    await db.notifications.update_many({"user_id": user["user_id"]}, {"$set": {"read": True}})
    return {"message": "Tümü okundu olarak işaretlendi"}

# ─── Customer: Campaigns ───
@api_router.get("/campaigns")
async def get_active_campaigns():
    campaigns = await db.campaigns.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return campaigns

# ─── Customer: QR (user_id for scanning) ───
@api_router.get("/my-qr")
async def get_my_qr(request: Request):
    user = await get_current_user(request)
    return {"user_id": user["user_id"], "name": user["name"], "points": user["points"]}

# ─── Push Token ───
@api_router.post("/push-token")
async def register_push_token(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    await db.push_tokens.update_one(
        {"user_id": user["user_id"]}, {"$set": {"token": body["token"], "user_id": user["user_id"]}}, upsert=True)
    return {"message": "Token kaydedildi"}

# ─── Seed Data ───
async def seed_menu_data():
    items = [
        {"item_id": "esp_001", "name": "Klasik Espresso", "description": "Zengin, yoğun tek orijinli shot.", "price": 45.00, "category": "Espresso", "image_url": "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400", "sizes": ["Tek", "Çift"], "popular": True},
        {"item_id": "esp_002", "name": "Americano", "description": "Sıcak su ile uzatılmış yumuşak espresso.", "price": 50.00, "category": "Espresso", "image_url": "https://images.unsplash.com/photo-1551030173-122aabc4489c?w=400", "sizes": ["Küçük", "Orta", "Büyük"], "popular": False},
        {"item_id": "esp_003", "name": "Macchiato", "description": "Kadifemsi köpük ile lekelenmiş espresso.", "price": 55.00, "category": "Espresso", "image_url": "https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400", "sizes": ["Tek", "Çift"], "popular": False},
        {"item_id": "lat_001", "name": "Karamel Latte", "description": "İpeksi süt, espresso ve ev yapımı karamel.", "price": 70.00, "category": "Latte", "image_url": "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400", "sizes": ["Küçük", "Orta", "Büyük"], "popular": True},
        {"item_id": "lat_002", "name": "Vanilya Yulaf Latte", "description": "Kremsi yulaf sütü, vanilya ve çift espresso.", "price": 75.00, "category": "Latte", "image_url": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400", "sizes": ["Küçük", "Orta", "Büyük"], "popular": True},
        {"item_id": "lat_003", "name": "Matcha Latte", "description": "Tören kalitesi matcha ile buharlanmış süt.", "price": 72.00, "category": "Latte", "image_url": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=400", "sizes": ["Küçük", "Orta", "Büyük"], "popular": False},
        {"item_id": "cold_001", "name": "Soğuk Demleme", "description": "20 saat demlenmiş yumuşak soğuk kahve.", "price": 65.00, "category": "Soğuk İçecekler", "image_url": "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400", "sizes": ["Orta", "Büyük"], "popular": True},
        {"item_id": "cold_002", "name": "Buzlu Mocha", "description": "Çikolata, espresso ve soğuk süt buz üzerinde.", "price": 72.00, "category": "Soğuk İçecekler", "image_url": "https://images.unsplash.com/photo-1592663527359-cf6642f54cff?w=400", "sizes": ["Orta", "Büyük"], "popular": False},
        {"item_id": "food_001", "name": "Tereyağlı Kruvasan", "description": "Pul pul, altın rengi, her sabah taze.", "price": 55.00, "category": "Atıştırmalık", "image_url": "https://images.unsplash.com/photo-1555507036-ab1f4038024a?w=400", "sizes": [], "popular": True},
        {"item_id": "food_002", "name": "Yabanmersinli Muffin", "description": "Yaban mersini dolu nemli muffin.", "price": 50.00, "category": "Atıştırmalık", "image_url": "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400", "sizes": [], "popular": False},
        {"item_id": "food_003", "name": "Avokado Toast", "description": "Ekşi maya ekmek üzerinde ezilmiş avokado.", "price": 90.00, "category": "Atıştırmalık", "image_url": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400", "sizes": [], "popular": False},
    ]
    await db.menu_items.insert_many(items)

async def seed_store_data():
    stores = [
        {"store_id": "store_001", "name": "Kinetic Roast — Kadıköy", "address": "Caferağa Mah. Moda Cad. No:42", "city": "İstanbul", "hours": "07:00 - 23:00", "phone": "(216) 555-0101", "lat": 40.9884, "lng": 29.0282, "image_url": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400"},
        {"store_id": "store_002", "name": "Kinetic Roast — Beşiktaş", "address": "Sinanpaşa Mah. Ortabahçe Cad. No:18", "city": "İstanbul", "hours": "07:00 - 22:30", "phone": "(212) 555-0202", "lat": 41.0422, "lng": 29.0047, "image_url": "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=400"},
        {"store_id": "store_003", "name": "Kinetic Roast — Nişantaşı", "address": "Teşvikiye Mah. Abdi İpekçi Cad. No:56", "city": "İstanbul", "hours": "08:00 - 22:00", "phone": "(212) 555-0303", "lat": 41.0486, "lng": 28.9953, "image_url": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400"},
        {"store_id": "store_004", "name": "Kinetic Roast — Bağdat Caddesi", "address": "Suadiye Mah. Bağdat Cad. No:124", "city": "İstanbul", "hours": "07:30 - 23:00", "phone": "(216) 555-0404", "lat": 40.9631, "lng": 29.0685, "image_url": "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=400"},
    ]
    await db.stores.insert_many(stores)

async def seed_rewards_data():
    rewards = [
        {"reward_id": "rwd_001", "name": "Ücretsiz Espresso Shot", "description": "Herhangi bir içeceğe ekstra shot hediye.", "points_required": 50, "category": "İçecek"},
        {"reward_id": "rwd_002", "name": "Ücretsiz Atıştırmalık", "description": "İstediğiniz atıştırmalık bizden.", "points_required": 100, "category": "Yiyecek"},
        {"reward_id": "rwd_003", "name": "Ücretsiz Orta Boy İçecek", "description": "Herhangi bir orta boy içecek hediye.", "points_required": 200, "category": "İçecek"},
        {"reward_id": "rwd_004", "name": "Ücretsiz Büyük Boy İçecek", "description": "Herhangi bir büyük boy içecek hediye.", "points_required": 300, "category": "İçecek"},
        {"reward_id": "rwd_005", "name": "₺100 İndirim", "description": "Bir sonraki siparişinizde ₺100 indirim.", "points_required": 500, "category": "İndirim"},
    ]
    await db.rewards.insert_many(rewards)

async def seed_admin():
    existing = await db.admins.find_one({"email": "admin@kineticr.com"}, {"_id": 0})
    if not existing:
        await db.admins.insert_one({
            "admin_id": "admin_super_001", "name": "Süper Admin", "email": "admin@kineticr.com",
            "password_hash": hash_password("admin123"), "role": "superadmin", "store_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Default admin seeded: admin@kineticr.com / admin123")

@api_router.get("/")
async def root():
    return {"message": "Kinetic Roast API"}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup_event():
    await seed_admin()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
