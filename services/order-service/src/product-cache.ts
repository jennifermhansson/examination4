// In-memory read model of the product catalogue, kept up to date from
// product.upserted / product.deleted events. order-service prices orders from
// here instead of calling product-service over HTTP, so placing an order has no
// synchronous dependency on another service. It starts empty and is hydrated on
// startup (server.ts asks product-service to rebroadcast). getProducts returns
// only the ids it knows about, so unknown ids are simply absent from the result.
import type { ProductFromService } from "./types";

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
