import type { ProductFromService } from "./types";

const productServiceUrl =
  process.env.PRODUCT_SERVICE_URL || "http://product-service:3002";

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
