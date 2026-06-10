# Claude Instructions - Examination 4

## Overview

This document is the master implementation plan for the entire project.

Project goal:

Build a distributed fast-food ordering system using:

- Bun
- Fastify
- PostgreSQL
- RabbitMQ
- Docker Compose
- Nginx
- React
- TypeScript

The system must satisfy both G and VG requirements.

---

# Agent Working Rules

These rules must always be followed.

## Scope Control

Only build the exact step I ask you to build.

Do not continue to the next phase unless I explicitly tell you to.

Do not implement future phases early.

Do not add extra features that are not required by the current phase.

Do not add additional services.

Do not introduce alternative architectures.

Do not silently refactor working code.

Always explain architectural decisions.

---

## Simplicity Rules

Before implementing any feature:

1. Prefer the simplest solution that satisfies the requirement.
2. Avoid unnecessary abstractions.
3. Avoid over-engineering.
4. Avoid design patterns unless they provide clear value.
5. Every decision must be understandable by a Fullstack student during an examination presentation.
6. Keep code readable and explicit.

Do NOT introduce:

- CQRS
- Event Sourcing
- DDD
- Service Mesh
- Kubernetes
- Redis (unless explicitly requested later)
- OAuth
- Auth0
- Supabase Auth
- Refresh Tokens
- Third-party identity providers

---

## After Every Step

When a phase is completed:

Provide:

### Summary

- What was created
- What was modified

### Files

List all created and modified files.

### Testing

Explain exactly how I can test the implementation.

### Next Step

Suggest the next phase but do NOT start implementing it.

Then stop and wait for my instruction.

---

# Phase 1 - Project Foundation

## Goal

Create the basic project structure.

## Deliverables

- Docker Compose
- Shared folder
- Services folder
- Frontend folder
- README
- Environment variable setup

## Structure

```text
project-root
│
├── docker-compose.yml
├── .env
├── README.md
│
├── shared
│
├── services
│   ├── product-service
│   ├── order-service
│   ├── kitchen-service
│   └── notification-service
│
└── frontend
```

## Stop Condition

Stop when the project structure exists and Docker Compose is configured.

---

# Phase 2 - Database Foundation

## Goal

Create PostgreSQL setup and database schema.

## Deliverables

### Database

Tables:

customers

products

orders

order_items

kitchen_orders

notifications

### Seed Data

Products:

- Cheeseburger
- Hamburger
- Fries
- Cola
- Milkshake

Users:

customer@test.se

kitchen@restaurant.se

## Requirements

- UUID primary keys
- Foreign keys
- Seed script
- Migration script

## Testing

Verify tables exist and seed data is inserted.

## Stop Condition

Database starts successfully and seed data exists.

---

# Phase 3 - Product Service

## Goal

Create a product microservice.

## Responsibilities

- Read products
- Read single product

## Endpoints

GET /products

GET /products/:id

GET /health

## Requirements

- Fastify
- PostgreSQL
- Repository pattern
- Validation
- Error handling

## Testing

Verify products can be retrieved.

## Stop Condition

Product service works independently.

---

Goal:
Create a simple login-based JWT authentication system using seeded users.

Authentication scope:

- No registration
- No OAuth
- No Auth0
- No Supabase Auth
- No refresh tokens
- No password reset
- Only login with seeded users

Seeded users:

- customer@test.se / customer123
- kitchen@restaurant.se / kitchen123

Endpoint:
POST /auth/login

JWT payload:
{
id,
email,
role
}

# Phase 5 - RabbitMQ Foundation

## Goal

Introduce RabbitMQ.

## Deliverables

RabbitMQ container.

Shared RabbitMQ connection helper.

Shared event definitions.

Connection retry logic.

Topic exchange.

## Event Types

```text
order.created

order.status.updated
```

## Testing

Verify services can connect to RabbitMQ.

Publish and receive a test message.

## Stop Condition

RabbitMQ works reliably.

---

# Phase 6 - Kitchen Service

## Goal

Create kitchen-service.

## Responsibilities

Kitchen order management.

## Consumes

```text
order.created
```

## Endpoints

GET /kitchen/orders

PATCH /kitchen/orders/:id

## Valid Status Flow

```text
pending
↓
preparing
↓
ready
↓
completed
```

Reject invalid transitions.

## Publishes

```text
order.status.updated
```

## Testing

Verify new orders appear in kitchen view.

Verify status updates publish events.

## Stop Condition

Kitchen workflow functions correctly.

---

# Phase 7 - Notification Service

## Goal

Create notification-service.

## Responsibilities

Store and serve customer notifications.

## Consumes

```text
order.created

order.status.updated
```

## Endpoints

GET /notifications

## Example Messages

Order created:

"Din order har mottagits."

Preparing:

"Din order tillagas nu."

Ready:

"Din order är klar."

Completed:

"Tack för din order."

## Testing

Verify notifications are created from events.

## Stop Condition

Notification flow works.

---

# Phase 8 - Nginx Gateway

## Goal

Create a single public entry point.

## Nginx Responsibilities

- Reverse proxy
- Route requests
- Hide internal ports

## Routes

```text
/api/products
→ product-service

/api/auth
/api/orders
→ order-service

/api/kitchen
→ kitchen-service

/api/notifications
→ notification-service
```

## Requirements

Frontend only communicates with Nginx.

Browser only knows port 80.

## Testing

Verify all routes work through Nginx.

## Stop Condition

Nginx successfully routes all traffic.

---

# Phase 9 - Frontend

## Goal

Create React frontend.

## Customer Features

- Login
- View products
- Add to cart
- Create order
- View orders
- View notifications


## Kitchen Features

- Login
- View kitchen orders
- Update order status

## Requirements

Store JWT in localStorage.

Use only Nginx endpoints.

## Styling
- Light, bright colors.

## Testing

Verify complete customer and kitchen flows.

## Stop Condition

Frontend works end-to-end.

---

# Phase 10 - Testing & CI

## Goal

Create automated testing.

## Requirements

Unit Tests:

- Business logic
- Validation
- Status transitions

Integration Tests:

- API endpoints
- Database interactions

End-to-End Tests:

Customer places order

Kitchen updates status

Customer receives notification

## CI

GitHub Actions:

- Install dependencies
- Run tests
- Report failures

## Stop Condition

Tests run successfully in CI.

---

# Phase 11 - Documentation

## Goal

Create final project documentation.

## README Must Include

### Architecture

- Frontend
- Nginx
- Services
- RabbitMQ
- PostgreSQL

### Startup

```bash
docker compose up --build
```

### Services

Explain responsibility of each service.

### Events

Explain:

order.created

order.status.updated

### Testing

Explain:

Unit tests

Integration tests

E2E tests

### Demo Users

customer@test.se

kitchen@restaurant.se

## Stop Condition

Project can be understood and started from README alone.

---

# VG Requirements

After all G requirements are complete:

## VG Enhancements

### Testing

Test:

- All APIs
- All event flows
- All service interactions

### End-to-End Coverage

Test complete flow:

Customer

↓

Order Creation

↓

RabbitMQ

↓

Kitchen

↓

RabbitMQ

↓

Notifications

↓

Customer

### Validation

Improve request validation.

Improve error handling.

Improve edge case handling.

### Optional Enhancements

Only after everything else works:

- Swagger/OpenAPI
- Redis Cache
- Advanced order flows

These are optional and must never delay completion of the core system.

---

# Final Rule

Never continue automatically.

Always stop after completing the requested phase and wait for my next instruction.

---

# Agent Rules

- Do not skip steps
- Do not build future phases early
- Do not add unnecessary dependencies
- Do not silently change architecture
- Do not remove existing working code without explaining why
- Prefer simple readable code over clever abstractions
- Keep the project understandable for a student presentation
- After each completed step, summarize changes clearly
