import { beforeAll, describe, expect, test } from "vitest";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost";

// No auth: there is no token argument anymore. The customer is identified by a
// customerId that the backend returns when the first order is placed.
async function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);
  return { response, body };
}

describe("order flow e2e", () => {
  let productId: string;
  let orderId: string;
  let customerId: string;

  beforeAll(async () => {
    const health = await fetch(`${BASE_URL}/api/health`);
    expect(health.ok).toBe(true);
  });

  test("list products", async () => {
    const { response, body } = await api("/api/products");
    expect(response.status).toBe(200);
    expect(body.products.length).toBeGreaterThan(0);
    productId = body.products[0].id;
  });

  test("place an order with name + email", async () => {
    const { response, body } = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        name: "E2E Tester",
        email: "e2e@test.se",
        items: [{ productId, quantity: 1 }],
      }),
    });

    expect(response.status).toBe(201);
    expect(body.orderId).toBeDefined();
    expect(body.customerId).toBeDefined();
    expect(body.status).toBe("pending");
    orderId = body.orderId;
    customerId = body.customerId;
  });

  test("kitchen sees the order", async () => {
    await Bun.sleep(1500);

    const { response, body } = await api("/api/kitchen/orders");

    expect(response.status).toBe(200);
    const order = body.orders.find((o: { id: string }) => o.id === orderId);
    expect(order).toBeDefined();
    expect(order.status).toBe("pending");
  });

  test("kitchen updates order to preparing then ready", async () => {
    const preparing = await api(`/api/kitchen/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "preparing" }),
    });
    expect(preparing.response.status).toBe(200);
    expect(preparing.body.order.status).toBe("preparing");

    const ready = await api(`/api/kitchen/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ready" }),
    });
    expect(ready.response.status).toBe(200);
    expect(ready.body.order.status).toBe("ready");
  });

  test("customer receives notifications", async () => {
    await Bun.sleep(1500);

    const { response, body } = await api(
      `/api/notifications?customerId=${customerId}`,
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
      `/api/orders/${orderId}?customerId=${customerId}`,
    );

    expect(response.status).toBe(200);
    expect(body.order.status).toBe("ready");
  });
});
