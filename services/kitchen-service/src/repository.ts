// Database access for kitchen-service: kitchen tickets. upsertKitchenOrder
// creates a ticket from an order.created event and is idempotent (ON CONFLICT DO
// NOTHING), so a redelivered event won't duplicate it; items are stored in a
// JSONB column. getActiveOrders lists not-yet-completed tickets oldest-first.
// updateKitchenOrderStatus advances a ticket and bumps updated_at. parseItems
// normalizes the JSONB column, which the driver may return as object or string.
import type { OrderItemEvent } from "../../../shared/src/events";
import { db } from "./db";

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
    WHERE status != 'completed'
    ORDER BY created_at ASC
  `;

  return rows.map((row: KitchenOrderRow) => ({ ...row, items: parseItems(row.items) }));
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
