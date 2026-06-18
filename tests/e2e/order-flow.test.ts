// End-to-end customer journey through the nginx gateway against the full docker
// compose stack: list products -> place an order -> kitchen advances it the whole
// way (pending -> preparing -> ready -> completed) -> the customer receives all
// four Swedish notifications and their own order copy reaches completed. There is
// no auth (the customer is identified by the customerId from their first order).
// State propagates asynchronously over RabbitMQ, so waitFor polls until each
// expected condition holds instead of using fixed sleeps; the order placement is
// also retried because the order-service price cache may be cold on a fresh start.
import { beforeAll, describe, expect, test } from "bun:test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost";

async function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function waitFor<T>(
  fn: () => Promise<T>,
  ok: (value: T) => boolean,
  timeoutMs = 15000,
  intervalMs = 300,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = await fn();
  while (!ok(value) && Date.now() < deadline) {
    await Bun.sleep(intervalMs);
    value = await fn();
  }
  return value;
}

describe("order flow e2e", () => {
  let productId: string;
  let productPrice: number;
  let orderId: string;
  let customerId: string;

  beforeAll(async () => {
    const health = await fetch(`${BASE_URL}/api/health`);
    expect(health.ok).toBe(true);
  });

  test("list products", async () => {
    const { response, body } = await api("/api/v1/products");
    expect(response.status).toBe(200);
    expect(body.products.length).toBeGreaterThan(0);
    productId = body.products[0].id;
    productPrice = body.products[0].price;
  });

  test("place an order with name + email", async () => {
    const { response, body } = await waitFor(
      () =>
        api("/api/v1/orders", {
          method: "POST",
          body: JSON.stringify({
            name: "E2E Tester",
            email: "e2e@test.se",
            items: [{ productId, quantity: 1 }],
          }),
        }),
      (res) => res.response.status === 201,
    );

    expect(response.status).toBe(201);
    expect(body.orderId).toBeDefined();
    expect(body.customerId).toBeDefined();
    expect(body.status).toBe("pending");
    expect(body.totalPrice).toBe(productPrice * 1);
    orderId = body.orderId;
    customerId = body.customerId;
  });

  test("kitchen sees the order", async () => {
    const order = await waitFor(
      async () => {
        const { body } = await api("/api/v1/kitchen/orders");
        return body.orders.find((o: { id: string }) => o.id === orderId);
      },
      (o) => Boolean(o),
    );

    expect(order).toBeDefined();
    expect(order.status).toBe("pending");
  });

  test("kitchen advances the order all the way to completed", async () => {
    const preparing = await api(`/api/v1/kitchen/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "preparing" }),
    });
    expect(preparing.response.status).toBe(200);
    expect(preparing.body.order.status).toBe("preparing");

    const ready = await api(`/api/v1/kitchen/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ready" }),
    });
    expect(ready.response.status).toBe(200);
    expect(ready.body.order.status).toBe("ready");

    const completed = await api(`/api/v1/kitchen/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });
    expect(completed.response.status).toBe(200);
    expect(completed.body.order.status).toBe("completed");
  });

  test("completed order leaves the active kitchen list", async () => {
    const gone = await waitFor(
      async () => {
        const { body } = await api("/api/v1/kitchen/orders");
        return body.orders.find((o: { id: string }) => o.id === orderId);
      },
      (o) => !o,
    );
    expect(gone).toBeUndefined();
  });

  test("customer receives notifications for the whole flow", async () => {
    const messages = await waitFor(
      async () => {
        const { body } = await api(
          `/api/v1/notifications?customerId=${customerId}`,
        );
        return (body.notifications ?? []).map(
          (n: { message: string }) => n.message,
        ) as string[];
      },
      (msgs) =>
        msgs.some((m) => m.includes("mottagits")) &&
        msgs.some((m) => m.includes("tillagas")) &&
        msgs.some((m) => m.includes("klar")) &&
        msgs.some((m) => m.includes("Tack")),
    );

    expect(messages.length).toBeGreaterThanOrEqual(4);
    expect(messages.some((m) => m.includes("mottagits"))).toBe(true);
    expect(messages.some((m) => m.includes("tillagas"))).toBe(true);
    expect(messages.some((m) => m.includes("klar"))).toBe(true);
    expect(messages.some((m) => m.includes("Tack"))).toBe(true);
  });

  test("customer's own order copy reaches completed", async () => {
    const status = await waitFor(
      async () => {
        const { body } = await api(
          `/api/v1/orders/${orderId}?customerId=${customerId}`,
        );
        return body?.order?.status as string | undefined;
      },
      (s) => s === "completed",
    );

    expect(status).toBe("completed");
  });
});
