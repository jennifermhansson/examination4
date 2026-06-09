import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import {
  ROUTING_KEYS,
  type OrderCreatedEvent,
  type OrderStatusUpdatedEvent,
} from "@exam4/shared/src/events";
import { connectRabbit, publishEvent, subscribeToEvents } from "@exam4/shared/src/rabbitmq";
import auth from "./auth";
import { authenticate, requireKitchen } from "./middleware";
import { isValidStatusTransition } from "./kitchen-logic";
import * as repository from "./repository";

const app = fastify({ logger: true });
const port = Number(process.env.PORT) || 3004;
const rabbitUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

await app.register(fastifyCors, { origin: true });
await app.register(auth);

const { channel } = await connectRabbit(rabbitUrl);

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

app.get("/health", async () => ({ status: "ok", service: "kitchen-service" }));

app.get(
  "/kitchen/orders",
  { preHandler: [authenticate, requireKitchen] },
  async (_request, reply) => {
    const orders = await repository.getActiveOrders();
    return reply.send({ orders });
  },
);

app.patch(
  "/kitchen/orders/:id",
  { preHandler: [authenticate, requireKitchen] },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    const allowed = ["preparing", "ready", "completed"];
    if (!allowed.includes(status)) {
      return reply.code(400).send({ message: "Invalid status" });
    }

    const current = await repository.getKitchenOrderById(id);

    if (!current) {
      return reply.code(404).send({ message: "Order not found" });
    }

    if (!isValidStatusTransition(current.status, status)) {
      return reply.code(400).send({
        message: `Cannot transition from ${current.status} to ${status}`,
      });
    }

    const updated = await repository.updateKitchenOrderStatus(id, status);
    if (!updated) {
      return reply.code(404).send({ message: "Order not found" });
    }

    const event: OrderStatusUpdatedEvent = {
      type: "order.status.updated",
      orderId: updated.id,
      customerId: updated.customer_id,
      status: updated.status,
    };

    publishEvent(channel, ROUTING_KEYS.ORDER_STATUS_UPDATED, event);

    return reply.send({ order: updated });
  },
);

await app.listen({ host: "0.0.0.0", port });
console.log(`kitchen-service listening on ${port}`);
