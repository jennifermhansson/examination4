// Name of the single RabbitMQ topic exchange that every service publishes to
// and subscribes from. A topic exchange routes a message to queues based on
// the message's routing key, so different services can listen for only the
// event types they care about.
export const EXCHANGE = "exam4.events";

// Routing keys are the "topics" used when publishing. A publisher tags each
// message with one of these keys; a consumer binds its queue to the keys it
// wants to receive.
//   - ORDER_CREATED:        emitted by order-service when a new order is placed.
//   - ORDER_STATUS_UPDATED: emitted by kitchen-service when an order's status changes.
export const ROUTING_KEYS = {
  ORDER_CREATED: "order.created",
  ORDER_STATUS_UPDATED: "order.status.updated",
} as const;

// A single line item inside an order, carried in the ORDER_CREATED event so
// downstream services (kitchen, notifications) don't need to call back to the
// product-service.
export type OrderItemEvent = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

// Published when a customer places an order. The kitchen-service uses it to
// create a kitchen ticket; the notification-service uses it to notify the customer.
export type OrderCreatedEvent = {
  type: "order.created";
  orderId: string;
  customerId: string;
  items: OrderItemEvent[];
  totalPrice: number;
};

// Published when the kitchen changes an order's status. The order-service uses
// it to update its own copy of the order; the notification-service notifies the customer.
export type OrderStatusUpdatedEvent = {
  type: "order.status.updated";
  orderId: string;
  customerId: string;
  status: string;
};

// Union of all events that flow through the exchange.
export type DomainEvent = OrderCreatedEvent | OrderStatusUpdatedEvent;
