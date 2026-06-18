// kitchen-service: the kitchen screen. Consumes order.created to store each new
// order as a kitchen ticket (idempotent upsert, so a redelivered event is safe),
// lists active (not-completed) tickets, and advances a ticket one step along the
// allowed flow pending -> preparing -> ready -> completed (invalid jumps are
// rejected via kitchen-logic). Each status change publishes order.status.updated
// so order-service and notification-service can react. No auth. HTTP input is
// validated with Zod schemas (the shared error handler turns failures into 400s).
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import {
  ROUTING_KEYS,
  OrderCreatedEventSchema,
  type OrderStatusUpdatedEvent,
} from "@exam4/shared/src/events";
import {
  kitchenStatusSchema,
  uuidSchema,
} from "@exam4/shared/src/schemas";
import { connectRabbit, publishEvent, subscribeToEvents } from "@exam4/shared/src/rabbitmq";
import { isValidStatusTransition } from "./kitchen-logic";
import * as repository from "./repository";
import { registerErrorHandler } from "../../../shared/src/error-handler";
import { BadRequest, NotFound } from "../../../shared/src/errors";

const app = fastify({ logger: true });
const port = Number(process.env.PORT) || 3004;
const rabbitUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

await app.register(fastifyCors, { origin: true });
registerErrorHandler(app);

const { channel } = await connectRabbit(rabbitUrl);

await subscribeToEvents(
  channel,
  "kitchen-service.orders",
  [ROUTING_KEYS.ORDER_CREATED],
  OrderCreatedEventSchema,
  async (data) => {
    await repository.upsertKitchenOrder({
      orderId: data.orderId,
      customerId: data.customerId,
      totalPrice: data.totalPrice,
      items: data.items,
    });
    console.log(`Kitchen received order ${data.orderId}`);
  },
);

app.get("/health", async () => ({ status: "ok", service: "kitchen-service" }));

app.get("/kitchen/orders", async (_request, reply) => {
  const orders = await repository.getActiveOrders();
  return reply.send({ orders });
});

app.patch("/kitchen/orders/:id", async (request, reply) => {
  const { id } = request.params as { id: string };

  uuidSchema.parse(id);
  const { status } = kitchenStatusSchema.parse(request.body);

  const current = await repository.getKitchenOrderById(id);

  if (!current) {
    throw new NotFound("Order not found");
  }

  if (!isValidStatusTransition(current.status, status)) {
    throw new BadRequest(`Cannot transition from ${current.status} to ${status}`);
  }

  const updated = await repository.updateKitchenOrderStatus(id, status);
  if (!updated) {
    throw new NotFound("Order not found");
  }

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
