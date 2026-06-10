# Examination 4 – Snabbmats ordersystem

Distribuerat, eventdrivet system inspirerat av snabbmatskedjor. Kunden beställer via en React-frontend, ordern flödar genom RabbitMQ till köket, och notiser skickas tillbaka till kunden.

## Starta systemet

```bash
docker compose up --build
```

Öppna sedan `http://localhost` i webbläsaren.

Det enda port som exponeras externt är **port 80** (Nginx). Alla tjänster kommunicerar internt i Docker-nätverket.

---

## Arkitektur

```
Webbläsare
    │
    ▼
Nginx (port 80)
    │
    ├── /api/products      → product-service   (port 3002, internt)
    ├── /api/auth          → order-service     (port 3003, internt)
    ├── /api/orders        → order-service     (port 3003, internt)
    ├── /api/kitchen       → kitchen-service   (port 3004, internt)
    ├── /api/notifications → notification-service (port 3005, internt)
    └── /                  → frontend          (port 80, internt)

order-service ──── RabbitMQ ────► kitchen-service
                       │
                       └─────────► notification-service

Alla tjänster delar PostgreSQL (port 5432, internt)
```

- **Frontend** – React-app byggd med Vite, servad av Nginx inuti Docker
- **Nginx** – enda publika ingång, routar `/api/*` till rätt tjänst
- **Services** – fyra Fastify-tjänster skrivna i TypeScript, kör på Bun
- **RabbitMQ** – topic exchange för asynkron kommunikation mellan tjänster
- **PostgreSQL** – delad relationsdatabas, initieras med DDL och seed vid start

---

## Tjänster

| Tjänst | Ansvar |
|--------|--------|
| `product-service` | Läser produkter och meny från databasen |
| `order-service` | Hanterar inloggning (JWT) och ordrar |
| `kitchen-service` | Tar emot ordrar via RabbitMQ, hanterar köksvy och statusuppdateringar |
| `notification-service` | Lyssnar på events och skapar notiser till kunder |

---

## Events

Tjänsterna kommunicerar via en **topic exchange** i RabbitMQ (`exam4.events`).

### `order.created`

Publiceras av: `order-service`  
Konsumeras av: `kitchen-service`, `notification-service`

```json
{
  "type": "order.created",
  "orderId": "uuid",
  "customerId": "uuid",
  "items": [{ "productId": "uuid", "name": "Cheeseburger", "quantity": 1, "unitPrice": 7900 }],
  "totalPrice": 7900
}
```

Triggar: köket ser den nya ordern, kunden får notisen "Din order har mottagits."

### `order.status.updated`

Publiceras av: `kitchen-service`  
Konsumeras av: `order-service`, `notification-service`

```json
{
  "type": "order.status.updated",
  "orderId": "uuid",
  "customerId": "uuid",
  "status": "preparing"
}
```

Triggar: orderns status uppdateras i databasen, kunden får en statusnotis.

---

## Orderflöde

1. Kund loggar in → `order-service` returnerar JWT
2. Kund skapar order → `order-service` sparar i PostgreSQL och publicerar `order.created`
3. `kitchen-service` tar emot eventet → ordern visas i köket med status `pending`
4. Kök uppdaterar status (`pending` → `preparing` → `ready` → `completed`) → publicerar `order.status.updated`
5. `order-service` uppdaterar orderstatus i PostgreSQL
6. `notification-service` skapar en notis till kunden vid varje statusbyte

---

## API-endpoints

Bas-URL: **http://localhost**

| Endpoint | Auth | Beskrivning |
|----------|------|-------------|
| `GET /api/health` | – | Hälsokontroll (svarar direkt från Nginx) |
| `GET /api/products` | – | Lista alla produkter |
| `GET /api/products/:id` | – | Hämta en produkt |
| `POST /api/auth/login` | – | Logga in, returnerar JWT |
| `POST /api/orders` | Kund-JWT | Skapa order |
| `GET /api/orders` | Kund-JWT | Lista egna ordrar |
| `GET /api/orders/:id` | Kund-JWT | Hämta en specifik order |
| `GET /api/kitchen/orders` | Köks-JWT | Lista aktiva köksordrar |
| `PATCH /api/kitchen/orders/:id` | Köks-JWT | Uppdatera orderstatus |
| `GET /api/notifications` | Kund-JWT | Lista egna notiser |

---

## Demo-användare

Skapas automatiskt när systemet startar.

| Användare | Lösenord | Roll |
|-----------|----------|------|
| `customer@test.se` | `customer123` | Kund |
| `kitchen@restaurant.se` | `kitchen123` | Kökspersonal |

---

## Tester

### Enhetstester (unit)

Testar ren affärslogik utan beroenden – ingen databas, inget nätverk.

```bash
bun run test:unit
```

Täcker: ordervalidering, prisberäkning, statusövergångar, notismeddelanden.

### Integrationstester

Testar varje tjänsts HTTP-kontrakt och databasinteraktioner mot en igångvarande stack.

```bash
docker compose up -d --build
bun run test:integration
```

Täcker: korrekta HTTP-statuskoder, felhantering, behörighetskontroll, att data sparas och kan hämtas.

### End-to-end-tester

Testar hela orderflödet från inloggning till notis, inklusive RabbitMQ-events.

```bash
docker compose up -d --build
bun run test:e2e
```

Täcker: inloggning, orderläggning, köksuppdateringar, notiser, statussynk.

### Kör alla tester

```bash
docker compose up -d --build
bun run test
```

CI kör enhetstester och hela stack-testerna automatiskt vid varje push via GitHub Actions.
