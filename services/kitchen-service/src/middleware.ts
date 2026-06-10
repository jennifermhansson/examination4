import type { FastifyReply, FastifyRequest } from "fastify";
import type { TokenPayload } from "./auth";
import { Unauthorized, Forbidden } from "../../../shared/src/errors";

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  try {
    const user = await request.jwtVerify<TokenPayload>();
    request.user = user;
  } catch {
    throw new Unauthorized();
  }
}

export async function requireKitchen(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  if (request.user.role !== "kitchen") {
    throw new Forbidden("Kitchen access required");
  }
}
