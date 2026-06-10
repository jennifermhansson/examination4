# Architecture & Setup Documentation

This document explains how the system is built — every service, how they talk to each other, and the full flow from browser to database.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Docker & Services](#2-docker--services)
3. [Nginx — The Gateway](#3-nginx--the-gateway)
4. [RabbitMQ — Event Bus](#4-rabbitmq--event-bus)
5. [Database Schema](#5-database-schema)
6. [Backend Services](#6-backend-services)
7. [Frontend](#7-frontend)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Complete Order Flow (End-to-End)](#9-complete-order-flow-end-to-end)
10. [Startup Sequence](#10-startup-sequence)

---

## 1. Overview

This is a **fast-food ordering system** built as an event-driven microservices application. There are four backend services, one frontend, one database, one message broker, and one API gateway — all wired together with Docker Compose.

```
Browser
  │
  ▼
Nginx (port 80)  ←── single entry point for everything
  │
  ├──► Frontend (React SPA, static files)
  │
  ├──► product-service   (port 3002)
  ├──► order-service     (port 3003)  ◄──► RabbitMQ
  ├──► kitchen-service   (port 3004)  ◄──► RabbitMQ
  └──► notification-service (port 3005) ◄──► RabbitMQ
                                              │
                                       PostgreSQL (shared DB)
```

**Key design decisions:**
- The browser only ever talks to Nginx on port 80. It never knows what port the services are on.
- Services that need to react to things (kitchen, notifications) don't poll the database — they subscribe to RabbitMQ events.
- The frontend auto-refreshes every 5 seconds to simulate near-real-time updates.

---

## 2. Docker & Services

Everything is defined in `docker-compose.yml`. Here is every service, what it does, and its dependencies:

| Service | Image / Build | Port(s) | Depends On |
|---|---|---|---|
| `postgres` | postgres:16 | 5432 | — |
| `seed` | oven/bun:1 | — | postgres (healthy) |
| `rabbitmq` | rabbitmq:3-management-alpine | 5672, **15672** | — |
| `product-service` | ./services/product-service | 3002 (internal) | postgres (healthy), seed |
| `order-service` | ./services/order-service | 3003 (internal) | postgres, rabbitmq, product-service, seed |
| `kitchen-service` | ./services/kitchen-service | 3004 (internal) | postgres, rabbitmq, seed |
| `notification-service` | ./services/notification-service | 3005 (internal) | postgres, rabbitmq, seed |
| `frontend` | ./frontend | 80 (internal) | — |
| `nginx` | nginx:alpine | **80** (public) | all services |

> Port 15672 is the RabbitMQ management UI — open `http://localhost:15672` in a browser to inspect queues and messages (default credentials: guest/guest).

### The `seed` container

The seed container runs once and then exits. It:
1. Runs `migrate.ts` — applies the database schema from `db/01-init.sql`
2. Runs `02-seed.ts` — inserts products and the kitchen staff user

All four backend services declare `seed: condition: service_completed_successfully`, so they will not start until the seed job finishes.

### Health checks

`postgres` and `rabbitmq` both have Docker health checks. Services that depend on them use `condition: service_healthy`, which means Docker will wait until the health check passes before starting the dependent service. This prevents the classic "service starts before DB is ready" crash.

---

## 3. Nginx — The Gateway

**Config file:** `nginx/nginx.conf`

Nginx is the only container that exposes a port to the outside world (port 80). Every request from the browser hits Nginx first. Nginx then decides where to forward it based on the URL path.

### URL routing table

| Browser URL | Forwarded to | Rewritten path |
|---|---|---|
| `GET /api/health` | Nginx itself | (returns `{"status":"ok"}`) |
| `GET /api/products` | product-service:3002 | `/products` |
| `POST /api/auth/login` | order-service:3003 | `/auth/login` |
| `POST /api/auth/register` | order-service:3003 | `/auth/register` |
| `POST /api/orders` | order-service:3003 | `/orders` |
| `GET /api/orders` | order-service:3003 | `/orders` |
| `GET /api/kitchen/orders` | kitchen-service:3004 | `/kitchen/orders` |
| `PATCH /api/kitchen/orders/:id` | kitchen-service:3004 | `/kitchen/orders/:id` |
| `GET /api/notifications` | notification-service:3005 | `/notifications` |
| `GET /` (anything else) | frontend:80 | passthrough (SPA) |

### What the `rewrite` directive does

Nginx strips the `/api` prefix before forwarding. For example:

```
Browser:           GET /api/products
Nginx rewrites to: GET /products
Forwards to:       http://product-service:3002/products
```

The backend services never see `/api/` in the path — they just receive `/products`, `/orders`, etc.

### Why this pattern matters

- The frontend can call `/api/products` without knowing which host or port runs the product service.
- You can move a service to a different port or host by only changing the nginx config.
- All CORS issues are avoided because everything comes from the same origin (port 80).

---

## 4. RabbitMQ — Event Bus

**Shared config:** `shared/src/events.ts` and `shared/src/rabbitmq.ts`

RabbitMQ is the backbone of the async communication between services. Instead of services calling each other directly over HTTP (tight coupling), they publish events and subscribe to events they care about.

### Core concepts

| Term | What it means here |
|---|---|
| **Exchange** | `exam4.events` — a single topic exchange all events go through |
| **Routing key** | A label on each event, e.g. `order.created` or `order.status.updated` |
| **Queue** | Each service has its own named queue (e.g. `kitchen.order.created`) |
| **Binding** | A queue registers which routing keys it wants to receive |

### The two event types

```
order.created
  Published by: order-service
  Consumed by:  kitchen-service, notification-service
  Payload:      { orderId, customerId, items[], totalPrice }

order.status.updated
  Published by: kitchen-service
  Consumed by:  order-service, notification-service
  Payload:      { orderId, customerId, status }
```

### Event flow diagram

```
order-service
  │  publishes "order.created"
  ▼
RabbitMQ exchange (exam4.events)
  ├──► queue: kitchen.order.created    ──► kitchen-service
  └──► queue: notification.order.created ──► notification-service

kitchen-service
  │  publishes "order.status.updated"
  ▼
RabbitMQ exchange (exam4.events)
  ├──► queue: order.order.status.updated     ──► order-service
  └──► queue: notification.order.status.updated ──► notification-service
```

### Why durable queues?

Queues are created with `durable: true` and messages are sent with `persistent: true`. This means if RabbitMQ restarts, the queued messages are not lost — they are written to disk and delivered when the consumer reconnects.

### Connection retry logic

`shared/src/rabbitmq.ts` retries connecting to RabbitMQ up to 15 times with 2-second delays. This handles the race condition where a service starts before RabbitMQ is fully ready, even with health checks.

---

## 5. Database Schema

**File:** `db/01-init.sql`

All services share one PostgreSQL database (`exam4`). Each service only reads/writes its own tables.

```
customers
  id (UUID, PK)
  username, email, phone, birthdate
  role          ← 'customer' or 'kitchen'
  password_hash
  created_at, updated_at

products
  id (UUID, PK)
  name, description
  price         ← stored in öre (integer), e.g. 7900 = 79 kr
  created_at

orders                          ← owned by order-service
  id (UUID, PK)
  customer_id   → customers.id
  status        ← 'pending' | 'preparing' | 'ready' | 'completed'
  total_price
  created_at

order_items                     ← owned by order-service
  id (UUID, PK)
  order_id      → orders.id (CASCADE DELETE)
  product_id    → products.id
  quantity
  unit_price    ← price at time of order (not live product price)
  created_at

kitchen_orders                  ← owned by kitchen-service (read model)
  id (UUID, PK)  ← same UUID as orders.id
  customer_id
  status
  total_price
  items         ← JSONB array (snapshot of order items)
  created_at, updated_at

notifications                   ← owned by notification-service
  id (UUID, PK)
  customer_id
  order_id
  message
  read          ← boolean
  created_at
```

### Why `kitchen_orders` duplicates data

`kitchen_orders` is a **read model** (also called a projection). When `order.created` is received, the kitchen service stores a denormalized snapshot including the items as JSONB. This means:

- Kitchen queries are fast and self-contained — no joins to `order_items`.
- Kitchen service does not depend on order-service being available to read its data.
- If `orders` and `kitchen_orders` drift out of sync, that is expected — they are eventually consistent via events.

### Seeded data

The seed script inserts:
- **Products:** Cheeseburgare (79 kr), Hamburgare (89 kr), Pommes (29 kr), Cola (19 kr), Milkshake (39 kr)
- **Kitchen user:** `kitchen@restaurant.se` / `kitchen123` (role: `kitchen`)

---

## 6. Backend Services

All four services are built with **Fastify** and run on the **Bun** runtime. They share a common structure.

### product-service (port 3002)

The simplest service — read-only access to the products table. No auth required.

```
GET  /products       → list all products
GET  /products/:id   → get one product
GET  /health         → health check
```

No RabbitMQ connection. No auth. Used by order-service over HTTP to validate and price items.

---

### order-service (port 3003)

Handles authentication and order creation. It is both a publisher and a subscriber.

**HTTP endpoints:**
```
POST /auth/register   → create customer account (bcrypt password)
POST /auth/login      → return JWT token
POST /orders          → create order (JWT required, customer role)
GET  /orders          → list customer's own orders (JWT required)
GET  /orders/:id      → get one order (JWT required)
```

**When creating an order:**
1. Validates that all `productId`s exist by calling `product-service` over HTTP
2. Uses the live price from product-service (not what the client sent)
3. Writes to `orders` and `order_items` tables
4. Publishes `order.created` event to RabbitMQ

**Event subscription:**
- Listens for `order.status.updated` events
- Updates the `status` column in the `orders` table

---

### kitchen-service (port 3004)

The interface for kitchen staff. Requires JWT with `role: kitchen`.

**HTTP endpoints:**
```
GET   /kitchen/orders       → list active orders (JWT + kitchen role)
PATCH /kitchen/orders/:id   → update order status (JWT + kitchen role)
```

**Valid status transitions:**
```
pending → preparing → ready → completed
```

Any other transition is rejected with a 400 error (enforced in `kitchen-logic.ts`).

**Event subscription:**
- Listens for `order.created` → inserts into `kitchen_orders`

**Event publishing:**
- On `PATCH` → publishes `order.status.updated`

---

### notification-service (port 3005)

Purely event-driven on the write side. Customers read their notifications over HTTP.

**HTTP endpoints:**
```
GET /notifications   → list customer's notifications (JWT required)
```

**Event subscriptions:**
- `order.created` → creates notification: *"Din order har mottagits och väntar på att tillagas."*
- `order.status.updated` → creates notification based on new status:
  - `preparing` → *"Din order tillagas nu i köket!"*
  - `ready` → *"Din order är klar! Hämta den vid disken."*
  - `completed` → *"Tack för din order! Vi ses snart igen."*

---

## 7. Frontend

**Tech:** React 18 + TypeScript, built with Vite, served by Nginx.

The frontend is compiled to static files (`index.html` + JS/CSS bundles) during the Docker build. The frontend container is just an Nginx serving those static files. Nginx is configured with `try_files $uri /index.html` so that React's client-side routing works when you refresh the page.

### Two views

**Customer view** — what a logged-in customer sees:
- **Menu tab:** Browse products, add to cart, place order
- **Orders tab:** See all their orders and current statuses
- **Notifications tab:** See status update messages

**Kitchen view** — what kitchen staff see after logging in with `kitchen@restaurant.se`:
- Grid of active orders with items and totals
- Buttons to move orders through the status pipeline

Both views auto-refresh every 5 seconds by polling their respective API endpoints.

### Token storage

Tokens are stored in `localStorage`:
- `bh_customer_token` — the customer's JWT
- `bh_kitchen_token` — the kitchen staff JWT

### API calls

All HTTP calls go through `src/api.ts`:
```
apiCall(method, path, body?, token?)
```
This adds `Authorization: Bearer <token>` when a token is provided and sends everything as JSON to `/api/...`.

---

## 8. Authentication & Authorization

**Implementation:** `@fastify/jwt` plugin, registered in each service that needs auth.

### JWT payload

```json
{ "id": "uuid", "email": "user@example.com", "role": "customer" }
```

### Middleware layers

1. `authenticate()` — verifies the JWT signature and expiry, attaches `request.user`
2. `requireCustomer()` — checks `request.user.role === 'customer'`
3. `requireKitchen()` — checks `request.user.role === 'kitchen'`

Routes that need auth apply these as Fastify preHandler hooks.

### Public endpoints (no token needed)

- `GET /api/health`
- `GET /api/products`
- `POST /api/auth/register`
- `POST /api/auth/login`

---

## 9. Complete Order Flow (End-to-End)

This is what happens from the moment a customer clicks "Place Order" to when they see "Order ready".

```
Step 1 — Customer places order
  Browser  POST /api/orders  { items: [...] }
    │
    ▼
  Nginx  rewrites to /orders, forwards to order-service:3003
    │
    ▼
  order-service
    ├─ validates JWT (is this a real customer?)
    ├─ calls product-service GET /products/:id for each item
    │     └─ verifies products exist, fetches live prices
    ├─ writes to `orders` table (status: pending)
    ├─ writes to `order_items` table
    └─ publishes "order.created" to RabbitMQ
          │
          ├──────────────────────────────────────────┐
          ▼                                          ▼
  kitchen-service                       notification-service
    receives "order.created"              receives "order.created"
    inserts into kitchen_orders            inserts notification:
    (status: pending)                      "Din order har mottagits..."


Step 2 — Kitchen picks up the order
  Kitchen staff browser  GET /api/kitchen/orders
    → nginx → kitchen-service:3004
    → returns list including the new order (status: pending)


Step 3 — Kitchen starts preparing
  Kitchen staff browser  PATCH /api/kitchen/orders/:id  { status: "preparing" }
    │
    ▼
  kitchen-service
    ├─ validates status transition (pending → preparing is valid)
    ├─ updates kitchen_orders status to "preparing"
    └─ publishes "order.status.updated" { status: "preparing" } to RabbitMQ
          │
          ├──────────────────────────────────────────┐
          ▼                                          ▼
  order-service                         notification-service
    receives "order.status.updated"       receives "order.status.updated"
    updates orders.status = "preparing"   inserts notification:
                                          "Din order tillagas nu i köket!"


Step 4 — Customer sees notification
  Customer browser auto-refreshes every 5 seconds
    GET /api/notifications
    → nginx → notification-service:3005
    → returns notification "Din order tillagas nu i köket!"


Step 5 — Kitchen marks order ready (same pattern as step 3)
  PATCH → kitchen-service → "order.status.updated" { status: "ready" }
    → order-service updates orders table
    → notification-service creates "Din order är klar!" notification


Step 6 — Kitchen completes order
  Same flow, final status: "completed"
    → notification-service creates "Tack för din order!" notification
```

### Service dependency map (runtime)

```
         HTTP
order-service ──────────────► product-service
     │
     │  RabbitMQ events
     ├──────────────────────► kitchen-service
     │                              │
     │  ◄────────────────────────── │  (order.status.updated)
     │
     └──────────────────────► notification-service
     (order-service also publishes to notification-service indirectly
      — notification-service subscribes to BOTH event types)
```

---

## 10. Startup Sequence

When you run `docker compose up --build`, this is the order things happen:

```
1. postgres starts
   └─ health check: pg_isready -U postgres -d exam4
   └─ waits until healthy

2. rabbitmq starts
   └─ health check: rabbitmq-diagnostics ping
   └─ waits until healthy

3. seed runs (depends on postgres healthy)
   └─ runs migrate.ts → applies 01-init.sql schema
   └─ runs 02-seed.ts → inserts products + kitchen user
   └─ exits with code 0 (run once, then done)

4. product-service starts (depends on postgres healthy + seed done)
5. order-service starts (depends on postgres, rabbitmq, product-service, seed)
6. kitchen-service starts (depends on postgres, rabbitmq, seed)
7. notification-service starts (depends on postgres, rabbitmq, seed)
8. frontend starts (no dependencies)

9. nginx starts (depends on all services above)
   └─ now listening on http://localhost:80
```

### Useful commands

```bash
# Start everything
docker compose up --build

# View logs for a specific service
docker compose logs -f order-service

# Open RabbitMQ management UI
# http://localhost:15672  (guest / guest)

# Run unit tests
bun test tests/unit

# Run end-to-end tests (requires running stack)
bun test tests/e2e
```

---

## Environment Variables Reference

| Variable | Services | Value in dev |
|---|---|---|
| `DATABASE_URL` | all backends | `postgres://postgres:postgres@postgres:5432/exam4` |
| `PORT` | all backends | 3002 – 3005 |
| `RABBITMQ_URL` | order, kitchen, notification | `amqp://rabbitmq:5672` |
| `PRODUCT_SERVICE_URL` | order-service | `http://product-service:3002` |
| `JWT_SECRET_KEY` | order, kitchen, notification | `exam4-dev-secret` |
