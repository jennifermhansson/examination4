import { db } from "../../db/client";

export async function getProducts() {
  const products = await db`
      SELECT * FROM products
          ORDER BY name
`;
  return products;
}
