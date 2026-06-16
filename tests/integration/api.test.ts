import { beforeAll, describe, expect, test } from "vitest";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost";

async function api(path: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);
  return { response, body };
}

let customerToken: string;
let kitchenToken: string;

beforeAll(async () => {
  const { body: c } = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "customer@test.se", password: "customer123" }),
  });
  customerToken = c.token;

  const { body: k } = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "kitchen@restaurant.se", password: "kitchen123" }),
  });
  kitchenToken = k.token;
});

// --- Products ---

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

// --- Auth ---

describe("auth", () => {
  test("POST /api/auth/login with valid customer credentials returns token", async () => {
    const { response, body } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "customer@test.se", password: "customer123" }),
    });
    expect(response.status).toBe(200);
    expect(body.token).toBeDefined();
    expect(body.customer.role).toBe("customer");
  });

  test("POST /api/auth/login with valid kitchen credentials returns token", async () => {
    const { response, body } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "kitchen@restaurant.se", password: "kitchen123" }),
    });
    expect(response.status).toBe(200);
    expect(body.token).toBeDefined();
    expect(body.customer.role).toBe("kitchen");
  });

  test("POST /api/auth/login with wrong password returns 401", async () => {
    const { response } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "customer@test.se", password: "wrong" }),
    });
    expect(response.status).toBe(401);
  });

  test("POST /api/auth/login with missing fields returns 400", async () => {
    const { response } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });
});

// --- Orders ---

describe("orders", () => {
  test("GET /api/orders without token returns 401", async () => {
    const { response } = await api("/api/orders");
    expect(response.status).toBe(401);
  });

  test("GET /api/orders with kitchen token returns 403", async () => {
    const { response } = await api("/api/orders", {}, kitchenToken);
    expect(response.status).toBe(403);
  });

  test("POST /api/orders with empty items returns 400", async () => {
    const { response } = await api(
      "/api/orders",
      { method: "POST", body: JSON.stringify({ items: [] }) },
      customerToken,
    );
    expect(response.status).toBe(400);
  });

  test("POST /api/orders with zero quantity returns 400", async () => {
    const { body: list } = await api("/api/products");
    const productId = list.products[0].id;

    const { response } = await api(
      "/api/orders",
      {
        method: "POST",
        body: JSON.stringify({ items: [{ productId, quantity: 0 }] }),
      },
      customerToken,
    );
    expect(response.status).toBe(400);
  });

  test("POST /api/orders creates order stored in DB and retrievable", async () => {
    const { body: list } = await api("/api/products");
    const productId = list.products[0].id;

    const { response: createRes, body: createBody } = await api(
      "/api/orders",
      {
        method: "POST",
        body: JSON.stringify({ items: [{ productId, quantity: 2 }] }),
      },
      customerToken,
    );
    expect(createRes.status).toBe(201);
    expect(createBody.orderId).toBeDefined();
    expect(createBody.status).toBe("pending");

    const { response: getRes, body: getBody } = await api(
      `/api/orders/${createBody.orderId}`,
      {},
      customerToken,
    );
    expect(getRes.status).toBe(200);
    expect(getBody.order.id).toBe(createBody.orderId);
    expect(getBody.order.status).toBe("pending");
  });

  test("GET /api/orders/:id with non-uuid returns 400", async () => {
    const { response } = await api("/api/orders/not-a-uuid", {}, customerToken);
    expect(response.status).toBe(400);
  });

  test("GET /api/orders/:id for another customer returns 404", async () => {
    const { response } = await api(
      "/api/orders/00000000-0000-0000-0000-000000000000",
      {},
      customerToken,
    );
    expect(response.status).toBe(404);
  });
});

// --- Kitchen ---

describe("kitchen", () => {
  test("GET /api/kitchen/orders with customer token returns 403", async () => {
    const { response } = await api("/api/kitchen/orders", {}, customerToken);
    expect(response.status).toBe(403);
  });

  test("GET /api/kitchen/orders without token returns 401", async () => {
    const { response } = await api("/api/kitchen/orders");
    expect(response.status).toBe(401);
  });

  test("PATCH /api/kitchen/orders/non-uuid returns 400", async () => {
    const { response } = await api(
      "/api/kitchen/orders/not-a-uuid",
      { method: "PATCH", body: JSON.stringify({ status: "preparing" }) },
      kitchenToken,
    );
    expect(response.status).toBe(400);
  });

  test("PATCH /api/kitchen/orders/:id with invalid status returns 400", async () => {
    const { body: list } = await api("/api/products");
    const productId = list.products[0].id;

    const { body: order } = await api(
      "/api/orders",
      {
        method: "POST",
        body: JSON.stringify({ items: [{ productId, quantity: 1 }] }),
      },
      customerToken,
    );

    await Bun.sleep(1000);

    const { response } = await api(
      `/api/kitchen/orders/${order.orderId}`,
      { method: "PATCH", body: JSON.stringify({ status: "completed" }) },
      kitchenToken,
    );
    expect(response.status).toBe(400);
  });
});

// --- Notifications ---

describe("notifications", () => {
  test("GET /api/notifications without token returns 401", async () => {
    const { response } = await api("/api/notifications");
    expect(response.status).toBe(401);
  });

  test("GET /api/notifications with kitchen token returns 403", async () => {
    const { response } = await api("/api/notifications", {}, kitchenToken);
    expect(response.status).toBe(403);
  });

  test("GET /api/notifications returns list for customer", async () => {
    const { response, body } = await api("/api/notifications", {}, customerToken);
    expect(response.status).toBe(200);
    expect(Array.isArray(body.notifications)).toBe(true);
  });
});
