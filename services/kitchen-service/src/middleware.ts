import type { FastifyReply, FastifyRequest } from "fastify";
import type { TokenPayload } from "./auth";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const user = await request.jwtVerify<TokenPayload>();
    request.user = user;
  } catch {
    return reply.code(401).send({ message: "Unauthorized" });
  }
}

export async function requireKitchen(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (request.user.role !== "kitchen" && request.user.role !== "admin") {
    return reply.code(403).send({ message: "Kitchen access required" });
  }
}
