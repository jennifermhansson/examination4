// End-to-end proof that the product cache stays in sync over RabbitMQ. The order
// service does not call product-service per order; it prices orders from a local
// cache built entirely from product.upserted events (broadcast on startup and on
// product.sync.requested). So if an order containing *every* seeded product is
// priced correctly server-side, every product.upserted event must have propagated
// from product-service -> RabbitMQ -> order-service's cache. This covers the
// product.* cache-sync events at the propagation level, complementing the schema
// (contract) tests in tests/unit/events.test.ts.
//
// product.deleted has no public trigger (product-service is read-only over HTTP),
// so it is covered at the contract level only — see docs/TESTING.md.
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

describe("product cache sync e2e", () => {
  beforeAll(async () => {
    const health = await fetch(`${BASE_URL}/api/health`);
    expect(health.ok).toBe(true);
  });

  test("every product.upserted has propagated: a full-catalogue order is priced from the cache", async () => {
    const { body: catalogue } = await api("/api/v1/products");
    const products = catalogue.products as Array<{ id: string; price: number }>;
    expect(products.length).toBeGreaterThan(0);

    const items = products.map((p) => ({ productId: p.id, quantity: 1 }));
    const expectedTotal = products.reduce((sum, p) => sum + p.price, 0);

    // Retry: the order-service cache may still be cold right after a fresh start,
    // which would make pricing reject unknown products with a 400.
    const { response, body } = await waitFor(
      () =>
        api("/api/v1/orders", {
          method: "POST",
          body: JSON.stringify({
            name: "Cache Sync",
            email: "cache-sync@test.se",
            items,
          }),
        }),
      (res) => res.response.status === 201,
    );

    expect(response.status).toBe(201);
    expect(body.totalPrice).toBe(expectedTotal);
  });
});
