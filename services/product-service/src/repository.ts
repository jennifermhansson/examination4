import { db } from "./db";

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
};

export async function getProducts(): Promise<ProductRow[]> {
  return await db<ProductRow[]>`
    SELECT id, name, description, price
    FROM products
    ORDER BY name
  `;
}

export async function getProductById(id: string): Promise<ProductRow | null> {
  const [product] = await db<ProductRow[]>`
    SELECT id, name, description, price
    FROM products
    WHERE id = ${id}
  `;
  return product ?? null;
}
