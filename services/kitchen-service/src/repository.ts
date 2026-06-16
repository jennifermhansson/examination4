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

// Insert a kitchen ticket from an order.created event. ON CONFLICT (id) DO
// NOTHING makes it idempotent: if the same event is delivered twice we won't
// create a duplicate ticket. Items are stored as JSON in a JSONB column.
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

// The JSONB items column may come back as a parsed object or as a JSON string
// depending on the driver; normalize it to a typed array either way.
function parseItems(raw: unknown): OrderItemEvent[] {
  return typeof raw === "string" ? JSON.parse(raw) : (raw as OrderItemEvent[]);
}

// Fetch one kitchen ticket by id. Returns null if it doesn't exist.
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

// List every ticket that isn't completed yet, oldest first, so the kitchen
// works through orders in the order they arrived.
export async function getActiveOrders(): Promise<KitchenOrderRow[]> {
  const rows = await db`
    SELECT id, customer_id, status, total_price, items, created_at, updated_at
    FROM kitchen_orders
    WHERE status != 'completed'
    ORDER BY created_at ASC
  `;

  return rows.map((row: KitchenOrderRow) => ({ ...row, items: parseItems(row.items) }));
}

// Update a ticket's status and bump updated_at. Returns the updated row, or
// null if the ticket no longer exists.
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
