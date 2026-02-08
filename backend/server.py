from fastapi import FastAPI, APIRouter, Request, Response, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
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

# ─── Models ───
class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    points: int = 0
    tier: str = "Bronze"

class MenuItemOut(BaseModel):
    item_id: str
    name: str
    description: str
    price: float
    category: str
    image_url: str
    sizes: List[str] = ["Small", "Medium", "Large"]
    popular: bool = False

class StoreOut(BaseModel):
    store_id: str
    name: str
    address: str
    city: str
    hours: str
    phone: str
    lat: float
    lng: float
    image_url: str

class RewardOut(BaseModel):
    reward_id: str
    name: str
    description: str
    points_required: int
    category: str

class OrderItemIn(BaseModel):
    item_id: str
    name: str
    size: str
    quantity: int
    price: float

class OrderCreateIn(BaseModel):
    items: List[OrderItemIn]
    store_id: str
    store_name: str
    total: float

class OrderOut(BaseModel):
    order_id: str
    user_id: str
    items: list
    store_id: str
    store_name: str
    total: float
    points_earned: int
    status: str
    created_at: str

class NotificationOut(BaseModel):
    notification_id: str
    title: str
    body: str
    read: bool
    created_at: str

class PushTokenIn(BaseModel):
    token: str

# ─── Helpers ───
async def get_current_user(request: Request) -> dict:
    token = None
    cookie_token = request.cookies.get("session_token")
    if cookie_token:
        token = cookie_token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ─── Auth ───
@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    async with httpx.AsyncClient() as http_client:
        res = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = res.json()
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": data["email"]}, {"$set": {"name": data["name"], "picture": data.get("picture", "")}})
    else:
        await db.users.insert_one({
            "user_id": user_id,
            "email": data["email"],
            "name": data["name"],
            "picture": data.get("picture", ""),
            "points": 100,
            "tier": "Bronze",
            "created_at": datetime.now(timezone.utc)
        })
    session_token = data.get("session_token", str(uuid.uuid4()))
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none",
        path="/", max_age=7*24*60*60
    )
    return {"user": user, "session_token": session_token}

@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ─── Menu ───
@api_router.get("/menu", response_model=List[MenuItemOut])
async def get_menu():
    items = await db.menu_items.find({}, {"_id": 0}).to_list(100)
    if not items:
        await seed_menu_data()
        items = await db.menu_items.find({}, {"_id": 0}).to_list(100)
    return items

@api_router.get("/menu/categories")
async def get_categories():
    items = await db.menu_items.find({}, {"_id": 0}).to_list(100)
    if not items:
        await seed_menu_data()
        items = await db.menu_items.find({}, {"_id": 0}).to_list(100)
    categories = list(set(i["category"] for i in items))
    return categories

@api_router.get("/menu/{item_id}", response_model=MenuItemOut)
async def get_menu_item(item_id: str):
    item = await db.menu_items.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

# ─── Orders ───
@api_router.post("/orders")
async def create_order(order: OrderCreateIn, request: Request):
    user = await get_current_user(request)
    points_earned = int(order.total * 10)
    order_doc = {
        "order_id": f"ord_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "items": [i.dict() for i in order.items],
        "store_id": order.store_id,
        "store_name": order.store_name,
        "total": order.total,
        "points_earned": points_earned,
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order_doc)
    new_points = user.get("points", 0) + points_earned
    tier = "Bronze"
    if new_points >= 500:
        tier = "Gold"
    elif new_points >= 200:
        tier = "Silver"
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"points": new_points, "tier": tier}})
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "title": "Order Confirmed!",
        "body": f"Your order #{order_doc['order_id'][-6:]} is being prepared at {order.store_name}. You earned {points_earned} points!",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    order_doc.pop("_id", None)
    return order_doc

@api_router.get("/orders")
async def get_orders(request: Request):
    user = await get_current_user(request)
    orders = await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return orders

# ─── Stores ───
@api_router.get("/stores", response_model=List[StoreOut])
async def get_stores():
    stores = await db.stores.find({}, {"_id": 0}).to_list(50)
    if not stores:
        await seed_store_data()
        stores = await db.stores.find({}, {"_id": 0}).to_list(50)
    return stores

# ─── Rewards ───
@api_router.get("/rewards", response_model=List[RewardOut])
async def get_rewards():
    rewards = await db.rewards.find({}, {"_id": 0}).to_list(50)
    if not rewards:
        await seed_rewards_data()
        rewards = await db.rewards.find({}, {"_id": 0}).to_list(50)
    return rewards

@api_router.post("/rewards/redeem")
async def redeem_reward(request: Request):
    body = await request.json()
    reward_id = body.get("reward_id")
    user = await get_current_user(request)
    reward = await db.rewards.find_one({"reward_id": reward_id}, {"_id": 0})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    if user.get("points", 0) < reward["points_required"]:
        raise HTTPException(status_code=400, detail="Not enough points")
    new_points = user["points"] - reward["points_required"]
    tier = "Bronze"
    if new_points >= 500:
        tier = "Gold"
    elif new_points >= 200:
        tier = "Silver"
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"points": new_points, "tier": tier}})
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "title": "Reward Redeemed!",
        "body": f"You redeemed '{reward['name']}' for {reward['points_required']} points.",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Reward redeemed", "new_points": new_points, "tier": tier}

# ─── Notifications ───
@api_router.get("/notifications")
async def get_notifications(request: Request):
    user = await get_current_user(request)
    notifs = await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return notifs

@api_router.post("/notifications/read-all")
async def mark_all_read(request: Request):
    user = await get_current_user(request)
    await db.notifications.update_many({"user_id": user["user_id"]}, {"$set": {"read": True}})
    return {"message": "All marked read"}

# ─── Push Token ───
@api_router.post("/push-token")
async def register_push_token(token_in: PushTokenIn, request: Request):
    user = await get_current_user(request)
    await db.push_tokens.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"token": token_in.token, "user_id": user["user_id"]}},
        upsert=True
    )
    return {"message": "Token registered"}

# ─── Seed Data ───
async def seed_menu_data():
    items = [
        {"item_id": "esp_001", "name": "Classic Espresso", "description": "Rich, bold single-origin shot pulled to perfection.", "price": 3.50, "category": "Espresso", "image_url": "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400", "sizes": ["Single", "Double"], "popular": True},
        {"item_id": "esp_002", "name": "Americano", "description": "Smooth espresso lengthened with hot water.", "price": 4.00, "category": "Espresso", "image_url": "https://images.unsplash.com/photo-1551030173-122aabc4489c?w=400", "sizes": ["Small", "Medium", "Large"], "popular": False},
        {"item_id": "esp_003", "name": "Macchiato", "description": "Espresso stained with a dollop of velvety foam.", "price": 4.50, "category": "Espresso", "image_url": "https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400", "sizes": ["Single", "Double"], "popular": False},
        {"item_id": "lat_001", "name": "Caramel Latte", "description": "Silky steamed milk, espresso, and house-made caramel.", "price": 5.50, "category": "Lattes", "image_url": "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400", "sizes": ["Small", "Medium", "Large"], "popular": True},
        {"item_id": "lat_002", "name": "Vanilla Oat Latte", "description": "Creamy oat milk with vanilla bean and double espresso.", "price": 6.00, "category": "Lattes", "image_url": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400", "sizes": ["Small", "Medium", "Large"], "popular": True},
        {"item_id": "lat_003", "name": "Matcha Latte", "description": "Ceremonial grade matcha whisked with steamed milk.", "price": 5.75, "category": "Lattes", "image_url": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=400", "sizes": ["Small", "Medium", "Large"], "popular": False},
        {"item_id": "cold_001", "name": "Cold Brew", "description": "20-hour steeped smooth cold brew, served over ice.", "price": 5.00, "category": "Cold Drinks", "image_url": "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400", "sizes": ["Medium", "Large"], "popular": True},
        {"item_id": "cold_002", "name": "Iced Mocha", "description": "Chocolate, espresso, and cold milk over ice.", "price": 5.75, "category": "Cold Drinks", "image_url": "https://images.unsplash.com/photo-1592663527359-cf6642f54cff?w=400", "sizes": ["Medium", "Large"], "popular": False},
        {"item_id": "cold_003", "name": "Mango Smoothie", "description": "Fresh mango blended with yogurt and a hint of honey.", "price": 6.50, "category": "Cold Drinks", "image_url": "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400", "sizes": ["Medium", "Large"], "popular": False},
        {"item_id": "food_001", "name": "Butter Croissant", "description": "Flaky, golden, baked fresh every morning.", "price": 3.75, "category": "Pastries", "image_url": "https://images.unsplash.com/photo-1555507036-ab1f4038024a?w=400", "sizes": [], "popular": True},
        {"item_id": "food_002", "name": "Blueberry Muffin", "description": "Moist muffin bursting with wild blueberries.", "price": 3.50, "category": "Pastries", "image_url": "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400", "sizes": [], "popular": False},
        {"item_id": "food_003", "name": "Avocado Toast", "description": "Smashed avo on sourdough with chili flakes and lemon.", "price": 7.50, "category": "Pastries", "image_url": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400", "sizes": [], "popular": False},
    ]
    await db.menu_items.insert_many(items)

async def seed_store_data():
    stores = [
        {"store_id": "store_001", "name": "Kinetic Roast — Downtown", "address": "127 Main Street", "city": "San Francisco", "hours": "6:00 AM – 9:00 PM", "phone": "(415) 555-0101", "lat": 37.7749, "lng": -122.4194, "image_url": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400"},
        {"store_id": "store_002", "name": "Kinetic Roast — Mission", "address": "845 Valencia Street", "city": "San Francisco", "hours": "6:30 AM – 8:30 PM", "phone": "(415) 555-0202", "lat": 37.7599, "lng": -122.4214, "image_url": "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=400"},
        {"store_id": "store_003", "name": "Kinetic Roast — Marina", "address": "2100 Chestnut Street", "city": "San Francisco", "hours": "7:00 AM – 8:00 PM", "phone": "(415) 555-0303", "lat": 37.8003, "lng": -122.4374, "image_url": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400"},
        {"store_id": "store_004", "name": "Kinetic Roast — SoMa", "address": "350 Folsom Street", "city": "San Francisco", "hours": "6:00 AM – 7:00 PM", "phone": "(415) 555-0404", "lat": 37.7909, "lng": -122.3930, "image_url": "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=400"},
    ]
    await db.stores.insert_many(stores)

async def seed_rewards_data():
    rewards = [
        {"reward_id": "rwd_001", "name": "Free Espresso Shot", "description": "Add a free extra shot to any drink.", "points_required": 50, "category": "Drinks"},
        {"reward_id": "rwd_002", "name": "Free Pastry", "description": "Any pastry on the house.", "points_required": 100, "category": "Food"},
        {"reward_id": "rwd_003", "name": "Free Medium Drink", "description": "Any medium drink, completely free.", "points_required": 200, "category": "Drinks"},
        {"reward_id": "rwd_004", "name": "Free Large Drink", "description": "Any large drink on us.", "points_required": 300, "category": "Drinks"},
        {"reward_id": "rwd_005", "name": "$10 Off Order", "description": "$10 discount on your next order.", "points_required": 500, "category": "Discount"},
    ]
    await db.rewards.insert_many(rewards)

# ─── Root ───
@api_router.get("/")
async def root():
    return {"message": "Kinetic Roast API"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
