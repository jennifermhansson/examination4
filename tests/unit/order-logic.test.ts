import { describe, expect, test } from "bun:test";
import {
  calculateTotalPrice,
  resolveOrderItems,
  validateOrderItems,
} from "../../services/order-service/src/order-logic";

describe("order-logic", () => {
  test("validateOrderItems rejects empty orders", () => {
    expect(validateOrderItems([])).toBe(
      "Order must contain at least one item",
    );
  });

  test("validateOrderItems rejects zero quantity", () => {
    expect(
      validateOrderItems([{ productId: "abc", quantity: 0 }]),
    ).toBe("Quantity must be greater than zero");
  });

  test("calculateTotalPrice sums item prices", () => {
    const total = calculateTotalPrice([
      { productId: "1", name: "Burger", quantity: 2, unitPrice: 7900 },
      { productId: "2", name: "Cola", quantity: 1, unitPrice: 1900 },
    ]);
    expect(total).toBe(17700);
  });

  test("resolveOrderItems returns null for missing product", () => {
    const products = new Map([
      ["1", { id: "1", name: "Burger", description: null, price: 7900 }],
    ]);

    const result = resolveOrderItems(
      [{ productId: "missing", quantity: 1 }],
      products,
    );
    expect(result).toBeNull();
  });

  test("resolveOrderItems maps products to order lines", () => {
    const products = new Map([
      ["1", { id: "1", name: "Burger", description: null, price: 7900 }],
    ]);

    const result = resolveOrderItems(
      [{ productId: "1", quantity: 2 }],
      products,
    );

    expect(result).toEqual([
      { productId: "1", name: "Burger", quantity: 2, unitPrice: 7900 },
    ]);
  });
});
