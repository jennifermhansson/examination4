import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { TokenPayload } from "./types";

const secretKey = process.env.JWT_SECRET_KEY || "dev-secret-key";

declare module "@fastify/jwt" {
  export interface FastifyJWT {
    user: TokenPayload;
  }
}

async function authPlugin(httpServer: FastifyInstance) {
  await httpServer.register(fastifyJwt, { secret: secretKey });
}

export default fp(authPlugin);
