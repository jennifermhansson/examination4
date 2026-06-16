import type { ProductFromService } from "./types";

// In-memory read model of the product catalogue, kept up to date from
// product.upserted / product.deleted events. The order-service reads prices
// from here instead of calling the product-service over HTTP, so placing an
// order has no synchronous dependency on another service.
//
// The cache lives only in memory: on startup it is empty and is hydrated by
// asking the product-service to rebroadcast its catalogue (see server.ts).
const products = new Map<string, ProductFromService>();

export function upsertProduct(product: ProductFromService): void {
  products.set(product.id, product);
}

export function deleteProduct(productId: string): void {
  products.delete(productId);
}

export function size(): number {
  return products.size;
}

// Resolve the requested ids against the cache, returning a Map (the shape
// order-logic expects). Unknown ids are simply absent from the map, so the
// caller can detect and reject orders for products we don't know about.
export function getProducts(
  ids: string[],
): Map<string, ProductFromService> {
  const result = new Map<string, ProductFromService>();
  for (const id of ids) {
    const product = products.get(id);
    if (product) result.set(id, product);
  }
  return result;
}
