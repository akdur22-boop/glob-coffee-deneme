# Glob Coffee - Product Requirements Document

## Overview
Turkish-language mobile application for "Glob Coffee" company with a customer-facing app and admin dashboard.

## Tech Stack
- **Frontend**: Expo SDK 54, React Native, Expo Router, TypeScript
- **Backend**: Python FastAPI, Motor (async MongoDB driver)
- **Database**: MongoDB

## Customer App Features
- ✅ Welcome screen with Google OAuth & guest browsing
- ✅ Home screen with Instagram-style Stories (campaigns)
- ✅ Daily Spin the Wheel for rewards
- ✅ Coffee menu with categories and item details
- ✅ Shopping cart and ordering system
- ✅ Rewards/loyalty program with tier system (Bronz/Gümüş/Altın)
- ✅ Store locator with directions and phone
- ✅ Notifications system
- ✅ User profile with order history
- ✅ Full Turkish localization

## Admin Dashboard Features
- ✅ Separate admin login (admin@globcoffee.com / admin123)
- ✅ Dashboard with statistics (users, orders, revenue, etc.)
- ✅ Menu management (CRUD)
- ✅ Campaign management (CRUD)
- ✅ Store/branch management (CRUD)
- ✅ Manager account creation (CRUD with role-based access)
- ✅ Spin wheel prize management (CRUD)
- ✅ Reward management (CRUD)
- ✅ QR code scanning for adding loyalty points
- ✅ Push notification sending to all users
- ✅ Order management with status updates
- ✅ Customer listing

## API Endpoints
All endpoints prefixed with `/api`

### Public
- GET /api/menu, /api/stores, /api/campaigns, /api/wheel-prizes, /api/rewards

### Customer (auth required)
- POST /api/orders, /api/rewards/redeem, /api/wheel/spin
- GET /api/orders, /api/notifications, /api/my-qr

### Admin (admin auth required)
- Full CRUD for menu, campaigns, stores, managers, wheel-prizes, rewards
- POST /api/admin/notifications/send, /api/admin/add-points
- GET /api/admin/stats, /api/admin/users, /api/admin/orders

## Branding
- App Name: Glob Coffee
- Primary Color: #E67E22 (Orange)
- Dark: #231F20
- Background: #F9F5F1
