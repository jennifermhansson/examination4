# Examination 4 – Snabbmats ordersystem

Distribuerat, eventdrivet backend inspirerat av snabbmatskedjor. All extern trafik går in via **nginx på port 80** under `/api/*`.

## Starta systemet

```bash
docker compose up --build
```

Detta startar PostgreSQL (DDL + seed), RabbitMQ, nginx och alla tjänster:

| Tjänst | Ansvar |
|--------|--------|
| `product-service` | Produkter och meny |
| `order-service` | Registrering, inloggning och ordrar |
| `kitchen-service` | Köksvy och statusuppdateringar |
| `notification-service` | Notiser till kund |

## Publik ingång

Bas-URL: **http://localhost**

| Endpoint | Beskrivning |
|----------|-------------|
| `GET /api/health` | Hälsokontroll |
| `GET /api/products` | Lista produkter |
| `POST /api/auth/register` | Registrera kund |
| `POST /api/auth/login` | Logga in |
| `POST /api/orders` | Skapa order (JWT) |
| `GET /api/orders` | Egna ordrar (JWT) |
| `GET /api/kitchen/orders` | Aktiva ordrar i köket (köks-JWT) |
| `PATCH /api/kitchen/orders/:id` | Uppdatera orderstatus |
| `GET /api/notifications` | Kundnotiser (JWT) |

Seedad köksanvändare: `kitchen@restaurant.se` / `kitchen123`

## Orderflöde

1. Kund loggar in och skapar order → `order-service` sparar order och publicerar `order.created` via RabbitMQ.
2. `kitchen-service` tar emot eventet och visar ordern i köket.
3. Köket uppdaterar status (`preparing` → `ready`) → publicerar `order.status.updated`.
4. `order-service` uppdaterar orderstatus i databasen.
5. `notification-service` skickar notiser till kunden vid varje steg.

## Tester

Unit-tester (logik):

```bash
bun install --cwd shared
bun run test:unit
```

End-to-end (kräver igång stack):

```bash
docker compose up -d --build
bun run test:e2e
```

CI kör båda automatiskt vid push via GitHub Actions.

## Arkitektur

```
Klient → nginx (80) → tjänster (HTTP)
                    ↘ RabbitMQ (events mellan tjänster)
                    ↘ PostgreSQL (delad databas)
```

Interna tjänster exponeras inte direkt utåt – endast via nginx.
