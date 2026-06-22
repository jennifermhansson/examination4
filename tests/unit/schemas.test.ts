// Unit tests for the HTTP request contracts (Zod schemas) that guard the public
// API boundary. These run with no stack: they prove the schema accepts valid
// input and rejects malformed input before any business logic or DB call runs.
import { describe, expect, test } from "bun:test";
import {
  createOrderSchema,
  kitchenStatusSchema,
  uuidSchema,
} from "../../shared/src/schemas";

describe("createOrderSchema", () => {
  const valid = {
    name: "Alice",
    email: "alice@test.se",
    items: [{ productId: "p1", quantity: 2 }],
  };

  test("accepts a well-formed order", () => {
    expect(createOrderSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects a missing/empty name", () => {
    expect(createOrderSchema.safeParse({ ...valid, name: "" }).success).toBe(
      false,
    );
  });

  test("rejects an invalid email", () => {
    expect(
      createOrderSchema.safeParse({ ...valid, email: "not-an-email" }).success,
    ).toBe(false);
  });

  test("rejects a fractional quantity", () => {
    expect(
      createOrderSchema.safeParse({
        ...valid,
        items: [{ productId: "p1", quantity: 1.5 }],
      }).success,
    ).toBe(false);
  });

  test("rejects a zero or negative quantity", () => {
    expect(
      createOrderSchema.safeParse({
        ...valid,
        items: [{ productId: "p1", quantity: 0 }],
      }).success,
    ).toBe(false);
    expect(
      createOrderSchema.safeParse({
        ...valid,
        items: [{ productId: "p1", quantity: -1 }],
      }).success,
    ).toBe(false);
  });
});

describe("kitchenStatusSchema", () => {
  test("accepts a known status", () => {
    expect(kitchenStatusSchema.safeParse({ status: "preparing" }).success).toBe(
      true,
    );
  });

  test("rejects an unknown status value", () => {
    expect(kitchenStatusSchema.safeParse({ status: "flying" }).success).toBe(
      false,
    );
  });
});

describe("uuidSchema", () => {
  test("accepts a uuid and rejects a non-uuid", () => {
    expect(
      uuidSchema.safeParse("00000000-0000-0000-0000-000000000000").success,
    ).toBe(true);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});
