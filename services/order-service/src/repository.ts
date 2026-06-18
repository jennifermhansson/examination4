// Database access for order-service: customers and orders. A customer is just a
// name + unique email; findOrCreateCustomer reuses an existing one or creates a
// new one so a guest can order with just those fields. createOrderWithItems
// writes the order header plus its line items in one transaction (capturing the
// unit price at order time). updateOrderStatus is driven by order.status.updated
// events from the kitchen. Tagged-template queries are parameterized.
import { db } from "./db";
import type { ResolvedOrderItem } from "./order-logic";

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

export async function findOrCreateCustomer(
  name: string,
  email: string,
): Promise<CustomerRow> {
  const existing = await findCustomerByEmail(email);
  if (existing) return existing;
  return createCustomer(name, email);
}

export async function createOrderWithItems(
  customerId: string,
  totalPrice: number,
  items: ResolvedOrderItem[],
) {
  return await db.begin(async (sql) => {
    const [order] = await sql<OrderRow[]>`
      INSERT INTO orders (customer_id, status, total_price)
      VALUES (${customerId}, 'pending', ${totalPrice})
      RETURNING id, customer_id, status, total_price, created_at
    `;

    if (!order) throw new Error("Failed to create order");

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

export async function updateOrderStatus(orderId: string, status: string) {
  const [order] = await db<OrderRow[]>`
    UPDATE orders
    SET status = ${status}
    WHERE id = ${orderId}
    RETURNING id, customer_id, status, total_price, created_at
  `;
  return order ?? null;
}

export async function getOrderById(orderId: string): Promise<OrderRow | null> {
  const [order] = await db<OrderRow[]>`
    SELECT id, customer_id, status, total_price, created_at
    FROM orders
    WHERE id = ${orderId}
  `;
  return order ?? null;
}

export async function getOrdersByCustomer(customerId: string): Promise<OrderRow[]> {
  return await db<OrderRow[]>`
    SELECT id, customer_id, status, total_price, created_at
    FROM orders
    WHERE customer_id = ${customerId}
    ORDER BY created_at DESC
  `;
}
