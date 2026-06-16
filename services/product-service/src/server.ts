import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import {
  ROUTING_KEYS,
  type ProductUpsertedEvent,
} from "@exam4/shared/src/events";
import {
  connectRabbit,
  publishEvent,
  subscribeToEvents,
} from "@exam4/shared/src/rabbitmq";
import * as repository from "./repository";
import { registerErrorHandler } from "../../../shared/src/error-handler";
import { BadRequest, NotFound } from "../../../shared/src/errors";

const app = fastify({ logger: true });
const port = Number(process.env.PORT) || 3002;
const rabbitUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

await app.register(fastifyCors, { origin: true });
registerErrorHandler(app);

// Connect to RabbitMQ and reuse the channel for the service's lifetime.
const { channel } = await connectRabbit(rabbitUrl);

// Broadcast the whole catalogue as one product.upserted event per product.
// This is how order-service builds its local price cache without calling us
// over HTTP. We do it on startup and whenever someone asks for a resync.
async function publishCatalog() {
  const products = await repository.getProducts();
  for (const product of products) {
    const event: ProductUpsertedEvent = {
      type: "product.upserted",
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
      },
    };
    publishEvent(channel, ROUTING_KEYS.PRODUCT_UPSERTED, event);
  }
  console.log(`Published catalogue snapshot (${products.length} products)`);
}

// CONSUMER: a service that needs the catalogue (order-service on startup) sends
// PRODUCT_SYNC_REQUESTED; we answer by rebroadcasting every product. This makes
// cache hydration robust against startup ordering between the two services.
await subscribeToEvents(
  channel,
  "product-service.sync",
  [ROUTING_KEYS.PRODUCT_SYNC_REQUESTED],
  async () => {
    console.log("Catalogue resync requested");
    await publishCatalog();
  },
);

// Send an initial snapshot now that products are seeded and we're connected.
await publishCatalog();

// Liveness probe.
app.get("/health", async () => ({ status: "ok", service: "product-service" }));

// Return the full product catalogue. This is a public, read-only endpoint
app.get("/products", async (_request, reply) => {
  const products = await repository.getProducts();
  return reply.send({ products });
});

// Return a single product by id. Used by the order-service to look up real
// prices/names when an order is placed.
app.get("/products/:id", async (request, reply) => {
  const { id } = request.params as { id: string };

  if (!UUID_REGEX.test(id)) {
    throw new BadRequest("Invalid product id");
  }

  const product = await repository.getProductById(id);

  if (!product) {
    throw new NotFound("Product not found");
  }

  return reply.send({ product });
});

await app.listen({ host: "0.0.0.0", port });
console.log(`product-service listening on ${port}`);
