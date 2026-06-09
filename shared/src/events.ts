export const EXCHANGE = "exam4.events";

export const ROUTING_KEYS = {
  ORDER_CREATED: "order.created",
  ORDER_STATUS_UPDATED: "order.status.updated",
} as const;

export type OrderItemEvent = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type OrderCreatedEvent = {
  type: "order.created";
  orderId: string;
  customerId: string;
  items: OrderItemEvent[];
  totalPrice: number;
};

export type OrderStatusUpdatedEvent = {
  type: "order.status.updated";
  orderId: string;
  customerId: string;
  status: string;
};

export type DomainEvent = OrderCreatedEvent | OrderStatusUpdatedEvent;
