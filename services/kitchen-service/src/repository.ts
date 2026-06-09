import { db } from "./db";
import type { OrderItemEvent } from "@exam4/shared/src/events";

export type KitchenOrderRow = {
  id: string;
  customer_id: string;
  status: string;
  total_price: number;
  items: OrderItemEvent[];
  created_at: string;
  updated_at: string;
};

export async function upsertKitchenOrder(data: {
  orderId: string;
  customerId: string;
  totalPrice: number;
  items: OrderItemEvent[];
}) {
  await db`
    INSERT INTO kitchen_orders (id, customer_id, status, total_price, items)
    VALUES (
      ${data.orderId},
      ${data.customerId},
      'pending',
      ${data.totalPrice},
      ${JSON.stringify(data.items)}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

function parseItems(raw: unknown): OrderItemEvent[] {
  return typeof raw === "string" ? JSON.parse(raw) : (raw as OrderItemEvent[]);
}

export async function getKitchenOrderById(
  orderId: string,
): Promise<KitchenOrderRow | null> {
  const [row] = await db`
    SELECT id, customer_id, status, total_price, items, created_at, updated_at
    FROM kitchen_orders
    WHERE id = ${orderId}
  `;

  if (!row) return null;

  return { ...row, items: parseItems(row.items) };
}

export async function getActiveOrders(): Promise<KitchenOrderRow[]> {
  const rows = await db`
    SELECT id, customer_id, status, total_price, items, created_at, updated_at
    FROM kitchen_orders
    WHERE status NOT IN ('ready', 'completed')
    ORDER BY created_at ASC
  `;

  return rows.map((row) => ({ ...row, items: parseItems(row.items) }));
}

export async function updateKitchenOrderStatus(
  orderId: string,
  status: string,
): Promise<KitchenOrderRow | null> {
  const [row] = await db`
    UPDATE kitchen_orders
    SET status = ${status}, updated_at = now()
    WHERE id = ${orderId}
    RETURNING id, customer_id, status, total_price, items, created_at, updated_at
  `;

  if (!row) return null;

  return { ...row, items: parseItems(row.items) };
}
