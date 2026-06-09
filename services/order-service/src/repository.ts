import { db } from "./db";
import type { ResolvedOrderItem } from "./order-logic";

export type CustomerRow = {
  id: string;
  username: string;
  email: string;
  role: string;
  password_hash: string;
};

export type OrderRow = {
  id: string;
  customer_id: string;
  status: string;
  total_price: number;
  created_at: string;
};

export async function createCustomer(data: {
  username: string;
  email: string;
  phone: string;
  birthdate: string;
  passwordHash: string;
}) {
  const [customer] = await db`
    INSERT INTO customers (username, email, phone, birthdate, password_hash)
    VALUES (
      ${data.username},
      ${data.email},
      ${data.phone},
      ${data.birthdate},
      ${data.passwordHash}
    )
    RETURNING id, username, email, role
  `;
  return customer;
}

export async function findCustomerByEmail(
  email: string,
): Promise<CustomerRow | null> {
  const [customer] = await db<CustomerRow[]>`
    SELECT id, username, email, role, password_hash
    FROM customers
    WHERE email = ${email}
  `;
  return customer ?? null;
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
