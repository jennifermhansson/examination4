# Examination 4 – Fast-food ordering system

A distributed, event-driven ordering system inspired by fast-food chains. A customer orders
through a React frontend; the order flows over RabbitMQ to the kitchen, and status
notifications flow back to the customer.

## Live deployment

A deployed version runs on my own server at **https://exam4.jenniferh.dev** – the same Docker
Compose stack behind nginx as a reverse proxy, with HTTPS via a Let's Encrypt certificate
(managed by certbot).

## Run locally

```bash
docker compose up --build
```

Then open `http://localhost`. Startup is fully automated: PostgreSQL runs the DDL
([db/01-init.sql](db/01-init.sql)) and a `seed` service migrates and seeds products before the
services start. No configuration is required — the compose file falls back to local defaults, so
the stack boots out of the box. To override the database credentials, `cp .env.example .env` and
edit it first.

**Public entry point:** nginx is the only service exposed externally (port **80** locally).
Every other service runs on the internal Docker network and is not reachable from outside.

The deployed server adds HTTPS on **443** via the production overlay
([docker-compose.prod.yml](docker-compose.prod.yml), TLS config + certbot):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Architecture

```
Browser
   │
   ▼
Nginx (80/443, public)
   ├── /api/v1/products      → product-service        (3002, internal)
   ├── /api/v1/orders        → order-service          (3003, internal)
   ├── /api/v1/kitchen       → kitchen-service        (3004, internal)
   ├── /api/v1/notifications → notification-service   (3005, internal)
   └── /                     → frontend               (internal)

order-service ── RabbitMQ ──► kitchen-service ──► notification-service

All services share PostgreSQL (5432, internal).
```

- **Frontend** – React + Vite, served by nginx inside Docker.
- **Nginx** – single public entry point; routes the versioned `/api/v1/*` paths to each service.
- **Services** – four Fastify services in TypeScript, running on Bun.
- **RabbitMQ** – topic exchange (`exam4.events`) for asynchronous communication.
- **PostgreSQL** – shared database, initialised with DDL + seed on startup.

There are **no synchronous calls between services**: order-service prices orders from a local
product cache kept in sync via `product.*` events, so placing an order has no runtime dependency
on another service. See [docs/architecture.md](docs/architecture.md) for the full diagrams.

## Services

| Service | Responsibility |
|---|---|
| `product-service` | Serves the product catalogue/menu from the database |
| `order-service` | Creates customers (name + email) and manages orders |
| `kitchen-service` | Receives orders via RabbitMQ; kitchen view and status updates |
| `notification-service` | Listens for events and creates customer notifications |

## Events

Services communicate through the `exam4.events` topic exchange.

**`order.created`** — published by `order-service`, consumed by `kitchen-service` and
`notification-service` (kitchen sees the order; customer is notified it was received).

```json
{
  "type": "order.created",
  "orderId": "uuid",
  "customerId": "uuid",
  "items": [{ "productId": "uuid", "name": "Cheeseburger", "quantity": 1, "unitPrice": 7900 }],
  "totalPrice": 7900
}
```

**`order.status.updated`** — published by `kitchen-service`, consumed by `order-service` (syncs
the order's status) and `notification-service` (sends a status notification).

```json
{ "type": "order.status.updated", "orderId": "uuid", "customerId": "uuid", "status": "preparing" }
```

Three more events keep order-service's product cache in sync: `product.upserted` and
`product.deleted` (published by `product-service`) and `product.sync.requested` (published by
`order-service` on startup to request a full rebroadcast).

## Order flow

1. Customer submits name + email + items → `order-service` finds/creates the customer by email,
   prices the order server-side from its product cache, stores it in PostgreSQL, and publishes
   `order.created`.
2. `kitchen-service` consumes the event → the order appears in the kitchen as `pending`.
3. Kitchen advances the status (`pending` → `preparing` → `ready` → `completed`) → publishes
   `order.status.updated` on each step (invalid transitions are rejected).
4. `order-service` syncs the status in PostgreSQL; `notification-service` creates a notification
   per step.
5. The customer sees their orders and notifications via their `customerId` (stored in the browser
   after the first order). There is no login.

## API endpoints

Base URL: `http://localhost` (or `https://exam4.jenniferh.dev`). A customer is identified by the
`customerId` returned on their first order.

| Endpoint | Description |
|---|---|
| `GET /api/health` | Health check (answered directly by nginx) |
| `GET /api/v1/products` | List all products |
| `GET /api/v1/products/:id` | Get one product |
| `POST /api/v1/orders` | Create an order (body: `{ name, email, items }`) |
| `GET /api/v1/orders?customerId=` | List a customer's orders |
| `GET /api/v1/orders/:id?customerId=` | Get one order (must belong to the customer) |
| `GET /api/v1/kitchen/orders` | List active kitchen orders |
| `PATCH /api/v1/kitchen/orders/:id` | Update an order's status |
| `GET /api/v1/notifications?customerId=` | List a customer's notifications |

## Tests

```bash
bun run test:unit                          # pure logic + schema contracts (no stack needed)
docker compose up -d --build               # start the stack for the tests below
bun run test:integration                   # HTTP contracts + DB via nginx
bun run test:e2e                           # full flow client → completion (incl. RabbitMQ)
bun run test                               # all of the above
```

Tests run automatically on every push via GitHub Actions
([.github/workflows/ci.yml](.github/workflows/ci.yml)). For the test strategy, definition of
done, test policy and a note on critical AI usage, see [docs/TESTING.md](docs/TESTING.md).
