import type { CreateOrderItem, ProductFromService } from "./types";

export type ResolvedOrderItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export function calculateTotalPrice(items: ResolvedOrderItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

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
