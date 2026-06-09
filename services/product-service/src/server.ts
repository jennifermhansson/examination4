import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import * as repository from "./repository";

const app = fastify({ logger: true });
const port = Number(process.env.PORT) || 3002;

await app.register(fastifyCors, { origin: true });

app.get("/health", async () => ({ status: "ok", service: "product-service" }));

app.get("/products", async (_request, reply) => {
  const products = await repository.getProducts();
  return reply.send({ products });
});

app.get("/products/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const product = await repository.getProductById(id);

  if (!product) {
    return reply.code(404).send({ message: "Product not found" });
  }

  return reply.send({ product });
});

await app.listen({ host: "0.0.0.0", port });
console.log(`product-service listening on ${port}`);
