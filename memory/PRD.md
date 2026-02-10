# Kinetic Roast - Coffee Company App PRD

## Overview
A premium coffee company mobile app built with Expo React Native and FastAPI, featuring menu browsing, ordering, loyalty rewards, store locator, and push notifications.

## Tech Stack
- **Frontend**: Expo SDK 54, React Native, expo-router (file-based routing)
- **Backend**: FastAPI (Python), MongoDB (motor async driver)
- **Auth**: Emergent Google OAuth

## Features
### Core
- **Welcome Screen**: Branded landing with Google Auth login + guest browse
- **Home**: Greeting, loyalty points card, quick actions, popular picks, promo banner
- **Menu**: Category-filtered browsing (Espresso, Lattes, Cold Drinks, Pastries), item detail with size/quantity selection
- **Cart & Ordering**: Add to cart, select pickup store, place order with points earned
- **Rewards**: Tier system (Bronze/Silver/Gold), earn 10pts/$1, redeem for free items
- **Store Locator**: 4 locations with directions & call actions
- **Profile**: User info, order history, quick links
- **Notifications**: In-app notification feed with read/unread states

### Auth
- Emergent Google OAuth with session management
- Guest browsing supported (auth required only for orders/rewards)
- Session token stored in AsyncStorage

## API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/menu | No | All menu items |
| GET | /api/menu/:id | No | Single item |
| GET | /api/stores | No | All store locations |
| GET | /api/rewards | No | Available rewards |
| POST | /api/auth/session | No | Exchange session_id |
| GET | /api/auth/me | Yes | Current user |
| POST | /api/auth/logout | Yes | Logout |
| POST | /api/orders | Yes | Place order |
| GET | /api/orders | Yes | User order history |
| POST | /api/rewards/redeem | Yes | Redeem reward |
| GET | /api/notifications | Yes | User notifications |
| POST | /api/push-token | Yes | Register push token |

## Database Collections
- users, user_sessions, menu_items, orders, stores, rewards, notifications, push_tokens

## Business Enhancement
- **Subscription Model**: Offer a "Kinetic Pass" monthly subscription ($14.99/mo) with unlimited free medium drinks, 2x point earning, and early access to seasonal specials — driving recurring revenue and customer retention.
