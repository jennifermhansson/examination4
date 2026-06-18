// Second end-to-end flow that complements order-flow.test.ts. It covers two
// things the single-item happy path does not:
//   1. A multi-item order (two products, quantity > 1) priced and propagated
//      end to end, so order.created carries multiple lines and the totalPrice
//      is the server-side sum.
//   2. An explicit error scenario (felscenario): an illegal kitchen status jump
//      is rejected with 400 and leaves the ticket untouched, after which the
//      legal transition still succeeds. This demonstrates fault isolation -- a
//      bad request does not corrupt the order's state machine.
// State propagates asynchronously over RabbitMQ, so waitFor polls instead of
// sleeping; order placement is retried because the price cache may be cold.
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

describe("multi-item order + error scenario e2e", () => {
  let productA: { id: string; price: number };
  let productB: { id: string; price: number };
  let orderId: string;
  let customerId: string;
  let expectedTotal: number;

  beforeAll(async () => {
    const health = await fetch(`${BASE_URL}/api/health`);
    expect(health.ok).toBe(true);
  });

  test("list products (need at least two)", async () => {
    const { response, body } = await api("/api/v1/products");
    expect(response.status).toBe(200);
    expect(body.products.length).toBeGreaterThanOrEqual(2);
    productA = body.products[0];
    productB = body.products[1];
  });

  test("place a multi-item order priced server-side", async () => {
    expectedTotal = productA.price * 2 + productB.price * 3;

    const { response, body } = await waitFor(
      () =>
        api("/api/v1/orders", {
          method: "POST",
          body: JSON.stringify({
            name: "Multi Tester",
            email: "multi@test.se",
            items: [
              { productId: productA.id, quantity: 2 },
              { productId: productB.id, quantity: 3 },
            ],
          }),
        }),
      (res) => res.response.status === 201,
    );

    expect(response.status).toBe(201);
    expect(body.status).toBe("pending");
    expect(body.totalPrice).toBe(expectedTotal);
    orderId = body.orderId;
    customerId = body.customerId;
  });

  test("kitchen receives the order with all of its items", async () => {
    const order = await waitFor(
      async () => {
        const { body } = await api("/api/v1/kitchen/orders");
        return body.orders.find((o: { id: string }) => o.id === orderId);
      },
      (o) => Boolean(o),
    );

    expect(order).toBeDefined();
    expect(order.status).toBe("pending");
    expect(order.items.length).toBe(2);
  });

  test("an illegal status jump is rejected and leaves the ticket pending", async () => {
    // pending -> completed skips two steps and must be refused.
    const rejected = await api(`/api/v1/kitchen/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });
    expect(rejected.response.status).toBe(400);

    // The ticket is unchanged: still pending and still in the active list.
    const { body } = await api("/api/v1/kitchen/orders");
    const order = body.orders.find((o: { id: string }) => o.id === orderId);
    expect(order).toBeDefined();
    expect(order.status).toBe("pending");
  });

  test("the legal transition still succeeds after the rejected one", async () => {
    const ok = await api(`/api/v1/kitchen/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "preparing" }),
    });
    expect(ok.response.status).toBe(200);
    expect(ok.body.order.status).toBe("preparing");
  });
});
