# TraemeLoo — Complete Project Handoff
*Last updated: June 2026*

---

## 🌐 Live URLs

| Service | URL |
|---------|-----|
| **Customer App** | https://traemeloo.netlify.app/traemeloo-cliente.html |
| **Seller Portal** | https://traemeloo.netlify.app/traemeloo-vendedor.html |
| **Driver App** | https://traemeloo.netlify.app/traemeloo-motorista.html |
| **Admin Panel** | https://traemeloo.netlify.app/traemeloo-admin.html |
| **Login / Register** | https://traemeloo.netlify.app/traemeloo-auth.html |
| **Backend API** | https://traemeloo-production.up.railway.app |
| **API Health Check** | https://traemeloo-production.up.railway.app/health |

---

## 🔑 Test Accounts

| Role | Phone | Password |
|------|-------|----------|
| Admin | 8095550001 | admin123 |
| Vendedor | 8095550002 | seller123 |
| Motorista | 8095550003 | driver123 |
| Cliente | 8095550004 | customer123 |

---

## 🏗️ Architecture

```
GitHub Repo: github.com/TraemeLoo/traemeloo
│
├── frontend/          ← HTML files → deployed on Netlify
│   ├── traemeloo-auth.html
│   ├── traemeloo-cliente.html
│   ├── traemeloo-vendedor.html
│   ├── traemeloo-motorista.html
│   ├── traemeloo-admin.html
│   └── index.html
│
└── backend/           ← Node.js API → deployed on Railway
    ├── src/
    │   ├── index.js           (main server)
    │   ├── config/
    │   │   ├── database.js    (Prisma client)
    │   │   └── socket.js      (Socket.IO real-time)
    │   ├── middleware/
    │   │   ├── auth.js        (JWT authentication)
    │   │   └── errorHandler.js
    │   └── routes/
    │       ├── auth.js        (login/register all roles)
    │       ├── orders.js      (full order lifecycle)
    │       ├── shops.js       (shop listings)
    │       ├── products.js    (product management)
    │       ├── sellers.js     (seller dashboard)
    │       ├── drivers.js     (driver status/earnings)
    │       ├── admin.js       (platform control)
    │       ├── payments.js    (Stripe integration)
    │       ├── notifications.js
    │       ├── customers.js
    │       └── zones.js
    └── prisma/
        ├── schema.prisma      (20 database tables)
        └── seed.js            (test data)
```

---

## ☁️ Services & Credentials

### Netlify (Frontend Hosting)
- Site: traemeloo.netlify.app
- Auto-deploys from GitHub main branch
- No config needed — HTML files in repo root

### Railway (Backend Hosting)
- Project: zucchini-passion
- Auto-deploys from GitHub backend/ folder
- Root directory set to: /backend

### Supabase (Database)
- Project: traemeloo
- Region: US West 2
- Connection via Session Pooler

### Stripe (Payments)
- Test mode active
- Keys stored in Railway environment variables
- Test card: 4242 4242 4242 4242 / 12/34 / 123

---

## 🔧 Environment Variables (Railway)

```
DATABASE_URL=postgresql://postgres.hutlpfwayfitcfcqlqzb:[PASSWORD]@aws-1-us-west-2.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres.hutlpfwayfitcfcqlqzb:[PASSWORD]@aws-1-us-west-2.pooler.supabase.com:5432/postgres
JWT_SECRET=traemeloo_secret_2026
JWT_REFRESH_SECRET=traemeloo_refresh_2026
NODE_ENV=production
PORT=3000
STRIPE_SECRET_KEY=sk_test_51TFpTs...
STRIPE_PUBLISHABLE_KEY=pk_test_51TFpTs...
```

---

## ✅ What's Built & Working

### Customer App
- [x] Browse real shops from database
- [x] View products per shop
- [x] Add to cart (persists in localStorage)
- [x] Cash on delivery checkout
- [x] Stripe card payment checkout
- [x] Order created in database
- [x] Auth guard (redirects to login if not logged in)
- [x] Shows logged in user name

### Seller Portal
- [x] Auth guard (SELLER role only)
- [x] Real dashboard stats (revenue, orders, pending, rating)
- [x] Live orders list from database
- [x] Accept order → Preparing → Ready flow
- [x] Reject orders
- [x] Real product list with toggle on/off
- [x] Add new products (saves to DB)
- [x] Working left menu navigation (Dashboard, Pedidos, Productos)
- [x] Auto-refreshes every 30 seconds

### Driver App
- [x] Auth guard (DRIVER role only)
- [x] Real earnings stats from database
- [x] Online/offline toggle (updates API)
- [x] Available orders (READY status)
- [x] Accept order flow
- [x] Step-by-step delivery: Assigned → Picked Up → En Route → Delivered
- [x] Navigate button (opens Google Maps)
- [x] Call button (opens phone dialer)
- [x] Auto-refreshes every 20 seconds

### Admin Panel
- [x] Auth guard (ADMIN role only)
- [x] Static UI (not yet connected to real API)

### Auth System
- [x] Register customer (instant access)
- [x] Register seller (pending review)
- [x] Register driver (pending review)
- [x] Login for all 4 roles
- [x] JWT tokens (access + refresh)
- [x] Role-based redirects after login
- [x] Role-based page protection

### Backend API
- [x] 14 route files covering all platform features
- [x] 20 database tables (Prisma schema)
- [x] JWT authentication middleware
- [x] Socket.IO real-time setup
- [x] Stripe payment intents
- [x] Rate limiting & security headers
- [x] Seeded test data

---

## ⬜ What's Next (In Order)

### Step 3 — Customer Order Tracking (next)
Customer should be able to see their order status update in real time.
- Add "Mis Pedidos" section to customer app
- Show order status (Pending → Preparing → En Route → Delivered)
- Real-time updates via polling or Socket.IO

### Step 4 — New Order Alert for Seller
- Play a sound when a new order arrives
- Flash notification badge
- Currently seller only refreshes every 30 seconds

### Step 5 — Address Input at Checkout
- Customer types delivery address when checking out
- Currently uses hardcoded default address

### Step 6 — Connect Admin Panel to Real API
- Real KPI stats
- Approve/suspend sellers live
- Assign drivers to orders
- Live order map

### Step 7 — WhatsApp Notifications (Twilio)
- Customer gets WhatsApp when order is accepted
- Customer gets WhatsApp when driver is on the way
- Seller gets WhatsApp for new orders (backup to portal)

### Step 8 — Custom Domain
- Buy traemeloo.com or traemeloo.do
- Point to Netlify (frontend)
- Point api.traemeloo.com to Railway (backend)
- Update CORS and API URLs in all HTML files

### Step 9 — Switch Stripe to Live Mode
- Go to dashboard.stripe.com
- Switch from test to live keys
- Update STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in Railway

### Step 10 — Mobile Apps
- Convert HTML to React Native or use Capacitor
- iOS App Store + Google Play

---

## 🚀 How to Run Locally

```bash
# Clone repo
git clone https://github.com/TraemeLoo/traemeloo.git

# Install backend
cd traemeloo/backend
npm install

# Set up .env (copy from .env.example and fill in values)
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Seed test data
npm run db:seed

# Start backend
npm run dev
# Backend runs at http://localhost:3000

# Frontend: just open HTML files in browser
# Or serve with: npx serve . (from repo root)
```

---

## 📋 API Quick Reference

```
POST /api/auth/login               Login any role
POST /api/auth/register/customer   New customer
POST /api/auth/register/seller     New seller (pending)
POST /api/auth/register/driver     New driver (pending)
GET  /api/auth/me                  Current user

GET  /api/shops                    List active shops
GET  /api/shops/:id                Shop + products
GET  /api/shops/my/dashboard       Seller stats

POST /api/orders                   Create order
GET  /api/orders                   List orders (role-based)
PATCH /api/orders/:id/status       Update order status

POST /api/payments/create-intent   Stripe payment intent
POST /api/payments/confirm         Confirm payment
GET  /api/payments/publishable-key Frontend Stripe key

PATCH /api/drivers/status          Driver online/offline
PATCH /api/drivers/location        Driver GPS update
GET  /api/drivers/earnings         Driver earnings

GET  /api/admin/dashboard          Platform KPIs
PATCH /api/admin/sellers/:id/approve  Approve shop
```

---

*TraemeLoo © 2026 — República Dominicana*
*Built with: Node.js + Express + PostgreSQL + Prisma + Stripe + Socket.IO + Netlify + Railway*
