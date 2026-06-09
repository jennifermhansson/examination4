import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import bcrypt from "bcryptjs";
import {
  ROUTING_KEYS,
  type OrderCreatedEvent,
  type OrderStatusUpdatedEvent,
} from "@exam4/shared/src/events";
import { connectRabbit, publishEvent, subscribeToEvents } from "@exam4/shared/src/rabbitmq";
import auth from "./auth";
import { authenticate, requireCustomer } from "./middleware";
import * as repository from "./repository";
import * as productClient from "./product-client";
import {
  calculateTotalPrice,
  resolveOrderItems,
  validateOrderItems,
} from "./order-logic";

const app = fastify({ logger: true });
const port = Number(process.env.PORT) || 3003;
const rabbitUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

await app.register(fastifyCors, { origin: true });
await app.register(auth);

const { channel } = await connectRabbit(rabbitUrl);

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

app.get("/health", async () => ({ status: "ok", service: "order-service" }));

app.post("/auth/register", async (request, reply) => {
  const body = request.body as {
    username: string;
    email: string;
    phone: string;
    birthdate: string;
    password: string;
  };

  const passwordHash = await bcrypt.hash(body.password, 12);
  const customer = await repository.createCustomer({
    username: body.username,
    email: body.email,
    phone: body.phone,
    birthdate: body.birthdate,
    passwordHash,
  });

  return reply.code(201).send(customer);
});

app.post("/auth/login", async (request, reply) => {
  const { email, password } = request.body as { email: string; password: string };
  const customer = await repository.findCustomerByEmail(email);

  if (!customer || !(await bcrypt.compare(password, customer.password_hash))) {
    return reply.code(401).send({ message: "Invalid credentials" });
  }

  const token = await reply.jwtSign({
    id: customer.id,
    email: customer.email,
    role: customer.role as "customer" | "kitchen" | "admin",
  });

  return reply.send({
    token,
    customer: {
      id: customer.id,
      username: customer.username,
      email: customer.email,
      role: customer.role,
    },
  });
});

app.post(
  "/orders",
  { preHandler: [authenticate, requireCustomer] },
  async (request, reply) => {
    const { items } = request.body as {
      items: Array<{ productId: string; quantity: number }>;
    };

    const validationError = validateOrderItems(items);
    if (validationError) {
      return reply.code(400).send({ message: validationError });
    }

    const productIds = items.map((i) => i.productId);
    const products = await productClient.fetchProductsMap(productIds);
    const resolvedItems = resolveOrderItems(items, products);

    if (!resolvedItems) {
      return reply.code(400).send({ message: "One or more products not found" });
    }

    const totalPrice = calculateTotalPrice(resolvedItems);
    const order = await repository.createOrderWithItems(
      request.user.id,
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
      status: order.status,
      totalPrice: order.total_price,
    });
  },
);

app.get(
  "/orders",
  { preHandler: [authenticate, requireCustomer] },
  async (request, reply) => {
    const orders = await repository.getOrdersByCustomer(request.user.id);
    return reply.send({ orders });
  },
);

app.get(
  "/orders/:id",
  { preHandler: [authenticate, requireCustomer] },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await repository.getOrderById(id);

    if (!order || order.customer_id !== request.user.id) {
      return reply.code(404).send({ message: "Order not found" });
    }

    return reply.send({ order });
  },
);

await app.listen({ host: "0.0.0.0", port });
console.log(`order-service listening on ${port}`);
