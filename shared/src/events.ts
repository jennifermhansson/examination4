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
//   - PRODUCT_UPSERTED:     emitted by product-service for each product (catalog
//                           snapshot on startup / on demand), so order-service can
//                           keep a local read cache instead of calling it over HTTP.
//   - PRODUCT_DELETED:      emitted by product-service when a product is removed.
//   - PRODUCT_SYNC_REQUESTED: emitted by order-service on startup to ask
//                           product-service to (re)broadcast its catalogue.
export const ROUTING_KEYS = {
  ORDER_CREATED: "order.created",
  ORDER_STATUS_UPDATED: "order.status.updated",
  PRODUCT_UPSERTED: "product.upserted",
  PRODUCT_DELETED: "product.deleted",
  PRODUCT_SYNC_REQUESTED: "product.sync.requested",
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

// A product as broadcast by the product-service. Carries everything the
// order-service needs to price an order, so it never has to call back.
export type ProductSnapshot = {
  id: string;
  name: string;
  description: string | null;
  price: number;
};

// Published once per product whenever the product-service (re)broadcasts its
// catalogue: on startup and in response to a PRODUCT_SYNC_REQUESTED event.
export type ProductUpsertedEvent = {
  type: "product.upserted";
  product: ProductSnapshot;
};

// Published when a product is removed, so caches can drop it.
export type ProductDeletedEvent = {
  type: "product.deleted";
  productId: string;
};

// Published by a service that needs the catalogue (order-service on startup) to
// ask the product-service to rebroadcast every product.
export type ProductSyncRequestedEvent = {
  type: "product.sync.requested";
};

// Union of all events that flow through the exchange.
export type DomainEvent =
  | OrderCreatedEvent
  | OrderStatusUpdatedEvent
  | ProductUpsertedEvent
  | ProductDeletedEvent
  | ProductSyncRequestedEvent;
