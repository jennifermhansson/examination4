import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import {
  ROUTING_KEYS,
  type OrderCreatedEvent,
  type OrderStatusUpdatedEvent,
} from "@exam4/shared/src/events";
import { connectRabbit, subscribeToEvents } from "@exam4/shared/src/rabbitmq";
import { messageForStatus } from "./notification-logic";
import * as repository from "./repository";
import { registerErrorHandler } from "../../../shared/src/error-handler";
import { BadRequest } from "../../../shared/src/errors";

const app = fastify({ logger: true });
const port = Number(process.env.PORT) || 3005;
const rabbitUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

// Used to reject malformed customer ids before hitting the database.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

await app.register(fastifyCors, { origin: true });
registerErrorHandler(app);

// Connect to RabbitMQ once at startup; this service only consumes events.
const { channel } = await connectRabbit(rabbitUrl);

// CONSUMER: this service listens for BOTH order.created and order.status.updated
// and turns each one into a customer-facing notification row. Its queue is bound
// to both routing keys, so a single handler receives both event types.
await subscribeToEvents(
  channel,
  "notification-service.events",
  [ROUTING_KEYS.ORDER_CREATED, ROUTING_KEYS.ORDER_STATUS_UPDATED],
  async (event) => {
    // order.created → greet the customer with the initial "pending" message.
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

    // Otherwise it's a status update → notify the customer of the new status.
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

// Liveness probe.
app.get("/health", async () => ({ status: "ok", service: "notification-service" }));

// Return a customer's notifications. With authentication removed, the customer
// is identified by the customerId query param (stored client-side after their
// first order) instead of a JWT.
app.get("/notifications", async (request, reply) => {
  const { customerId } = request.query as { customerId?: string };

  if (!customerId || !UUID_REGEX.test(customerId)) {
    throw new BadRequest("customerId query parameter is required");
  }

  const notifications = await repository.getNotificationsByCustomer(customerId);
  return reply.send({ notifications });
});

await app.listen({ host: "0.0.0.0", port });
console.log(`notification-service listening on ${port}`);
