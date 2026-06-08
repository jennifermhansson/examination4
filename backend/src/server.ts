import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { db } from "./db/client";
import auth from "./auth";
import { registerErrorHandler } from "./plugins/error-handler";
import customerRoutes from "./modules/customer/route";
import { productRoutes } from "./modules/products/route";

const httpServer = fastify({ logger: true });

async function testDbConnection() {
  try {
    await db`SELECT 1`;
    console.log("Connected to PostgreSQL");
  } catch (err) {
    console.error("Database connection failed", err);
  }
}

const port = Number(process.env.PORT) || 3000;
const host = "0.0.0.0";

registerErrorHandler(httpServer);

// Vi har nu tillsatt en error handler

async function start() {
  await httpServer.register(fastifyCors, { origin: true });

  await httpServer.register(auth);

  await httpServer.register(productRoutes);
  await httpServer.register(customerRoutes);

  await httpServer.listen({ host, port });
  await testDbConnection();
}

start();
