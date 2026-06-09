import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import {
  ROUTING_KEYS,
  type OrderCreatedEvent,
  type OrderStatusUpdatedEvent,
} from "@exam4/shared/src/events";
import { connectRabbit, subscribeToEvents } from "@exam4/shared/src/rabbitmq";
import auth from "./auth";
import { authenticate, requireCustomer } from "./middleware";
import { messageForStatus } from "./notification-logic";
import * as repository from "./repository";

const app = fastify({ logger: true });
const port = Number(process.env.PORT) || 3005;
const rabbitUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

await app.register(fastifyCors, { origin: true });
await app.register(auth);

const { channel } = await connectRabbit(rabbitUrl);

await subscribeToEvents(
  channel,
  "notification-service.events",
  [ROUTING_KEYS.ORDER_CREATED, ROUTING_KEYS.ORDER_STATUS_UPDATED],
  async (event) => {
    if ((event as OrderCreatedEvent).type === "order.created") {
      const data = event as OrderCreatedEvent;
      const message = messageForStatus("pending");
      if (message) {
        await repository.createNotification({
          customerId: data.customerId,
          orderId: data.orderId,
          message,
        });
      }
      console.log(`Notification created for order ${data.orderId}`);
      return;
    }

    const data = event as OrderStatusUpdatedEvent;
    const message = messageForStatus(data.status);
    if (message) {
      await repository.createNotification({
        customerId: data.customerId,
        orderId: data.orderId,
        message,
      });
    }
    console.log(`Status notification for order ${data.orderId}: ${data.status}`);
  },
);

app.get("/health", async () => ({ status: "ok", service: "notification-service" }));

app.get(
  "/notifications",
  { preHandler: [authenticate, requireCustomer] },
  async (request, reply) => {
    const notifications = await repository.getNotificationsByCustomer(
      request.user.id,
    );
    return reply.send({ notifications });
  },
);

await app.listen({ host: "0.0.0.0", port });
console.log(`notification-service listening on ${port}`);
