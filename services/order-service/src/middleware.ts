import type { FastifyReply, FastifyRequest } from "fastify";
import type { TokenPayload } from "./types";
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

export async function requireCustomer(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  if (request.user.role !== "customer") {
    throw new Forbidden("Customer access required");
  }
}
