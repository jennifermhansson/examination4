import { describe, expect, test } from "bun:test";
import {
  OrderCreatedEventSchema,
  OrderStatusUpdatedEventSchema,
  ProductUpsertedEventSchema,
  ProductDeletedEventSchema,
  ProductSyncRequestedEventSchema,
  ProductCacheEventSchema,
  OrderNotificationEventSchema,
} from "../../shared/src/events";
import {
  createOrderSchema,
  kitchenStatusSchema,
  uuidSchema,
} from "../../shared/src/schemas";

// These are "contract" tests: they check the Zod schemas that describe the
// data crossing our boundaries. Event *propagation* (publish -> consume over
// RabbitMQ) is covered by the full e2e flow; here we only verify the shapes:
// a valid payload parses, an invalid one is rejected. `.parse()` throws on
// invalid input, so we assert with toThrow().

const UUID = "00000000-0000-0000-0000-000000000000";

describe("event schemas", () => {
  test("order.created accepts a valid event", () => {
    const event = {
      type: "order.created",
      orderId: UUID,
      customerId: UUID,
      items: [{ productId: UUID, name: "Cheeseburger", quantity: 2, unitPrice: 7900 }],
      totalPrice: 15800,
    };
    expect(() => OrderCreatedEventSchema.parse(event)).not.toThrow();
  });

  test("order.created rejects a missing field", () => {
    const event = { type: "order.created", orderId: UUID }; // no customerId/items/totalPrice
    expect(() => OrderCreatedEventSchema.parse(event)).toThrow();
  });

  test("order.created rejects a wrong-typed field", () => {
    const event = {
      type: "order.created",
      orderId: UUID,
      customerId: UUID,
      items: [],
      totalPrice: "lots", // should be a number
    };
    expect(() => OrderCreatedEventSchema.parse(event)).toThrow();
  });

  test("order.status.updated accepts a valid event", () => {
    const event = {
      type: "order.status.updated",
      orderId: UUID,
      customerId: UUID,
      status: "ready",
    };
    expect(() => OrderStatusUpdatedEventSchema.parse(event)).not.toThrow();
  });

  test("product.upserted accepts a valid event (description may be null)", () => {
    const event = {
      type: "product.upserted",
      product: { id: UUID, name: "Cola", description: null, price: 1900 },
    };
    expect(() => ProductUpsertedEventSchema.parse(event)).not.toThrow();
  });

  test("product.deleted accepts a valid event", () => {
    expect(() =>
      ProductDeletedEventSchema.parse({ type: "product.deleted", productId: UUID }),
    ).not.toThrow();
  });

  test("product.sync.requested accepts a valid event", () => {
    expect(() =>
      ProductSyncRequestedEventSchema.parse({ type: "product.sync.requested" }),
    ).not.toThrow();
  });
});

describe("event unions", () => {
  test("product cache union accepts both upserted and deleted", () => {
    expect(() =>
      ProductCacheEventSchema.parse({
        type: "product.upserted",
        product: { id: UUID, name: "Fries", description: null, price: 2900 },
      }),
    ).not.toThrow();
    expect(() =>
      ProductCacheEventSchema.parse({ type: "product.deleted", productId: UUID }),
    ).not.toThrow();
  });

  test("product cache union rejects a foreign event type", () => {
    expect(() =>
      ProductCacheEventSchema.parse({
        type: "order.created",
        orderId: UUID,
        customerId: UUID,
        items: [],
        totalPrice: 0,
      }),
    ).toThrow();
  });

  test("notification union accepts created and status.updated", () => {
    expect(() =>
      OrderNotificationEventSchema.parse({
        type: "order.created",
        orderId: UUID,
        customerId: UUID,
        items: [],
        totalPrice: 0,
      }),
    ).not.toThrow();
    expect(() =>
      OrderNotificationEventSchema.parse({
        type: "order.status.updated",
        orderId: UUID,
        customerId: UUID,
        status: "preparing",
      }),
    ).not.toThrow();
  });
});

describe("request schemas", () => {
  test("createOrder accepts a valid body", () => {
    const body = {
      name: "Alice",
      email: "alice@test.se",
      items: [{ productId: UUID, quantity: 1 }],
    };
    expect(() => createOrderSchema.parse(body)).not.toThrow();
  });

  test("createOrder rejects a missing name", () => {
    const body = { email: "alice@test.se", items: [{ productId: UUID, quantity: 1 }] };
    expect(() => createOrderSchema.parse(body)).toThrow();
  });

  test("createOrder rejects an invalid email", () => {
    const body = { name: "Alice", email: "not-an-email", items: [] };
    expect(() => createOrderSchema.parse(body)).toThrow();
  });

  test("kitchenStatus accepts a settable status", () => {
    expect(() => kitchenStatusSchema.parse({ status: "preparing" })).not.toThrow();
  });

  test("kitchenStatus rejects an unknown status", () => {
    expect(() => kitchenStatusSchema.parse({ status: "pending" })).toThrow();
  });

  test("uuid accepts a valid UUID and rejects junk / undefined", () => {
    expect(() => uuidSchema.parse(UUID)).not.toThrow();
    expect(() => uuidSchema.parse("not-a-uuid")).toThrow();
    expect(() => uuidSchema.parse(undefined)).toThrow();
  });
});
