import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import {
  ROUTING_KEYS,
  type OrderCreatedEvent,
  type OrderStatusUpdatedEvent,
} from "@exam4/shared/src/events";
import { connectRabbit, publishEvent, subscribeToEvents } from "@exam4/shared/src/rabbitmq";
import { isValidStatusTransition } from "./kitchen-logic";
import * as repository from "./repository";
import { registerErrorHandler } from "../../../shared/src/error-handler";
import { BadRequest, NotFound, ValidationError } from "../../../shared/src/errors";

const app = fastify({ logger: true });
const port = Number(process.env.PORT) || 3004;
const rabbitUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

// Used to reject obviously malformed ids before hitting the database.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

await app.register(fastifyCors, { origin: true });
registerErrorHandler(app);

// Connect to RabbitMQ once at startup and reuse the channel for consuming and publishing.
const { channel } = await connectRabbit(rabbitUrl);

// CONSUMER: when the order-service publishes a new order, store it as a kitchen
// ticket so the kitchen staff can see and work on it. upsert makes this safe to
// process more than once (e.g. if the same event is redelivered).
await subscribeToEvents(
  channel,
  "kitchen-service.orders",
  [ROUTING_KEYS.ORDER_CREATED],
  async (event) => {
    const data = event as OrderCreatedEvent;
    await repository.upsertKitchenOrder({
      orderId: data.orderId,
      customerId: data.customerId,
      totalPrice: data.totalPrice,
      items: data.items,
    });
    console.log(`Kitchen received order ${data.orderId}`);
  },
);

// Liveness probe.
app.get("/health", async () => ({ status: "ok", service: "kitchen-service" }));

// List all active (not yet completed) kitchen tickets for the kitchen screen.
// Authentication was removed, so this endpoint is now open.
app.get("/kitchen/orders", async (_request, reply) => {
  const orders = await repository.getActiveOrders();
  return reply.send({ orders });
});

// Advance an order to its next status (preparing → ready → completed).
// Open endpoint (no auth). The status transition is validated so the kitchen
// can't, for example, jump straight from pending to completed.
app.patch("/kitchen/orders/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { status } = request.body as { status: string };

  if (!UUID_REGEX.test(id)) {
    throw new BadRequest("Invalid order id");
  }

  const allowed = ["preparing", "ready", "completed"];
  if (!allowed.includes(status)) {
    throw new ValidationError("Invalid status");
  }

  const current = await repository.getKitchenOrderById(id);

  if (!current) {
    throw new NotFound("Order not found");
  }

  // Enforce the allowed status flow (see kitchen-logic).
  if (!isValidStatusTransition(current.status, status)) {
    throw new BadRequest(`Cannot transition from ${current.status} to ${status}`);
  }

  const updated = await repository.updateKitchenOrderStatus(id, status);
  if (!updated) {
    throw new NotFound("Order not found");
  }

  // PUBLISH: tell the rest of the system the status changed, so the
  // order-service updates its copy and the notification-service notifies the customer.
  const event: OrderStatusUpdatedEvent = {
    type: "order.status.updated",
    orderId: updated.id,
    customerId: updated.customer_id,
    status: updated.status,
  };

  publishEvent(channel, ROUTING_KEYS.ORDER_STATUS_UPDATED, event);

  return reply.send({ order: updated });
});

await app.listen({ host: "0.0.0.0", port });
console.log(`kitchen-service listening on ${port}`);
