// The contract for everything that flows over RabbitMQ. EXCHANGE is the single
// topic exchange; ROUTING_KEYS are the "topics" publishers tag messages with and
// consumers bind their queues to. Each event is described once as a Zod schema
// and its TypeScript type is derived via z.infer, so the runtime check and the
// compile-time type can't drift; consumers validate against these schemas before
// handling a message. The discriminated unions are for queues bound to more than
// one routing key (their handler can receive more than one event type):
//   - order.created            order placed (order-service) -> kitchen + notifications
//   - order.status.updated     kitchen changed status -> order-service + notifications
//   - product.upserted         product-service (re)broadcasts a product -> order cache
//   - product.deleted          product removed -> caches drop it
//   - product.sync.requested   order-service asks product-service to rebroadcast
import { z } from "zod";

export const EXCHANGE = "exam4.events";

export const ROUTING_KEYS = {
  ORDER_CREATED: "order.created",
  ORDER_STATUS_UPDATED: "order.status.updated",
  PRODUCT_UPSERTED: "product.upserted",
  PRODUCT_DELETED: "product.deleted",
  PRODUCT_SYNC_REQUESTED: "product.sync.requested",
} as const;

export const OrderItemEventSchema = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
});
export type OrderItemEvent = z.infer<typeof OrderItemEventSchema>;

export const OrderCreatedEventSchema = z.object({
  type: z.literal("order.created"),
  orderId: z.string(),
  customerId: z.string(),
  items: z.array(OrderItemEventSchema),
  totalPrice: z.number(),
});
export type OrderCreatedEvent = z.infer<typeof OrderCreatedEventSchema>;

export const OrderStatusUpdatedEventSchema = z.object({
  type: z.literal("order.status.updated"),
  orderId: z.string(),
  customerId: z.string(),
  status: z.string(),
});
export type OrderStatusUpdatedEvent = z.infer<typeof OrderStatusUpdatedEventSchema>;

export const ProductSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
});
export type ProductSnapshot = z.infer<typeof ProductSnapshotSchema>;

export const ProductUpsertedEventSchema = z.object({
  type: z.literal("product.upserted"),
  product: ProductSnapshotSchema,
});
export type ProductUpsertedEvent = z.infer<typeof ProductUpsertedEventSchema>;

export const ProductDeletedEventSchema = z.object({
  type: z.literal("product.deleted"),
  productId: z.string(),
});
export type ProductDeletedEvent = z.infer<typeof ProductDeletedEventSchema>;

export const ProductSyncRequestedEventSchema = z.object({
  type: z.literal("product.sync.requested"),
});
export type ProductSyncRequestedEvent = z.infer<typeof ProductSyncRequestedEventSchema>;

export const DomainEventSchema = z.discriminatedUnion("type", [
  OrderCreatedEventSchema,
  OrderStatusUpdatedEventSchema,
  ProductUpsertedEventSchema,
  ProductDeletedEventSchema,
  ProductSyncRequestedEventSchema,
]);
export type DomainEvent = z.infer<typeof DomainEventSchema>;

export const ProductCacheEventSchema = z.discriminatedUnion("type", [
  ProductUpsertedEventSchema,
  ProductDeletedEventSchema,
]);
export type ProductCacheEvent = z.infer<typeof ProductCacheEventSchema>;

export const OrderNotificationEventSchema = z.discriminatedUnion("type", [
  OrderCreatedEventSchema,
  OrderStatusUpdatedEventSchema,
]);
export type OrderNotificationEvent = z.infer<typeof OrderNotificationEventSchema>;
