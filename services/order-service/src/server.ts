import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import {
  ROUTING_KEYS,
  type OrderCreatedEvent,
  type OrderStatusUpdatedEvent,
} from "@exam4/shared/src/events";
import { connectRabbit, publishEvent, subscribeToEvents } from "@exam4/shared/src/rabbitmq";
import * as repository from "./repository";
import * as productClient from "./product-client";
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

// Used to reject obviously malformed ids before hitting the database.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

await app.register(fastifyCors, { origin: true });
registerErrorHandler(app);

// Connect to RabbitMQ once at startup and reuse the channel for the lifetime
// of the service (both for consuming and publishing).
const { channel } = await connectRabbit(rabbitUrl);

// CONSUMER: listen for status changes coming from the kitchen and keep this
// service's own copy of the order's status in sync.
await subscribeToEvents(
  channel,
  "order-service.status",
  [ROUTING_KEYS.ORDER_STATUS_UPDATED],
  async (event) => {
    const data = event as OrderStatusUpdatedEvent;
    await repository.updateOrderStatus(data.orderId, data.status);
    console.log(`Order ${data.orderId} status updated to ${data.status}`);
  },
);

// Liveness probe used by the gateway / other services.
app.get("/health", async () => ({ status: "ok", service: "order-service" }));

// Place an order. There is no login anymore: the customer simply provides their
// name and email in the order form. We find-or-create the customer by email and
// then create the order linked to them, all in one request.
app.post("/orders", async (request, reply) => {
  const { name, email, items } = request.body as {
    name: string;
    email: string;
    items: Array<{ productId: string; quantity: number }>;
  };

  // The customer identity now comes from the form instead of a JWT.
  if (!name || !email) {
    throw new BadRequest("name and email are required");
  }

  // Reject empty carts / non-positive quantities before doing any DB work.
  const validationError = validateOrderItems(items);
  if (validationError) {
    throw new ValidationError(validationError);
  }

  // Look up the real products so prices/names come from the source of truth
  // (the product-service) rather than trusting the client.
  const productIds = items.map((i) => i.productId);
  const products = await productClient.fetchProductsMap(productIds);
  const resolvedItems = resolveOrderItems(items, products);

  if (!resolvedItems) {
    throw new BadRequest("One or more products not found");
  }

  const totalPrice = calculateTotalPrice(resolvedItems);

  // Reuse an existing customer (same email) or create a new one.
  const customer = await repository.findOrCreateCustomer(name, email);

  const order = await repository.createOrderWithItems(
    customer.id,
    totalPrice,
    resolvedItems,
  );

  // PUBLISH: announce the new order so the kitchen can prepare it and the
  // notification-service can inform the customer.
  const event: OrderCreatedEvent = {
    type: "order.created",
    orderId: order.id,
    customerId: order.customer_id,
    items: resolvedItems,
    totalPrice,
  };

  publishEvent(channel, ROUTING_KEYS.ORDER_CREATED, event);

  // Return the customerId so the frontend can store it and later fetch this
  // customer's orders and notifications (the replacement for a login session).
  return reply.code(201).send({
    orderId: order.id,
    customerId: order.customer_id,
    status: order.status,
    totalPrice: order.total_price,
  });
});

// List a customer's orders. The customer is identified by the customerId query
// param (saved client-side after their first order) instead of a token.
app.get("/orders", async (request, reply) => {
  const { customerId } = request.query as { customerId?: string };

  if (!customerId || !UUID_REGEX.test(customerId)) {
    throw new BadRequest("customerId query parameter is required");
  }

  const orders = await repository.getOrdersByCustomer(customerId);
  return reply.send({ orders });
});

// Fetch a single order, but only if it belongs to the given customerId. This
// keeps the previous "you can only see your own order" behaviour without auth.
app.get("/orders/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { customerId } = request.query as { customerId?: string };

  if (!UUID_REGEX.test(id)) {
    throw new BadRequest("Invalid order id");
  }

  if (!customerId || !UUID_REGEX.test(customerId)) {
    throw new BadRequest("customerId query parameter is required");
  }

  const order = await repository.getOrderById(id);

  // Treat "not yours" the same as "not found" so we don't leak other orders.
  if (!order || order.customer_id !== customerId) {
    throw new NotFound("Order not found");
  }

  return reply.send({ order });
});

await app.listen({ host: "0.0.0.0", port });
console.log(`order-service listening on ${port}`);
