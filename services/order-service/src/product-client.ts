import type { ProductFromService } from "./types";

const productServiceUrl =
  process.env.PRODUCT_SERVICE_URL || "http://product-service:3002";

// Fetch a single product from the product-service over HTTP.
// Returns null for a 404 (unknown product) and throws on other failures.
export async function fetchProduct(
  productId: string,
): Promise<ProductFromService | null> {
  const response = await fetch(`${productServiceUrl}/products/${productId}`);

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Product service error: ${response.status}`);
  }

  const data = (await response.json()) as { product: ProductFromService };
  return data.product;
}

// Fetch several products and return them as a Map keyed by id, so the caller
// can resolve order items in O(1). Unknown ids are simply left out of the map.
export async function fetchProductsMap(
  productIds: string[],
): Promise<Map<string, ProductFromService>> {
  const map = new Map<string, ProductFromService>();

  for (const id of productIds) {
    const product = await fetchProduct(id);
    if (product) map.set(id, product);
  }

  return map;
}
