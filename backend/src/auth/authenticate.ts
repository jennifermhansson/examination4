import type { FastifyReply, FastifyRequest } from "fastify";
import type { TokenPayload } from "../types/auth";


async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  //
  const decoded = await request.jwtVerify<TokenPayload>();

}

export default authenticate;
