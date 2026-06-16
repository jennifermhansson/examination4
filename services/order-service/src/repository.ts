import { db } from "./db";
import type { ResolvedOrderItem } from "./order-logic";

// A customer row, a customer is just a name (username) and an email.
export type CustomerRow = {
  id: string;
  username: string;
  email: string;
};

export type OrderRow = {
  id: string;
  customer_id: string;
  status: string;
  total_price: number;
  created_at: string;
};

// Look up a customer by their (unique) email. Returns null when none exists.
export async function findCustomerByEmail(
  email: string,
): Promise<CustomerRow | null> {
  const [customer] = await db<CustomerRow[]>`
    SELECT id, username, email
    FROM customers
    WHERE email = ${email}
  `;
  return customer ?? null;
}

// Insert a new customer (name + email) and return the created row.
export async function createCustomer(
  name: string,
  email: string,
): Promise<CustomerRow> {
  const [customer] = await db<CustomerRow[]>`
    INSERT INTO customers (username, email)
    VALUES (${name}, ${email})
    RETURNING id, username, email
  `;
  if (!customer) throw new Error("Failed to create customer");
  return customer;
}

// Find a customer by email, or create one if this email hasn't ordered before.
// This lets a guest place an order just by filling in their name and email:
// returning customers are reused, new ones are created on the fly.
export async function findOrCreateCustomer(
  name: string,
  email: string,
): Promise<CustomerRow> {
  const existing = await findCustomerByEmail(email);
  if (existing) return existing;
  return createCustomer(name, email);
}

// Create an order plus its line items atomically inside one transaction, so a
// failure midway never leaves an order without its items (or vice versa).
export async function createOrderWithItems(
  customerId: string,
  totalPrice: number,
  items: ResolvedOrderItem[],
) {
  return await db.begin(async (sql) => {
    // Insert the order header (status starts as 'pending').
    const [order] = await sql<OrderRow[]>`
      INSERT INTO orders (customer_id, status, total_price)
      VALUES (${customerId}, 'pending', ${totalPrice})
      RETURNING id, customer_id, status, total_price, created_at
    `;

    if (!order) throw new Error("Failed to create order");

    // Insert one row per ordered product, capturing the unit price at order time.
    for (const item of items) {
      await sql`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price)
        VALUES (
          ${order.id},
          ${item.productId},
          ${item.quantity},
          ${item.unitPrice}
        )
      `;
    }

    return order;
  });
}

// Update an order's status (called when an ORDER_STATUS_UPDATED event arrives
// from the kitchen). Returns the updated row, or null if the order is unknown.
export async function updateOrderStatus(orderId: string, status: string) {
  const [order] = await db<OrderRow[]>`
    UPDATE orders
    SET status = ${status}
    WHERE id = ${orderId}
    RETURNING id, customer_id, status, total_price, created_at
  `;
  return order ?? null;
}

// Fetch a single order by id (used by GET /orders/:id). Returns null if missing.
export async function getOrderById(orderId: string): Promise<OrderRow | null> {
  const [order] = await db<OrderRow[]>`
    SELECT id, customer_id, status, total_price, created_at
    FROM orders
    WHERE id = ${orderId}
  `;
  return order ?? null;
}

// List all orders for one customer, newest first (used by GET /orders).
export async function getOrdersByCustomer(customerId: string): Promise<OrderRow[]> {
  return await db<OrderRow[]>`
    SELECT id, customer_id, status, total_price, created_at
    FROM orders
    WHERE customer_id = ${customerId}
    ORDER BY created_at DESC
  `;
}
