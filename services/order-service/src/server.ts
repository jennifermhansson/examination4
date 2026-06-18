// order-service: places orders and serves a customer's orders. Prices every
// order server-side from a local product cache (productCache) that it keeps up
// to date from product.upserted/deleted events, so placing an order has no
// synchronous dependency on product-service; on startup it asks for a catalogue
// resync until the cache is hydrated. It consumes order.status.updated to keep
// its own copy of an order's status in sync, and publishes order.created when a
// customer orders. There is no auth: a customer is identified by the customerId
// returned on their first order, and an order you don't own is reported as "not
// found" so other customers' orders aren't leaked. HTTP input is validated with
// Zod schemas; the shared error handler turns failures into 400s.
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import {
  ROUTING_KEYS,
  OrderStatusUpdatedEventSchema,
  ProductCacheEventSchema,
  type OrderCreatedEvent,
} from "@exam4/shared/src/events";
import {
  createOrderSchema,
  uuidSchema,
} from "@exam4/shared/src/schemas";
import { connectRabbit, publishEvent, subscribeToEvents } from "@exam4/shared/src/rabbitmq";
import * as repository from "./repository";
import * as productCache from "./product-cache";
import {
  calculateTotalPrice,
  resolveOrderItems,
  validateOrderItems,
} from "./order-logic";
import { registerErrorHandler } from "../../../shared/src/error-handler";
import { BadRequest, NotFound, ValidationError } from "../../../shared/src/errors";

const app = fastify({ logger: true });
const port = Number(process.env.PORT) || 3003;
const rabbitUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

await app.register(fastifyCors, { origin: true });
registerErrorHandler(app);

const { channel } = await connectRabbit(rabbitUrl);

await subscribeToEvents(
  channel,
  "order-service.status",
  [ROUTING_KEYS.ORDER_STATUS_UPDATED],
  OrderStatusUpdatedEventSchema,
  async (data) => {
    await repository.updateOrderStatus(data.orderId, data.status);
    console.log(`Order ${data.orderId} status updated to ${data.status}`);
  },
);

await subscribeToEvents(
  channel,
  "order-service.products",
  [ROUTING_KEYS.PRODUCT_UPSERTED, ROUTING_KEYS.PRODUCT_DELETED],
  ProductCacheEventSchema,
  async (data) => {
    if (data.type === "product.upserted") {
      productCache.upsertProduct(data.product);
    } else if (data.type === "product.deleted") {
      productCache.deleteProduct(data.productId);
    }
  },
);

function requestProductSync() {
  publishEvent(channel, ROUTING_KEYS.PRODUCT_SYNC_REQUESTED, {
    type: "product.sync.requested",
  });
}

requestProductSync();
let syncAttempts = 0;
const syncInterval = setInterval(() => {
  if (productCache.size() > 0 || syncAttempts >= 30) {
    clearInterval(syncInterval);
    return;
  }
  syncAttempts++;
  requestProductSync();
}, 2000);

app.get("/health", async () => ({ status: "ok", service: "order-service" }));

app.post("/orders", async (request, reply) => {
  const { name, email, items } = createOrderSchema.parse(request.body);

  const validationError = validateOrderItems(items);
  if (validationError) {
    throw new ValidationError(validationError);
  }

  const productIds = items.map((i) => i.productId);
  const products = productCache.getProducts(productIds);
  const resolvedItems = resolveOrderItems(items, products);

  if (!resolvedItems) {
    throw new BadRequest("One or more products not found");
  }

  const totalPrice = calculateTotalPrice(resolvedItems);

  const customer = await repository.findOrCreateCustomer(name, email);

  const order = await repository.createOrderWithItems(
    customer.id,
    totalPrice,
    resolvedItems,
  );

  const event: OrderCreatedEvent = {
    type: "order.created",
    orderId: order.id,
    customerId: order.customer_id,
    items: resolvedItems,
    totalPrice,
  };

  publishEvent(channel, ROUTING_KEYS.ORDER_CREATED, event);

  return reply.code(201).send({
    orderId: order.id,
    customerId: order.customer_id,
    status: order.status,
    totalPrice: order.total_price,
  });
});

app.get("/orders", async (request, reply) => {
  const { customerId } = request.query as { customerId?: string };

  uuidSchema.parse(customerId);

  const orders = await repository.getOrdersByCustomer(customerId!);
  return reply.send({ orders });
});

app.get("/orders/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { customerId } = request.query as { customerId?: string };

  uuidSchema.parse(id);
  uuidSchema.parse(customerId);

  const order = await repository.getOrderById(id);

  if (!order || order.customer_id !== customerId) {
    throw new NotFound("Order not found");
  }

  return reply.send({ order });
});

await app.listen({ host: "0.0.0.0", port });
console.log(`order-service listening on ${port}`);
