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
| `order-service` | Skapar kunder (namn + e-post) och hanterar ordrar |
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

1. Kund fyller i namn + e-post och lägger en beställning → `order-service` hittar eller skapar kunden (via e-postadressen), sparar ordern i PostgreSQL och publicerar `order.created`
2. `kitchen-service` tar emot eventet → ordern visas i köket med status `pending`
3. Kök uppdaterar status (`pending` → `preparing` → `ready` → `completed`) → publicerar `order.status.updated`
4. `order-service` uppdaterar orderstatus i PostgreSQL
5. `notification-service` skapar en notis till kunden vid varje statusbyte
6. Kunden ser sina ordrar och notiser via sitt `customerId` (sparat i webbläsaren efter första beställningen)

---

## API-endpoints

Bas-URL: **http://localhost**

Systemet har ingen inloggning. En kund identifieras med `customerId` (returneras när första ordern läggs och skickas med som query-parameter).

| Endpoint | Beskrivning |
|----------|-------------|
| `GET /api/health` | Hälsokontroll (svarar direkt från Nginx) |
| `GET /api/products` | Lista alla produkter |
| `GET /api/products/:id` | Hämta en produkt |
| `POST /api/orders` | Skapa order (kropp: `{ name, email, items }`) |
| `GET /api/orders?customerId=` | Lista en kunds ordrar |
| `GET /api/orders/:id?customerId=` | Hämta en specifik order (måste tillhöra kunden) |
| `GET /api/kitchen/orders` | Lista aktiva köksordrar |
| `PATCH /api/kitchen/orders/:id` | Uppdatera orderstatus |
| `GET /api/notifications?customerId=` | Lista en kunds notiser |

---

## Kunder

Det finns ingen inloggning och inga fördefinierade användare. Kunden anger namn och
e-post i orderformuläret; `order-service` hittar en befintlig kund via e-postadressen
eller skapar en ny. Kundens `customerId` returneras och sparas i webbläsaren så att
kunden kan se sina ordrar och notiser. Köksvyn är öppen och kräver ingen inloggning.

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

Täcker: korrekta HTTP-statuskoder, felhantering, att en kund bara ser sina egna ordrar, att data sparas och kan hämtas.

### End-to-end-tester

Testar hela orderflödet från beställning till notis, inklusive RabbitMQ-events.

```bash
docker compose up -d --build
bun run test:e2e
```

Täcker: orderläggning (namn + e-post), köksuppdateringar, notiser, statussynk.

### Kör alla tester

```bash
docker compose up -d --build
bun run test
```

CI kör enhetstester och hela stack-testerna automatiskt vid varje push via GitHub Actions.
