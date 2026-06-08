import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import fp from "fastify-plugin";
import type { TokenPayload } from "../types/auth";

const secretKey = process.env.JWT_SECRET_KEY;

declare module "@fastify/jwt" {
  export interface FastifyJWT {
    user: TokenPayload;
  }
}

async function auth(
  httpServer: FastifyInstance,
  options: FastifyPluginOptions,
) {
  if (!secretKey) throw new Error("Provide JWT_SECRET_KEY env!");

  await httpServer.register(fastifyJwt, {
    secret: secretKey,
  });
}

// Genom att omsluta vår export med en fastifyPlugin så kommer vår kod i kapseln ovan att
// appliceras på samtliga kapslar.
export default fp(auth);
