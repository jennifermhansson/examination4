import type { CreateOrderItem, ProductFromService } from "./types";

export type ResolvedOrderItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

// Sum up the order total in minor currency units (e.g. öre): price × quantity.
export function calculateTotalPrice(items: ResolvedOrderItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

// Validate the raw items from the request. Returns an error message string when
// invalid, or null when the items are OK. 
export function validateOrderItems(items: CreateOrderItem[]): string | null {
  if (!items.length) {
    return "Order must contain at least one item";
  }

  for (const item of items) {
    if (item.quantity <= 0) {
      return "Quantity must be greater than zero";
    }
  }

  return null;
}

// Combine the requested items with real product data (name + price) fetched
// from the product-service. Returns null if any product id is unknown, so the
// caller can reject the whole order.
export function resolveOrderItems(
  items: CreateOrderItem[],
  products: Map<string, ProductFromService>,
): ResolvedOrderItem[] | null {
  const resolved: ResolvedOrderItem[] = [];

  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) return null;

    resolved.push({
      productId: item.productId,
      name: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
    });
  }

  return resolved;
}
