from fastapi import FastAPI, APIRouter, Request, Response, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, httpx, hashlib, random, time, re
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ═══ MENULUX ENTEGRASYONU (menü kaynağı) ═══
MENULUX_BASE = os.environ.get('MENULUX_BASE', 'https://apis.menulux.com/api')
MENULUX_API_KEY = os.environ.get('MENULUX_API_KEY', '')
MENULUX_CUSTOMER_ID = os.environ.get('MENULUX_CUSTOMER_ID', '')
MENULUX_MENU_ID = int(os.environ.get('MENULUX_MENU_ID', '0') or 0)  # 0 = tüm menüler
MENULUX_FALLBACK_IMG = "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400"

app = FastAPI()
api_router = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ═══ GÜVENLİK: Rate Limiting ═══
login_attempts: dict = defaultdict(list)  # ip -> [timestamp, ...]
MAX_LOGIN_ATTEMPTS = 10
LOGIN_WINDOW_SECONDS = 300  # 5 dakika

def check_rate_limit(ip: str):
    now = time.time()
    login_attempts[ip] = [t for t in login_attempts[ip] if now - t < LOGIN_WINDOW_SECONDS]
    if len(login_attempts[ip]) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(429, f"Çok fazla giriş denemesi. {int(LOGIN_WINDOW_SECONDS/60)} dakika sonra tekrar deneyin.")
    login_attempts[ip].append(now)

# ═══ GÜVENLİK: Input Sanitization ═══
def sanitize_input(text: str, max_length: int = 500) -> str:
    if not text: return ""
    text = text.strip()[:max_length]
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'[<>]', '', text)
    return text

def hash_password(p: str) -> str:
    return hashlib.sha256(p.encode()).hexdigest()

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "): token = auth.split(" ")[1]
    if not token: raise HTTPException(401, "Giriş yapılmamış")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session: raise HTTPException(401, "Geçersiz oturum")
    exp = session["expires_at"]
    if isinstance(exp, str): exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc): raise HTTPException(401, "Oturum süresi dolmuş")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user: raise HTTPException(401, "Kullanıcı bulunamadı")
    return user

async def get_admin_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "): raise HTTPException(401, "Giriş yapılmamış")
    token = auth.split(" ")[1]
    session = await db.admin_sessions.find_one({"$or": [{"session_token": token}, {"token": token}]}, {"_id": 0})
    if not session: raise HTTPException(401, "Geçersiz admin oturumu")
    exp = session.get("expires_at")
    if exp:
        if isinstance(exp, str): exp = datetime.fromisoformat(exp)
        if exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc): raise HTTPException(401, "Oturum süresi dolmuş")
    admin = await db.admins.find_one({"admin_id": session["admin_id"]}, {"_id": 0})
    if not admin: raise HTTPException(401, "Admin bulunamadı")
    return admin

# ═══ AUTH (Customer) ═══
@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    body = await request.json()
    sid = body.get("session_id")
    if not sid: raise HTTPException(400, "session_id gerekli")
    async with httpx.AsyncClient() as hc:
        res = await hc.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": sid})
    if res.status_code != 200: raise HTTPException(401, "Geçersiz session_id")
    data = res.json()
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": data["email"]}, {"$set": {"name": data["name"], "picture": data.get("picture", "")}})
    else:
        await db.users.insert_one({"user_id": user_id, "email": data["email"], "name": data["name"], "picture": data.get("picture", ""), "points": 100, "tier": "Bronz", "created_at": datetime.now(timezone.utc)})
    st = data.get("session_token", str(uuid.uuid4()))
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": st, "expires_at": datetime.now(timezone.utc) + timedelta(days=7), "created_at": datetime.now(timezone.utc)})
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    response.set_cookie(key="session_token", value=st, httponly=True, secure=True, samesite="none", path="/", max_age=604800)
    return {"user": user, "session_token": st}

@api_router.get("/auth/me")
async def auth_me(request: Request):
    return await get_current_user(request)

# ═══ USER: Email/Password Register & Login ═══
@api_router.post("/auth/register")
async def user_register(request: Request, response: Response):
    body = await request.json()
    name = body.get("name", "").strip()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")
    if not name or not email or not password:
        raise HTTPException(400, "Ad, email ve şifre gerekli")
    if len(password) < 6:
        raise HTTPException(400, "Şifre en az 6 karakter olmalı")
    if "@" not in email:
        raise HTTPException(400, "Geçerli bir email adresi girin")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(409, "Bu email adresi zaten kayıtlı")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id, "email": email, "name": name,
        "password_hash": hash_password(password),
        "picture": "", "points": 100, "tier": "Bronz",
        "created_at": datetime.now(timezone.utc)
    })
    st = str(uuid.uuid4())
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": st,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    response.set_cookie(key="session_token", value=st, httponly=True, secure=True, samesite="none", path="/", max_age=604800)
    return {"user": user, "session_token": st}

@api_router.post("/auth/login")
async def user_login(request: Request, response: Response):
    body = await request.json()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")
    if not email or not password:
        raise HTTPException(400, "Email ve şifre gerekli")
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(client_ip)
    # Önce normal kullanıcı tablosunda ara
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        if not user.get("password_hash"):
            raise HTTPException(401, "Bu hesap Google ile kayıt olmuş. Google ile giriş yapın.")
        if user["password_hash"] != hash_password(password):
            raise HTTPException(401, "Email veya şifre hatalı")
        st = str(uuid.uuid4())
        await db.user_sessions.delete_many({"user_id": user["user_id"]})
        await db.user_sessions.insert_one({
            "user_id": user["user_id"], "session_token": st,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        })
        safe_user = {k: v for k, v in user.items() if k != "password_hash"}
        response.set_cookie(key="session_token", value=st, httponly=True, secure=True, samesite="none", path="/", max_age=604800)
        return {"user": safe_user, "session_token": st, "role": "user"}
    # Kullanıcı bulunamadı — admin tablosunda ara
    admin = await db.admins.find_one({"email": email}, {"_id": 0})
    if admin:
        if admin.get("password_hash") != hash_password(password):
            raise HTTPException(401, "Email veya şifre hatalı")
        token = f"admin_{uuid.uuid4().hex}"
        await db.admin_sessions.insert_one({
            "admin_id": admin["admin_id"], "token": token,
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=12),
            "created_at": datetime.now(timezone.utc)
        })
        return {"admin": {"admin_id": admin["admin_id"], "name": admin["name"], "email": admin["email"], "role": admin.get("role", "admin")}, "token": token, "role": "admin"}
    raise HTTPException(401, "Email veya şifre hatalı")

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    # Cookie'den veya Authorization header'dan token al
    t = request.cookies.get("session_token")
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        header_token = auth.split(" ")[1]
        await db.user_sessions.delete_many({"session_token": header_token})
    if t:
        await db.user_sessions.delete_many({"session_token": t})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Çıkış yapıldı"}

# ═══ ADMIN AUTH ═══
@api_router.post("/admin/login")
async def admin_login(request: Request):
    body = await request.json()
    email, password = body.get("email", ""), body.get("password", "")
    if not email or not password: raise HTTPException(400, "Email ve şifre gerekli")
    admin = await db.admins.find_one({"email": email}, {"_id": 0})
    if not admin or admin["password_hash"] != hash_password(password): raise HTTPException(401, "Geçersiz giriş bilgileri")
    st = f"admin_{uuid.uuid4().hex}"
    await db.admin_sessions.delete_many({"admin_id": admin["admin_id"]})
    await db.admin_sessions.insert_one({"admin_id": admin["admin_id"], "session_token": st, "expires_at": datetime.now(timezone.utc) + timedelta(days=7), "created_at": datetime.now(timezone.utc)})
    return {"token": st, "admin": {"admin_id": admin["admin_id"], "name": admin["name"], "email": admin["email"], "role": admin["role"], "store_id": admin.get("store_id")}}

@api_router.get("/admin/me")
async def admin_me(request: Request):
    a = await get_admin_user(request)
    return {"admin_id": a["admin_id"], "name": a["name"], "email": a["email"], "role": a["role"], "store_id": a.get("store_id")}

@api_router.post("/admin/logout")
async def admin_logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "): await db.admin_sessions.delete_many({"session_token": auth.split(" ")[1]})
    return {"message": "Çıkış yapıldı"}

# ═══ ADMIN: Managers ═══
@api_router.post("/admin/managers")
async def create_manager(request: Request):
    admin = await get_admin_user(request)
    if admin["role"] != "superadmin": raise HTTPException(403, "Yetkiniz yok")
    body = await request.json()
    if await db.admins.find_one({"email": body["email"]}, {"_id": 0}): raise HTTPException(400, "Bu email zaten kayıtlı")
    mgr = {"admin_id": f"mgr_{uuid.uuid4().hex[:10]}", "name": body["name"], "email": body["email"], "password_hash": hash_password(body["password"]), "role": "manager", "store_id": body.get("store_id", ""), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.admins.insert_one(mgr)
    mgr.pop("_id", None); mgr.pop("password_hash", None)
    return mgr

@api_router.get("/admin/managers")
async def list_managers(request: Request):
    await get_admin_user(request)
    return await db.admins.find({"role": "manager"}, {"_id": 0, "password_hash": 0}).to_list(100)

@api_router.delete("/admin/managers/{mid}")
async def delete_manager(mid: str, request: Request):
    admin = await get_admin_user(request)
    if admin["role"] != "superadmin": raise HTTPException(403, "Yetkiniz yok")
    r = await db.admins.delete_one({"admin_id": mid, "role": "manager"})
    if r.deleted_count == 0: raise HTTPException(404, "Yetkili bulunamadı")
    await db.admin_sessions.delete_many({"admin_id": mid})
    return {"message": "Yetkili silindi"}

# ═══ ADMIN: Menu CRUD (FIXED - defaults for optional fields) ═══
@api_router.post("/admin/menu")
async def create_menu_item(request: Request):
    await get_admin_user(request)
    body = await request.json()
    item = {
        "item_id": f"item_{uuid.uuid4().hex[:8]}",
        "name": body.get("name", "Yeni Ürün"),
        "description": body.get("description", ""),
        "price": float(body.get("price", 0)),
        "category": body.get("category", "Genel"),
        "image_url": body.get("image_url", "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400"),
        "sizes": body.get("sizes", []),
        "popular": body.get("popular", False),
        "source": "manual",
    }
    if isinstance(item["sizes"], str):
        item["sizes"] = [s.strip() for s in item["sizes"].split(",") if s.strip()]
    await db.menu_items.insert_one(item)
    item.pop("_id", None)
    return item

@api_router.put("/admin/menu/{item_id}")
async def update_menu_item(item_id: str, request: Request):
    await get_admin_user(request)
    body = await request.json()
    update = {k: v for k, v in body.items() if k != "item_id"}
    r = await db.menu_items.update_one({"item_id": item_id}, {"$set": update})
    if r.matched_count == 0: raise HTTPException(404, "Ürün bulunamadı")
    return await db.menu_items.find_one({"item_id": item_id}, {"_id": 0})

@api_router.delete("/admin/menu/{item_id}")
async def delete_menu_item(item_id: str, request: Request):
    await get_admin_user(request)
    r = await db.menu_items.delete_one({"item_id": item_id})
    if r.deleted_count == 0: raise HTTPException(404, "Ürün bulunamadı")
    return {"message": "Ürün silindi"}

@api_router.post("/admin/menu/sync-menulux")
async def admin_sync_menulux(request: Request):
    await get_admin_user(request)
    if not (MENULUX_API_KEY and MENULUX_CUSTOMER_ID):
        raise HTTPException(400, "Menulux yapılandırılmamış (MENULUX_API_KEY / MENULUX_CUSTOMER_ID)")
    try:
        n = await sync_menulux_menu()
    except Exception as e:
        raise HTTPException(502, f"Menulux senkron hatası: {e}")
    return {"message": "Menulux senkron tamam", "count": n}

# ═══ ADMIN: Store CRUD ═══
@api_router.post("/admin/stores")
async def create_store(request: Request):
    admin = await get_admin_user(request)
    if admin["role"] != "superadmin": raise HTTPException(403, "Yetkiniz yok")
    body = await request.json()
    store = {"store_id": f"store_{uuid.uuid4().hex[:6]}", "name": body.get("name", ""), "address": body.get("address", ""), "city": body.get("city", "İstanbul"), "hours": body.get("hours", "08:00 - 22:00"), "phone": body.get("phone", ""), "lat": float(body.get("lat", 0)), "lng": float(body.get("lng", 0)), "image_url": body.get("image_url", "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400")}
    await db.stores.insert_one(store)
    store.pop("_id", None)
    return store

@api_router.put("/admin/stores/{store_id}")
async def update_store(store_id: str, request: Request):
    admin = await get_admin_user(request)
    if admin["role"] != "superadmin": raise HTTPException(403, "Yetkiniz yok")
    body = await request.json()
    r = await db.stores.update_one({"store_id": store_id}, {"$set": {k: v for k, v in body.items() if k != "store_id"}})
    if r.matched_count == 0: raise HTTPException(404, "Şube bulunamadı")
    return await db.stores.find_one({"store_id": store_id}, {"_id": 0})

@api_router.delete("/admin/stores/{store_id}")
async def delete_store(store_id: str, request: Request):
    admin = await get_admin_user(request)
    if admin["role"] != "superadmin": raise HTTPException(403, "Yetkiniz yok")
    r = await db.stores.delete_one({"store_id": store_id})
    if r.deleted_count == 0: raise HTTPException(404, "Şube bulunamadı")
    return {"message": "Şube silindi"}

# ═══ ADMIN: Campaigns ═══
@api_router.get("/admin/campaigns")
async def admin_list_campaigns(request: Request):
    await get_admin_user(request)
    return await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)

@api_router.post("/admin/campaigns")
async def create_campaign(request: Request):
    await get_admin_user(request)
    body = await request.json()
    camp = {
        "campaign_id": f"camp_{uuid.uuid4().hex[:8]}",
        "title": body.get("title", ""),
        "description": body.get("description", ""),
        "discount_type": body.get("discount_type", "percent"),
        "discount_value": float(body.get("discount_value", 10)),
        "image_url": body.get("image_url", ""),
        "active": body.get("active", True),
        "start_date": body.get("start_date", datetime.now(timezone.utc).isoformat()),
        "end_date": body.get("end_date", (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.campaigns.insert_one(camp)
    camp.pop("_id", None)
    return camp

@api_router.put("/admin/campaigns/{cid}")
async def update_campaign(cid: str, request: Request):
    await get_admin_user(request)
    body = await request.json()
    r = await db.campaigns.update_one({"campaign_id": cid}, {"$set": {k: v for k, v in body.items() if k != "campaign_id"}})
    if r.matched_count == 0: raise HTTPException(404, "Kampanya bulunamadı")
    return await db.campaigns.find_one({"campaign_id": cid}, {"_id": 0})

@api_router.delete("/admin/campaigns/{cid}")
async def delete_campaign(cid: str, request: Request):
    await get_admin_user(request)
    r = await db.campaigns.delete_one({"campaign_id": cid})
    if r.deleted_count == 0: raise HTTPException(404, "Kampanya bulunamadı")
    return {"message": "Kampanya silindi"}

# ═══ ADMIN: Spin Wheel Prizes ═══
@api_router.get("/admin/wheel-prizes")
async def admin_list_prizes(request: Request):
    await get_admin_user(request)
    return await db.wheel_prizes.find({}, {"_id": 0}).to_list(100)

@api_router.post("/admin/wheel-prizes")
async def create_wheel_prize(request: Request):
    await get_admin_user(request)
    body = await request.json()
    prize = {
        "prize_id": f"prize_{uuid.uuid4().hex[:8]}",
        "label": body.get("label", "Hediye"),
        "type": body.get("type", "points"),
        "value": body.get("value", 10),
        "color": body.get("color", "#E67E22"),
        "probability": float(body.get("probability", 10)),
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.wheel_prizes.insert_one(prize)
    prize.pop("_id", None)
    return prize

@api_router.delete("/admin/wheel-prizes/{pid}")
async def delete_wheel_prize(pid: str, request: Request):
    await get_admin_user(request)
    r = await db.wheel_prizes.delete_one({"prize_id": pid})
    if r.deleted_count == 0: raise HTTPException(404, "Ödül bulunamadı")
    return {"message": "Çark ödülü silindi"}

# ═══ CUSTOMER: Spin Wheel ═══
@api_router.get("/wheel-prizes")
async def get_wheel_prizes():
    prizes = await db.wheel_prizes.find({"active": True}, {"_id": 0}).to_list(50)
    if not prizes:
        await seed_wheel_prizes()
        prizes = await db.wheel_prizes.find({"active": True}, {"_id": 0}).to_list(50)
    return prizes

@api_router.post("/wheel/spin")
async def spin_wheel(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.wheel_spins.find_one({"user_id": user["user_id"], "date": today}, {"_id": 0})
    if existing:
        return {"already_spun": True, "prize": existing.get("prize")}
    prizes = await db.wheel_prizes.find({"active": True}, {"_id": 0}).to_list(50)
    if not prizes:
        await seed_wheel_prizes()
        prizes = await db.wheel_prizes.find({"active": True}, {"_id": 0}).to_list(50)
    weights = [p.get("probability", 10) for p in prizes]
    winner = random.choices(prizes, weights=weights, k=1)[0]
    # Apply prize
    if winner["type"] == "points":
        new_pts = user.get("points", 0) + int(winner["value"])
        tier = "Bronz"
        if new_pts >= 500: tier = "Altın"
        elif new_pts >= 200: tier = "Gümüş"
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"points": new_pts, "tier": tier}})
    await db.wheel_spins.insert_one({"user_id": user["user_id"], "date": today, "prize": {"label": winner["label"], "type": winner["type"], "value": winner["value"]}, "created_at": datetime.now(timezone.utc).isoformat()})
    await db.notifications.insert_one({"notification_id": f"notif_{uuid.uuid4().hex[:10]}", "user_id": user["user_id"], "title": "Çark Ödülü!", "body": f"Tebrikler! Çarktan '{winner['label']}' kazandınız!", "read": False, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"already_spun": False, "prize": {"label": winner["label"], "type": winner["type"], "value": winner["value"]}, "prize_index": prizes.index(winner)}

# ═══ ADMIN: Notifications ═══
@api_router.post("/admin/notifications/send")
async def send_notif_all(request: Request):
    await get_admin_user(request)
    body = await request.json()
    title, msg = body.get("title", ""), body.get("body", "")
    if not title or not msg: raise HTTPException(400, "Başlık ve mesaj gerekli")
    users = await db.users.find({}, {"_id": 0, "user_id": 1}).to_list(10000)
    notifs = [{"notification_id": f"notif_{uuid.uuid4().hex[:10]}", "user_id": u["user_id"], "title": title, "body": msg, "read": False, "created_at": datetime.now(timezone.utc).isoformat()} for u in users]
    if notifs: await db.notifications.insert_many(notifs)
    return {"message": f"{len(notifs)} kullanıcıya bildirim gönderildi"}

# ═══ ADMIN: QR / Add Points ═══
@api_router.post("/admin/add-points")
async def add_points(request: Request):
    await get_admin_user(request)
    body = await request.json()
    uid, pts = body.get("user_id", ""), int(body.get("points", 0))
    if not uid or pts <= 0: raise HTTPException(400, "Geçerli kullanıcı ID ve puan gerekli")
    user = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if not user: raise HTTPException(404, "Kullanıcı bulunamadı")
    new_pts = user.get("points", 0) + pts
    tier = "Bronz"
    if new_pts >= 500: tier = "Altın"
    elif new_pts >= 200: tier = "Gümüş"
    await db.users.update_one({"user_id": uid}, {"$set": {"points": new_pts, "tier": tier}})
    await db.notifications.insert_one({"notification_id": f"notif_{uuid.uuid4().hex[:10]}", "user_id": uid, "title": "Puan Kazandınız!", "body": f"Hesabınıza {pts} puan eklendi. Toplam: {new_pts} puan.", "read": False, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"message": f"{pts} puan eklendi", "new_points": new_pts, "tier": tier, "user_name": user["name"]}

# ═══ ADMIN: Auto Scan — Fixed points, no manual override ═══
SCAN_COOLDOWN_MINUTES = 120  # 2 saat cooldown
DEFAULT_SCAN_POINTS = 50     # Her taramada sabit 50 puan

@api_router.post("/admin/scan-checkin")
async def scan_checkin(request: Request):
    admin = await get_admin_user(request)
    body = await request.json()
    uid = body.get("user_id", "").strip()
    if not uid: raise HTTPException(400, "Kullanıcı ID gerekli")
    user = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if not user: raise HTTPException(404, "Kullanıcı bulunamadı")
    # Cooldown kontrolü
    now = datetime.now(timezone.utc)
    last_scan = await db.scan_checkins.find_one({"user_id": uid}, {"_id": 0}, sort=[("created_at", -1)])
    if last_scan:
        last_time = last_scan.get("created_at")
        if isinstance(last_time, str): last_time = datetime.fromisoformat(last_time)
        if last_time.tzinfo is None: last_time = last_time.replace(tzinfo=timezone.utc)
        diff_min = (now - last_time).total_seconds() / 60
        if diff_min < SCAN_COOLDOWN_MINUTES:
            remaining = int(SCAN_COOLDOWN_MINUTES - diff_min)
            raise HTTPException(429, f"Bu müşteri yakın zamanda tarandı. {remaining} dakika sonra tekrar deneyin.")
    # Ayarlardan puan miktarını al (yoksa default kullan)
    settings = await db.app_settings.find_one({"key": "scan_points"}, {"_id": 0})
    pts = int(settings["value"]) if settings else DEFAULT_SCAN_POINTS
    new_pts = user.get("points", 0) + pts
    tier = "Bronz"
    if new_pts >= 500: tier = "Altın"
    elif new_pts >= 200: tier = "Gümüş"
    await db.users.update_one({"user_id": uid}, {"$set": {"points": new_pts, "tier": tier}})
    await db.scan_checkins.insert_one({"user_id": uid, "admin_id": admin["admin_id"], "points_added": pts, "created_at": now.isoformat()})
    await db.notifications.insert_one({"notification_id": f"notif_{uuid.uuid4().hex[:10]}", "user_id": uid, "title": "Puan Kazandınız!", "body": f"Mağaza ziyaretiniz için {pts} puan kazandınız! Toplam: {new_pts} puan.", "read": False, "created_at": now.isoformat()})
    return {"message": f"Otomatik {pts} puan eklendi", "new_points": new_pts, "tier": tier, "user_name": user["name"], "points_added": pts}

@api_router.get("/admin/scan-settings")
async def get_scan_settings(request: Request):
    await get_admin_user(request)
    settings = await db.app_settings.find_one({"key": "scan_points"}, {"_id": 0})
    return {"scan_points": int(settings["value"]) if settings else DEFAULT_SCAN_POINTS, "cooldown_minutes": SCAN_COOLDOWN_MINUTES}

@api_router.put("/admin/scan-settings")
async def update_scan_settings(request: Request):
    admin = await get_admin_user(request)
    if admin["role"] != "superadmin": raise HTTPException(403, "Yetkiniz yok")
    body = await request.json()
    pts = int(body.get("scan_points", DEFAULT_SCAN_POINTS))
    if pts <= 0 or pts > 200: raise HTTPException(400, "Puan 1-200 arası olmalı")
    await db.app_settings.update_one({"key": "scan_points"}, {"$set": {"key": "scan_points", "value": pts}}, upsert=True)
    return {"message": f"Tarama puanı {pts} olarak güncellendi", "scan_points": pts}

# ═══ ADMIN: Orders ═══
@api_router.get("/admin/orders")
async def admin_orders(request: Request):
    await get_admin_user(request)
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

@api_router.put("/admin/orders/{oid}/status")
async def admin_update_order(oid: str, request: Request):
    await get_admin_user(request)
    body = await request.json()
    ns = body.get("status", "")
    r = await db.orders.update_one({"order_id": oid}, {"$set": {"status": ns}})
    if r.matched_count == 0: raise HTTPException(404, "Sipariş bulunamadı")
    order = await db.orders.find_one({"order_id": oid}, {"_id": 0})
    st = {"confirmed": "onaylandı", "preparing": "hazırlanıyor", "ready": "hazır", "completed": "tamamlandı", "cancelled": "iptal edildi"}.get(ns, ns)
    await db.notifications.insert_one({"notification_id": f"notif_{uuid.uuid4().hex[:10]}", "user_id": order["user_id"], "title": "Sipariş Güncellendi", "body": f"#{oid[-6:]} numaralı siparişiniz {st}.", "read": False, "created_at": datetime.now(timezone.utc).isoformat()})
    return order

# ═══ ADMIN: Users / Stats / Rewards ═══
@api_router.get("/admin/users")
async def admin_users(request: Request):
    await get_admin_user(request)
    return await db.users.find({}, {"_id": 0}).to_list(1000)

@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    await get_admin_user(request)
    tu = await db.users.count_documents({})
    to = await db.orders.count_documents({})
    tm = await db.menu_items.count_documents({})
    ts = await db.stores.count_documents({})
    tc = await db.campaigns.count_documents({})
    tmg = await db.admins.count_documents({"role": "manager"})
    orders = await db.orders.find({}, {"_id": 0, "total": 1}).to_list(10000)
    tr = sum(o.get("total", 0) for o in orders)
    return {"total_users": tu, "total_orders": to, "total_menu_items": tm, "total_stores": ts, "total_campaigns": tc, "total_managers": tmg, "total_revenue": round(tr, 2)}

@api_router.post("/admin/rewards")
async def create_reward(request: Request):
    await get_admin_user(request)
    body = await request.json()
    rwd = {"reward_id": f"rwd_{uuid.uuid4().hex[:6]}", "name": body.get("name", ""), "description": body.get("description", ""), "points_required": int(body.get("points_required", 0)), "category": body.get("category", "Genel")}
    await db.rewards.insert_one(rwd)
    rwd.pop("_id", None)
    return rwd

@api_router.delete("/admin/rewards/{rid}")
async def delete_reward(rid: str, request: Request):
    await get_admin_user(request)
    r = await db.rewards.delete_one({"reward_id": rid})
    if r.deleted_count == 0: raise HTTPException(404, "Ödül bulunamadı")
    return {"message": "Ödül silindi"}

# ═══ CUSTOMER ENDPOINTS ═══
@api_router.get("/menu")
async def get_menu():
    items = await db.menu_items.find({}, {"_id": 0}).to_list(2000)
    if not items:
        # Önce Menulux'tan çekmeyi dene; yapılandırılmamışsa demo menüye düş
        try:
            if await sync_menulux_menu() == 0:
                await seed_menu_data()
        except Exception as e:
            logger.error(f"Menulux senkron hatası, demo menüye düşülüyor: {e}")
            await seed_menu_data()
        items = await db.menu_items.find({}, {"_id": 0}).to_list(2000)
    return items

@api_router.get("/menu/{item_id}")
async def get_menu_item(item_id: str):
    item = await db.menu_items.find_one({"item_id": item_id}, {"_id": 0})
    if not item: raise HTTPException(404, "Ürün bulunamadı")
    return item

@api_router.post("/orders")
async def create_order(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    pe = int(body["total"] * 10)
    doc = {"order_id": f"ord_{uuid.uuid4().hex[:10]}", "user_id": user["user_id"], "items": body["items"], "store_id": body["store_id"], "store_name": body["store_name"], "total": body["total"], "points_earned": pe, "status": "confirmed", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.orders.insert_one(doc)
    np = user.get("points", 0) + pe
    tier = "Bronz"
    if np >= 500: tier = "Altın"
    elif np >= 200: tier = "Gümüş"
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"points": np, "tier": tier}})
    await db.notifications.insert_one({"notification_id": f"notif_{uuid.uuid4().hex[:10]}", "user_id": user["user_id"], "title": "Sipariş Onaylandı!", "body": f"#{doc['order_id'][-6:]} numaralı siparişiniz {body['store_name']} şubesinde hazırlanıyor. {pe} puan kazandınız!", "read": False, "created_at": datetime.now(timezone.utc).isoformat()})
    doc.pop("_id", None)
    return doc

@api_router.get("/orders")
async def get_orders(request: Request):
    user = await get_current_user(request)
    return await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

@api_router.get("/stores")
async def get_stores():
    stores = await db.stores.find({}, {"_id": 0}).to_list(50)
    if not stores: await seed_store_data(); stores = await db.stores.find({}, {"_id": 0}).to_list(50)
    return stores

@api_router.get("/rewards")
async def get_rewards():
    rwd = await db.rewards.find({}, {"_id": 0}).to_list(50)
    if not rwd: await seed_rewards_data(); rwd = await db.rewards.find({}, {"_id": 0}).to_list(50)
    return rwd

@api_router.post("/rewards/redeem")
async def redeem_reward(request: Request):
    body = await request.json()
    user = await get_current_user(request)
    rwd = await db.rewards.find_one({"reward_id": body.get("reward_id")}, {"_id": 0})
    if not rwd: raise HTTPException(404, "Ödül bulunamadı")
    if user.get("points", 0) < rwd["points_required"]: raise HTTPException(400, "Yeterli puanınız yok")
    np = user["points"] - rwd["points_required"]
    tier = "Bronz"
    if np >= 500: tier = "Altın"
    elif np >= 200: tier = "Gümüş"
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"points": np, "tier": tier}})
    await db.notifications.insert_one({"notification_id": f"notif_{uuid.uuid4().hex[:10]}", "user_id": user["user_id"], "title": "Ödül Kullanıldı!", "body": f"'{rwd['name']}' ödülünü {rwd['points_required']} puan karşılığında kullandınız.", "read": False, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"message": "Ödül kullanıldı", "new_points": np, "tier": tier}

@api_router.get("/notifications")
async def get_notifications(request: Request):
    user = await get_current_user(request)
    return await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

@api_router.post("/notifications/read-all")
async def mark_all_read(request: Request):
    user = await get_current_user(request)
    await db.notifications.update_many({"user_id": user["user_id"]}, {"$set": {"read": True}})
    return {"message": "Tümü okundu"}

@api_router.get("/campaigns")
async def get_active_campaigns():
    return await db.campaigns.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(50)

@api_router.get("/my-qr")
async def get_my_qr(request: Request):
    user = await get_current_user(request)
    return {"user_id": user["user_id"], "name": user["name"], "points": user["points"]}

@api_router.post("/push-token")
async def register_push_token(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    await db.push_tokens.update_one({"user_id": user["user_id"]}, {"$set": {"token": body["token"], "user_id": user["user_id"]}}, upsert=True)
    return {"message": "Token kaydedildi"}

# ═══ MENULUX: menüyü çek, eşle, senkronize et ═══
async def _menulux_get(path: str):
    url = f"{MENULUX_BASE}/{path}"
    params = {"customerID": MENULUX_CUSTOMER_ID}
    headers = {"apiKey": MENULUX_API_KEY}
    async with httpx.AsyncClient(timeout=40) as cx:
        r = await cx.get(url, params=params, headers=headers)
        r.raise_for_status()
        return r.json()

def _menulux_group_names(menus: list) -> dict:
    """MenuGroupID -> kategori adı (tüm menü ağacındaki gruplar, recursive)."""
    names: dict = {}
    def walk(groups):
        for g in groups or []:
            names[g.get("MenuGroupID")] = (g.get("Name") or g.get("Title") or "").strip()
            walk(g.get("MenuGroups"))
    for m in menus:
        walk(m.get("MenuGroups"))
    return names

def _menulux_map_products(products: list, group_names: dict) -> list:
    items = []
    for p in products:
        if p.get("Deleted") or p.get("Status") != 1:
            continue
        if MENULUX_MENU_ID and p.get("MenuID") != MENULUX_MENU_ID:
            continue
        price = p.get("Price") or 0
        name = (p.get("Name") or "").strip()
        if price <= 0 or not name:
            continue
        real_img = (p.get("ImageUrl") or "").strip()
        items.append({
            "item_id": str(p.get("ProductID")),
            "name": name,
            "description": (p.get("Description") or "").strip(),
            "price": float(price),
            "category": group_names.get(p.get("Group")) or "Diğer",
            "image_url": real_img or MENULUX_FALLBACK_IMG,
            "sizes": [],
            # Gerçek (fotoğraflanmış) görseli olan ürünleri ana ekrandaki "Popüler" carousel'inde göster
            "popular": bool(real_img),
            "source": "menulux",
        })
    return items

async def sync_menulux_menu() -> int:
    """Menulux'tan ürünleri çekip db.menu_items'ı günceller. Eklenen ürün sayısını döner."""
    if not (MENULUX_API_KEY and MENULUX_CUSTOMER_ID):
        return 0
    menus = await _menulux_get("MenuAPI/GetMenus")
    products = await _menulux_get("ProductAPI/GetProducts")
    items = _menulux_map_products(products, _menulux_group_names(menus))
    if not items:
        logger.warning("Menulux senkron: 0 ürün eşlendi, mevcut menü korunuyor")
        return 0
    # Elle eklenen ürünler (source=manual) korunur; demo seed + eski menulux temizlenir
    await db.menu_items.delete_many({"source": {"$ne": "manual"}})
    await db.menu_items.insert_many(items)
    logger.info(f"Menulux senkron tamam: {len(items)} ürün")
    return len(items)

# ═══ SEED DATA ═══
async def seed_menu_data():
    items = [
        {"item_id": "esp_001", "name": "Klasik Espresso", "description": "Zengin, yoğun tek orijinli shot.", "price": 45, "category": "Espresso", "image_url": "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400", "sizes": ["Tek", "Çift"], "popular": True},
        {"item_id": "esp_002", "name": "Americano", "description": "Sıcak su ile uzatılmış yumuşak espresso.", "price": 50, "category": "Espresso", "image_url": "https://images.unsplash.com/photo-1551030173-122aabc4489c?w=400", "sizes": ["Küçük", "Orta", "Büyük"], "popular": False},
        {"item_id": "esp_003", "name": "Macchiato", "description": "Kadifemsi köpük ile lekelenmiş espresso.", "price": 55, "category": "Espresso", "image_url": "https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=400", "sizes": ["Tek", "Çift"], "popular": False},
        {"item_id": "lat_001", "name": "Karamel Latte", "description": "İpeksi süt, espresso ve ev yapımı karamel.", "price": 70, "category": "Latte", "image_url": "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400", "sizes": ["Küçük", "Orta", "Büyük"], "popular": True},
        {"item_id": "lat_002", "name": "Vanilya Yulaf Latte", "description": "Kremsi yulaf sütü, vanilya ve çift espresso.", "price": 75, "category": "Latte", "image_url": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400", "sizes": ["Küçük", "Orta", "Büyük"], "popular": True},
        {"item_id": "lat_003", "name": "Matcha Latte", "description": "Tören kalitesi matcha ile buharlanmış süt.", "price": 72, "category": "Latte", "image_url": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=400", "sizes": ["Küçük", "Orta", "Büyük"], "popular": False},
        {"item_id": "cold_001", "name": "Soğuk Demleme", "description": "20 saat demlenmiş yumuşak soğuk kahve.", "price": 65, "category": "Soğuk İçecekler", "image_url": "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400", "sizes": ["Orta", "Büyük"], "popular": True},
        {"item_id": "cold_002", "name": "Buzlu Mocha", "description": "Çikolata, espresso ve soğuk süt buz üzerinde.", "price": 72, "category": "Soğuk İçecekler", "image_url": "https://images.unsplash.com/photo-1592663527359-cf6642f54cff?w=400", "sizes": ["Orta", "Büyük"], "popular": False},
        {"item_id": "food_001", "name": "Tereyağlı Kruvasan", "description": "Pul pul, altın rengi, her sabah taze.", "price": 55, "category": "Atıştırmalık", "image_url": "https://images.unsplash.com/photo-1555507036-ab1f4038024a?w=400", "sizes": [], "popular": True},
        {"item_id": "food_002", "name": "Yabanmersinli Muffin", "description": "Yaban mersini dolu nemli muffin.", "price": 50, "category": "Atıştırmalık", "image_url": "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400", "sizes": [], "popular": False},
        {"item_id": "food_003", "name": "Avokado Toast", "description": "Ekşi maya ekmek üzerinde ezilmiş avokado.", "price": 90, "category": "Atıştırmalık", "image_url": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400", "sizes": [], "popular": False},
    ]
    await db.menu_items.insert_many(items)

async def seed_store_data():
    stores = [
        {"store_id": "store_001", "name": "Glob Coffee — Kadıköy", "address": "Caferağa Mah. Moda Cad. No:42", "city": "İstanbul", "hours": "07:00 - 23:00", "phone": "(216) 555-0101", "lat": 40.9884, "lng": 29.0282, "image_url": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400"},
        {"store_id": "store_002", "name": "Glob Coffee — Beşiktaş", "address": "Sinanpaşa Mah. Ortabahçe Cad. No:18", "city": "İstanbul", "hours": "07:00 - 22:30", "phone": "(212) 555-0202", "lat": 41.0422, "lng": 29.0047, "image_url": "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=400"},
        {"store_id": "store_003", "name": "Glob Coffee — Nişantaşı", "address": "Teşvikiye Mah. Abdi İpekçi Cad. No:56", "city": "İstanbul", "hours": "08:00 - 22:00", "phone": "(212) 555-0303", "lat": 41.0486, "lng": 28.9953, "image_url": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400"},
        {"store_id": "store_004", "name": "Glob Coffee — Bağdat Caddesi", "address": "Suadiye Mah. Bağdat Cad. No:124", "city": "İstanbul", "hours": "07:30 - 23:00", "phone": "(216) 555-0404", "lat": 40.9631, "lng": 29.0685, "image_url": "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=400"},
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

async def seed_wheel_prizes():
    prizes = [
        {"prize_id": "prize_001", "label": "10 Puan", "type": "points", "value": 10, "color": "#E67E22", "probability": 30, "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"prize_id": "prize_002", "label": "25 Puan", "type": "points", "value": 25, "color": "#27AE60", "probability": 25, "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"prize_id": "prize_003", "label": "50 Puan", "type": "points", "value": 50, "color": "#1976D2", "probability": 15, "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"prize_id": "prize_004", "label": "Ücretsiz Kahve", "type": "free_drink", "value": 1, "color": "#D32F2F", "probability": 5, "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"prize_id": "prize_005", "label": "5 Puan", "type": "points", "value": 5, "color": "#7B1FA2", "probability": 25, "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.wheel_prizes.insert_many(prizes)

async def seed_admin():
    if not await db.admins.find_one({"email": "admin@globcoffee.com"}, {"_id": 0}):
        await db.admins.delete_many({"role": "superadmin"})
        await db.admins.insert_one({"admin_id": "admin_super_001", "name": "Süper Admin", "email": "admin@globcoffee.com", "password_hash": hash_password("admin123"), "role": "superadmin", "store_id": None, "created_at": datetime.now(timezone.utc).isoformat()})
        logger.info("Admin seeded: admin@globcoffee.com / admin123")

async def seed_campaigns():
    if await db.campaigns.count_documents({}) == 0:
        camps = [
            {"campaign_id": "camp_def_001", "title": "Hoş Geldin Kampanyası", "description": "İlk siparişine özel %20 indirim!", "discount_type": "percent", "discount_value": 20, "image_url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
            {"campaign_id": "camp_def_002", "title": "Mutlu Saatler", "description": "Her gün 14:00-17:00 arası 1 al 1 bedava!", "discount_type": "percent", "discount_value": 50, "image_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
            {"campaign_id": "camp_def_003", "title": "Hafta Sonu Keyfi", "description": "Cumartesi-Pazar tüm lattelerde ₺15 indirim", "discount_type": "fixed", "discount_value": 15, "image_url": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400", "active": True, "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        await db.campaigns.insert_many(camps)

@api_router.get("/")
async def root():
    return {"message": "Glob Coffee API"}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup():
    await seed_admin()
    await seed_campaigns()
    # Menü kaynağını Menulux'tan senkronla (best-effort; hata olsa da backend açılır)
    try:
        n = await sync_menulux_menu()
        if n:
            logger.info(f"Başlangıç Menulux senkronu: {n} ürün")
    except Exception as e:
        logger.error(f"Başlangıç Menulux senkron hatası: {e}")

@app.on_event("shutdown")
async def shutdown():
    client.close()
