// notification-service: turns order events into customer-facing messages. Its
// queue is bound to both order.created and order.status.updated, so one handler
// receives both: a new order produces the initial "pending" greeting, and each
// status change produces the matching Swedish message (see notification-logic).
// It only consumes events and serves a customer's notifications over HTTP; the
// customer is identified by the customerId query param (no auth). HTTP input is
// validated with Zod (the shared error handler turns failures into 400s).
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import {
  ROUTING_KEYS,
  OrderNotificationEventSchema,
} from "@exam4/shared/src/events";
import { uuidSchema } from "@exam4/shared/src/schemas";
import { connectRabbit, subscribeToEvents } from "@exam4/shared/src/rabbitmq";
import { messageForStatus } from "./notification-logic";
import * as repository from "./repository";
import { registerErrorHandler } from "../../../shared/src/error-handler";

const app = fastify({ logger: true });
const port = Number(process.env.PORT) || 3005;
const rabbitUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

await app.register(fastifyCors, { origin: true });
registerErrorHandler(app);

const { channel } = await connectRabbit(rabbitUrl);

await subscribeToEvents(
  channel,
  "notification-service.events",
  [ROUTING_KEYS.ORDER_CREATED, ROUTING_KEYS.ORDER_STATUS_UPDATED],
  OrderNotificationEventSchema,
  async (event) => {
    if (event.type === "order.created") {
      const message = messageForStatus("pending");
      if (message) {
        await repository.createNotification({
          customerId: event.customerId,
          orderId: event.orderId,
          message,
        });
      }
      console.log(`Notification created for order ${event.orderId}`);
      return;
    }

    const message = messageForStatus(event.status);
    if (message) {
      await repository.createNotification({
        customerId: event.customerId,
        orderId: event.orderId,
        message,
      });
    }
    console.log(`Status notification for order ${event.orderId}: ${event.status}`);
  },
);

app.get("/health", async () => ({ status: "ok", service: "notification-service" }));

app.get("/notifications", async (request, reply) => {
  const { customerId } = request.query as { customerId?: string };

  uuidSchema.parse(customerId);

  const notifications = await repository.getNotificationsByCustomer(customerId!);
  return reply.send({ notifications });
});

await app.listen({ host: "0.0.0.0", port });
console.log(`notification-service listening on ${port}`);
