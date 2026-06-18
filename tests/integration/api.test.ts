// Integration tests for the API through the nginx gateway (BASE_URL, default
// http://localhost), run against the full docker compose stack. They cover each
// service's endpoints and their status codes: products, orders (incl. Zod
// validation 400s and server-side pricing), kitchen, and notifications. There is
// no auth — a customer is identified by the customerId returned on their first
// order. The helpers below wrap fetch, fetch seeded products, and place an order.
import { describe, expect, test } from "bun:test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost";

async function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function firstProductId(): Promise<string> {
  const { body } = await api("/api/v1/products");
  return body.products[0].id;
}

// Kitchen tickets are created asynchronously from the order.created event over
// RabbitMQ, so poll until the ticket shows up instead of using a fixed sleep.
async function waitForKitchenOrder(orderId: string, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { body } = await api("/api/v1/kitchen/orders");
    const order = (body.orders ?? []).find(
      (o: { id: string }) => o.id === orderId,
    );
    if (order) return order;
    await Bun.sleep(300);
  }
  return undefined;
}

async function allProducts(): Promise<
  Array<{ id: string; name: string; price: number }>
> {
  const { body } = await api("/api/v1/products");
  return body.products;
}

async function placeOrder(
  name: string,
  email: string,
  items: Array<{ productId: string; quantity: number }>,
) {
  return api("/api/v1/orders", {
    method: "POST",
    body: JSON.stringify({ name, email, items }),
  });
}

describe("health", () => {
  test("GET /api/health returns 200", async () => {
    const { response } = await api("/api/health");
    expect(response.status).toBe(200);
  });
});

describe("products", () => {
  test("GET /api/v1/products returns all 5 seeded products", async () => {
    const { response, body } = await api("/api/v1/products");
    expect(response.status).toBe(200);
    expect(Array.isArray(body.products)).toBe(true);
    expect(body.products.length).toBe(5);
  });

  test("GET /api/v1/products/:id returns the correct product", async () => {
    const { body: list } = await api("/api/v1/products");
    const id = list.products[0].id;
    const { response, body } = await api(`/api/v1/products/${id}`);
    expect(response.status).toBe(200);
    expect(body.product.id).toBe(id);
    expect(body.product.name).toBeDefined();
    expect(body.product.price).toBeGreaterThan(0);
  });

  test("GET /api/v1/products/non-uuid returns 400", async () => {
    const { response } = await api("/api/v1/products/not-a-uuid");
    expect(response.status).toBe(400);
  });

  test("GET /api/v1/products/unknown-uuid returns 404", async () => {
    const { response } = await api(
      "/api/v1/products/00000000-0000-0000-0000-000000000000",
    );
    expect(response.status).toBe(404);
  });
});

describe("orders", () => {
  test("POST /api/v1/orders without name/email returns 400", async () => {
    const productId = await firstProductId();
    const { response } = await api("/api/v1/orders", {
      method: "POST",
      body: JSON.stringify({ items: [{ productId, quantity: 1 }] }),
    });
    expect(response.status).toBe(400);
  });

  test("POST /api/v1/orders with empty items returns 400", async () => {
    const { response } = await placeOrder("Empty", "empty@test.se", []);
    expect(response.status).toBe(400);
  });

  test("POST /api/v1/orders with zero quantity returns 400", async () => {
    const productId = await firstProductId();
    const { response } = await placeOrder("Zero", "zero@test.se", [
      { productId, quantity: 0 },
    ]);
    expect(response.status).toBe(400);
  });

  test("POST /api/v1/orders with an invalid email returns 400", async () => {
    const productId = await firstProductId();
    const { response } = await placeOrder("BadEmail", "not-an-email", [
      { productId, quantity: 1 },
    ]);
    expect(response.status).toBe(400);
  });

  test("POST /api/v1/orders with a malformed body (no items) returns 400", async () => {
    const { response } = await api("/api/v1/orders", {
      method: "POST",
      body: JSON.stringify({ name: "NoItems", email: "noitems@test.se" }),
    });
    expect(response.status).toBe(400);
  });

  test("POST /api/v1/orders prices the order server-side (totalPrice = sum)", async () => {
    const products = await allProducts();
    const a = products[0];
    const b = products[1];

    const { response, body } = await placeOrder("Pricer", "pricer@test.se", [
      { productId: a.id, quantity: 2 },
      { productId: b.id, quantity: 1 },
    ]);

    expect(response.status).toBe(201);
    expect(body.totalPrice).toBe(a.price * 2 + b.price * 1);
  });

  test("GET /api/v1/orders without customerId returns 400", async () => {
    const { response } = await api("/api/v1/orders");
    expect(response.status).toBe(400);
  });

  test("GET /api/v1/orders returns the customer's own orders as a list", async () => {
    const productId = await firstProductId();
    const { body: created } = await placeOrder("Lister", "lister@test.se", [
      { productId, quantity: 1 },
    ]);

    const { response, body } = await api(
      `/api/v1/orders?customerId=${created.customerId}`,
    );
    expect(response.status).toBe(200);
    expect(Array.isArray(body.orders)).toBe(true);
    expect(body.orders.some((o: { id: string }) => o.id === created.orderId)).toBe(
      true,
    );
  });

  test("POST /api/v1/orders creates an order retrievable by its customer", async () => {
    const productId = await firstProductId();

    const { response: createRes, body: createBody } = await placeOrder(
      "Alice",
      "alice@test.se",
      [{ productId, quantity: 2 }],
    );
    expect(createRes.status).toBe(201);
    expect(createBody.orderId).toBeDefined();
    expect(createBody.customerId).toBeDefined();
    expect(createBody.status).toBe("pending");

    const { response: getRes, body: getBody } = await api(
      `/api/v1/orders/${createBody.orderId}?customerId=${createBody.customerId}`,
    );
    expect(getRes.status).toBe(200);
    expect(getBody.order.id).toBe(createBody.orderId);
    expect(getBody.order.status).toBe("pending");
  });

  test("GET /api/v1/orders/:id with non-uuid returns 400", async () => {
    const { response } = await api(
      "/api/v1/orders/not-a-uuid?customerId=00000000-0000-0000-0000-000000000000",
    );
    expect(response.status).toBe(400);
  });

  test("a customer cannot fetch another customer's order (404)", async () => {
    const productId = await firstProductId();

    const { body: a } = await placeOrder("CustomerA", "a@test.se", [
      { productId, quantity: 1 },
    ]);
    const { body: b } = await placeOrder("CustomerB", "b@test.se", [
      { productId, quantity: 1 },
    ]);

    expect(a.customerId).not.toBe(b.customerId);

    const { response } = await api(
      `/api/v1/orders/${a.orderId}?customerId=${b.customerId}`,
    );
    expect(response.status).toBe(404);
  });
});

describe("kitchen", () => {
  test("PATCH /api/v1/kitchen/orders/non-uuid returns 400", async () => {
    const { response } = await api("/api/v1/kitchen/orders/not-a-uuid", {
      method: "PATCH",
      body: JSON.stringify({ status: "preparing" }),
    });
    expect(response.status).toBe(400);
  });

  test("PATCH /api/v1/kitchen/orders/<unknown-uuid> returns 404", async () => {
    const { response } = await api(
      "/api/v1/kitchen/orders/00000000-0000-0000-0000-000000000000",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "preparing" }),
      },
    );
    expect(response.status).toBe(404);
  });

  test("PATCH /api/v1/kitchen/orders/:id with an invalid transition returns 400", async () => {
    const productId = await firstProductId();
    const { body: order } = await placeOrder("Kitchen", "kitchen-it@test.se", [
      { productId, quantity: 1 },
    ]);

    await waitForKitchenOrder(order.orderId);

    const { response } = await api(`/api/v1/kitchen/orders/${order.orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });
    expect(response.status).toBe(400);
  });

  test("PATCH /api/v1/kitchen/orders/:id advances pending -> preparing (200)", async () => {
    const productId = await firstProductId();
    const { body: order } = await placeOrder("Advance", "advance-it@test.se", [
      { productId, quantity: 1 },
    ]);

    const ticket = await waitForKitchenOrder(order.orderId);
    expect(ticket).toBeDefined();
    expect(ticket.status).toBe("pending");

    const { response, body } = await api(
      `/api/v1/kitchen/orders/${order.orderId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "preparing" }),
      },
    );
    expect(response.status).toBe(200);
    expect(body.order.status).toBe("preparing");
  });

  test("PATCH /api/v1/kitchen/orders/:id with an unknown status value returns 400", async () => {
    const productId = await firstProductId();
    const { body: order } = await placeOrder("BadStatus", "badstatus-it@test.se", [
      { productId, quantity: 1 },
    ]);

    await waitForKitchenOrder(order.orderId);

    const { response } = await api(`/api/v1/kitchen/orders/${order.orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "flying" }),
    });
    expect(response.status).toBe(400);
  });
});

describe("notifications", () => {
  test("GET /api/v1/notifications without customerId returns 400", async () => {
    const { response } = await api("/api/v1/notifications");
    expect(response.status).toBe(400);
  });

  test("GET /api/v1/notifications with a non-uuid customerId returns 400", async () => {
    const { response } = await api("/api/v1/notifications?customerId=not-a-uuid");
    expect(response.status).toBe(400);
  });

  test("GET /api/v1/notifications returns a list for a customer", async () => {
    const productId = await firstProductId();
    const { body } = await placeOrder("Notify", "notify@test.se", [
      { productId, quantity: 1 },
    ]);

    const { response, body: notifBody } = await api(
      `/api/v1/notifications?customerId=${body.customerId}`,
    );
    expect(response.status).toBe(200);
    expect(Array.isArray(notifBody.notifications)).toBe(true);
  });
});
