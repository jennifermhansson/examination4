import { db } from "./db";

export type NotificationRow = {
  id: string;
  customer_id: string;
  order_id: string | null;
  message: string;
  read: boolean;
  created_at: string;
};

export async function createNotification(data: {
  customerId: string;
  orderId: string;
  message: string;
}) {
  const [notification] = await db<NotificationRow[]>`
    INSERT INTO notifications (customer_id, order_id, message)
    VALUES (${data.customerId}, ${data.orderId}, ${data.message})
    RETURNING id, customer_id, order_id, message, read, created_at
  `;
  return notification;
}

export async function getNotificationsByCustomer(
  customerId: string,
): Promise<NotificationRow[]> {
  return await db<NotificationRow[]>`
    SELECT id, customer_id, order_id, message, read, created_at
    FROM notifications
    WHERE customer_id = ${customerId}
    ORDER BY created_at DESC
  `;
}
