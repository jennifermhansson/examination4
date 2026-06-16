import { db } from "./db";

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
};

// List every product, alphabetically by name (used to render the menu).
export async function getProducts(): Promise<ProductRow[]> {
  return await db<ProductRow[]>`
    SELECT id, name, description, price
    FROM products
    ORDER BY name
  `;
}

// Fetch one product by id. Returns null if it doesn't exist.
export async function getProductById(id: string): Promise<ProductRow | null> {
  const [product] = await db<ProductRow[]>`
    SELECT id, name, description, price
    FROM products
    WHERE id = ${id}
  `;
  return product ?? null;
}
