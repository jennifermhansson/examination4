// Unit tests for order-service's in-memory product cache. The cache is module
// state (a Map) hydrated from product.upserted / product.deleted events; order
// pricing reads from it instead of calling product-service over HTTP. The cache
// has no reset hook, so each test uses its own unique ids and asserts relative
// behaviour (size deltas) to stay independent of execution order.
import { describe, expect, test } from "bun:test";
import {
  upsertProduct,
  deleteProduct,
  getProducts,
  size,
} from "../../services/order-service/src/product-cache";
import type { ProductFromService } from "../../services/order-service/src/types";

const product = (id: string): ProductFromService => ({
  id,
  name: `Product ${id}`,
  description: null,
  price: 1000,
});

describe("product-cache", () => {
  test("upsertProduct adds a product and grows the cache by one", () => {
    const before = size();
    upsertProduct(product("pc-add-1"));
    expect(size()).toBe(before + 1);
  });

  test("upsertProduct updates an existing product without growing the cache", () => {
    upsertProduct(product("pc-update-1"));
    const before = size();
    upsertProduct({ ...product("pc-update-1"), price: 5500 });
    expect(size()).toBe(before);
    expect(getProducts(["pc-update-1"]).get("pc-update-1")?.price).toBe(5500);
  });

  test("deleteProduct removes a product and shrinks the cache by one", () => {
    upsertProduct(product("pc-delete-1"));
    const before = size();
    deleteProduct("pc-delete-1");
    expect(size()).toBe(before - 1);
    expect(getProducts(["pc-delete-1"]).has("pc-delete-1")).toBe(false);
  });

  test("getProducts returns only known ids and omits unknown ones", () => {
    upsertProduct(product("pc-get-1"));
    upsertProduct(product("pc-get-2"));

    const result = getProducts(["pc-get-1", "pc-get-2", "pc-unknown"]);

    expect(result.size).toBe(2);
    expect(result.get("pc-get-1")?.name).toBe("Product pc-get-1");
    expect(result.get("pc-get-2")?.name).toBe("Product pc-get-2");
    expect(result.has("pc-unknown")).toBe(false);
  });

  test("getProducts returns an empty map when nothing matches", () => {
    expect(getProducts(["definitely-not-cached"]).size).toBe(0);
  });
});
