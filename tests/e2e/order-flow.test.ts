import { beforeAll, describe, expect, test } from "vitest";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost";

async function api(
  path: string,
  options: RequestInit = {},
  token?: string,
) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const body = await response.json().catch(() => null);
  return { response, body };
}

describe("order flow e2e", () => {
  let customerToken: string;
  let kitchenToken: string;
  let productId: string;
  let orderId: string;

  beforeAll(async () => {
    const health = await fetch(`${BASE_URL}/api/health`);
    expect(health.ok).toBe(true);
  });

  test("login customer", async () => {
    const { response, body } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "customer@test.se", password: "customer123" }),
    });

    expect(response.status).toBe(200);
    expect(body.token).toBeDefined();
    customerToken = body.token;
  });

  test("login kitchen staff", async () => {
    const { response, body } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "kitchen@restaurant.se",
        password: "kitchen123",
      }),
    });

    expect(response.status).toBe(200);
    expect(body.token).toBeDefined();
    kitchenToken = body.token;
  });

  test("login fails with wrong password", async () => {
    const { response } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "customer@test.se", password: "wrongpassword" }),
    });
    expect(response.status).toBe(401);
  });

  test("protected endpoint requires token", async () => {
    const { response } = await api("/api/orders");
    expect(response.status).toBe(401);
  });

  test("customer cannot access kitchen endpoint", async () => {
    const { response } = await api("/api/kitchen/orders", {}, customerToken);
    expect(response.status).toBe(403);
  });

  test("list products", async () => {
    const { response, body } = await api("/api/products");
    expect(response.status).toBe(200);
    expect(body.products.length).toBeGreaterThan(0);
    productId = body.products[0].id;
  });

  test("create order", async () => {
    const { response, body } = await api(
      "/api/orders",
      {
        method: "POST",
        body: JSON.stringify({
          items: [{ productId, quantity: 1 }],
        }),
      },
      customerToken,
    );

    expect(response.status).toBe(201);
    expect(body.orderId).toBeDefined();
    expect(body.status).toBe("pending");
    orderId = body.orderId;
  });

  test("kitchen sees the order", async () => {
    await Bun.sleep(1500);

    const { response, body } = await api(
      "/api/kitchen/orders",
      {},
      kitchenToken,
    );

    expect(response.status).toBe(200);
    const order = body.orders.find((o: { id: string }) => o.id === orderId);
    expect(order).toBeDefined();
    expect(order.status).toBe("pending");
  });

  test("kitchen updates order to preparing then ready", async () => {
    const preparing = await api(
      `/api/kitchen/orders/${orderId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "preparing" }),
      },
      kitchenToken,
    );
    expect(preparing.response.status).toBe(200);
    expect(preparing.body.order.status).toBe("preparing");

    const ready = await api(
      `/api/kitchen/orders/${orderId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "ready" }),
      },
      kitchenToken,
    );
    expect(ready.response.status).toBe(200);
    expect(ready.body.order.status).toBe("ready");
  });

  test("customer receives notifications", async () => {
    await Bun.sleep(1500);

    const { response, body } = await api(
      "/api/notifications",
      {},
      customerToken,
    );

    expect(response.status).toBe(200);
    expect(body.notifications.length).toBeGreaterThanOrEqual(3);

    const messages = body.notifications.map(
      (n: { message: string }) => n.message,
    );
    expect(messages.some((m: string) => m.includes("mottagits"))).toBe(true);
    expect(messages.some((m: string) => m.includes("tillagas"))).toBe(true);
    expect(messages.some((m: string) => m.includes("klar"))).toBe(true);
  });

  test("customer order status is updated", async () => {
    await Bun.sleep(1000);

    const { response, body } = await api(
      `/api/orders/${orderId}`,
      {},
      customerToken,
    );

    expect(response.status).toBe(200);
    expect(body.order.status).toBe("ready");
  });
});
