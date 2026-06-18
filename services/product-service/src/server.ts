// product-service: owns the product catalogue. Serves it over HTTP (list + get
// one) and broadcasts it over RabbitMQ as one product.upserted event per product
// so order-service can build a local price cache instead of calling us per order.
// It broadcasts on startup and again whenever it receives product.sync.requested
// (which makes cache hydration robust to service startup ordering). HTTP input is
// validated with Zod (the shared error handler turns failures into 400s).
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import {
  ROUTING_KEYS,
  ProductSyncRequestedEventSchema,
  type ProductUpsertedEvent,
} from "@exam4/shared/src/events";
import { uuidSchema } from "@exam4/shared/src/schemas";
import {
  connectRabbit,
  publishEvent,
  subscribeToEvents,
} from "@exam4/shared/src/rabbitmq";
import * as repository from "./repository";
import { registerErrorHandler } from "../../../shared/src/error-handler";
import { NotFound } from "../../../shared/src/errors";

const app = fastify({ logger: true });
const port = Number(process.env.PORT) || 3002;
const rabbitUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

await app.register(fastifyCors, { origin: true });
registerErrorHandler(app);

const { channel } = await connectRabbit(rabbitUrl);

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

await subscribeToEvents(
  channel,
  "product-service.sync",
  [ROUTING_KEYS.PRODUCT_SYNC_REQUESTED],
  ProductSyncRequestedEventSchema,
  async () => {
    console.log("Catalogue resync requested");
    await publishCatalog();
  },
);

await publishCatalog();

app.get("/health", async () => ({ status: "ok", service: "product-service" }));

app.get("/products", async (_request, reply) => {
  const products = await repository.getProducts();
  return reply.send({ products });
});

app.get("/products/:id", async (request, reply) => {
  const { id } = request.params as { id: string };

  uuidSchema.parse(id);

  const product = await repository.getProductById(id);

  if (!product) {
    throw new NotFound("Product not found");
  }

  return reply.send({ product });
});

await app.listen({ host: "0.0.0.0", port });
console.log(`product-service listening on ${port}`);
