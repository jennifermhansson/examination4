import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import * as repository from "./repository";
import { registerErrorHandler } from "../../../shared/src/error-handler";
import { BadRequest, NotFound } from "../../../shared/src/errors";

const app = fastify({ logger: true });
const port = Number(process.env.PORT) || 3002;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

await app.register(fastifyCors, { origin: true });
registerErrorHandler(app);

app.get("/health", async () => ({ status: "ok", service: "product-service" }));

app.get("/products", async (_request, reply) => {
  const products = await repository.getProducts();
  return reply.send({ products });
});

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
