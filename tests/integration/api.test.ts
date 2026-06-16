import { describe, expect, test } from "vitest";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost";

// Small fetch helper. There is no auth anymore, so there is no token argument:
// the customer is identified by a customerId query parameter where needed.
async function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);
  return { response, body };
}

// Convenience: grab the id of the first seeded product.
async function firstProductId(): Promise<string> {
  const { body } = await api("/api/products");
  return body.products[0].id;
}

// Convenience: place an order and return the parsed response body
// ({ orderId, customerId, status, totalPrice }).
async function placeOrder(
  name: string,
  email: string,
  items: Array<{ productId: string; quantity: number }>,
) {
  return api("/api/orders", {
    method: "POST",
    body: JSON.stringify({ name, email, items }),
  });
}

// --- Products (unchanged, public endpoints) ---

describe("products", () => {
  test("GET /api/products returns all 5 seeded products", async () => {
    const { response, body } = await api("/api/products");
    expect(response.status).toBe(200);
    expect(Array.isArray(body.products)).toBe(true);
    expect(body.products.length).toBe(5);
  });

  test("GET /api/products/:id returns the correct product", async () => {
    const { body: list } = await api("/api/products");
    const id = list.products[0].id;
    const { response, body } = await api(`/api/products/${id}`);
    expect(response.status).toBe(200);
    expect(body.product.id).toBe(id);
    expect(body.product.name).toBeDefined();
    expect(body.product.price).toBeGreaterThan(0);
  });

  test("GET /api/products/non-uuid returns 400", async () => {
    const { response } = await api("/api/products/not-a-uuid");
    expect(response.status).toBe(400);
  });

  test("GET /api/products/unknown-uuid returns 404", async () => {
    const { response } = await api(
      "/api/products/00000000-0000-0000-0000-000000000000",
    );
    expect(response.status).toBe(404);
  });
});

// --- Orders (name + email instead of login; customerId instead of token) ---

describe("orders", () => {
  test("POST /api/orders without name/email returns 400", async () => {
    const productId = await firstProductId();
    const { response } = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({ items: [{ productId, quantity: 1 }] }),
    });
    expect(response.status).toBe(400);
  });

  test("POST /api/orders with empty items returns 400", async () => {
    const { response } = await placeOrder("Empty", "empty@test.se", []);
    expect(response.status).toBe(400);
  });

  test("POST /api/orders with zero quantity returns 400", async () => {
    const productId = await firstProductId();
    const { response } = await placeOrder("Zero", "zero@test.se", [
      { productId, quantity: 0 },
    ]);
    expect(response.status).toBe(400);
  });

  test("GET /api/orders without customerId returns 400", async () => {
    const { response } = await api("/api/orders");
    expect(response.status).toBe(400);
  });

  test("POST /api/orders creates an order retrievable by its customer", async () => {
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
      `/api/orders/${createBody.orderId}?customerId=${createBody.customerId}`,
    );
    expect(getRes.status).toBe(200);
    expect(getBody.order.id).toBe(createBody.orderId);
    expect(getBody.order.status).toBe("pending");
  });

  test("GET /api/orders/:id with non-uuid returns 400", async () => {
    const { response } = await api(
      "/api/orders/not-a-uuid?customerId=00000000-0000-0000-0000-000000000000",
    );
    expect(response.status).toBe(400);
  });

  test("a customer cannot fetch another customer's order (404)", async () => {
    const productId = await firstProductId();

    // Customer A places an order.
    const { body: a } = await placeOrder("CustomerA", "a@test.se", [
      { productId, quantity: 1 },
    ]);

    // Customer B places their own order so we have a valid, different customerId.
    const { body: b } = await placeOrder("CustomerB", "b@test.se", [
      { productId, quantity: 1 },
    ]);

    expect(a.customerId).not.toBe(b.customerId);

    // B tries to read A's order → treated as not found.
    const { response } = await api(
      `/api/orders/${a.orderId}?customerId=${b.customerId}`,
    );
    expect(response.status).toBe(404);
  });
});

// --- Kitchen (open endpoints, no token) ---

describe("kitchen", () => {
  test("PATCH /api/kitchen/orders/non-uuid returns 400", async () => {
    const { response } = await api("/api/kitchen/orders/not-a-uuid", {
      method: "PATCH",
      body: JSON.stringify({ status: "preparing" }),
    });
    expect(response.status).toBe(400);
  });

  test("PATCH /api/kitchen/orders/:id with an invalid transition returns 400", async () => {
    const productId = await firstProductId();
    const { body: order } = await placeOrder("Kitchen", "kitchen-it@test.se", [
      { productId, quantity: 1 },
    ]);

    // Give the kitchen-service time to consume the order.created event.
    await Bun.sleep(1000);

    // A fresh order is 'pending'; jumping straight to 'completed' is not allowed.
    const { response } = await api(`/api/kitchen/orders/${order.orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });
    expect(response.status).toBe(400);
  });
});

// --- Notifications (customerId instead of token) ---

describe("notifications", () => {
  test("GET /api/notifications without customerId returns 400", async () => {
    const { response } = await api("/api/notifications");
    expect(response.status).toBe(400);
  });

  test("GET /api/notifications returns a list for a customer", async () => {
    const productId = await firstProductId();
    const { body } = await placeOrder("Notify", "notify@test.se", [
      { productId, quantity: 1 },
    ]);

    const { response, body: notifBody } = await api(
      `/api/notifications?customerId=${body.customerId}`,
    );
    expect(response.status).toBe(200);
    expect(Array.isArray(notifBody.notifications)).toBe(true);
  });
});
