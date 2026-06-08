import type { FastifyReply, FastifyRequest } from "fastify";
import type { TokenPayload } from "../../types/auth";
import type { RegisterRequest, LoginRequest } from "../../types/http";
import * as customerRepository from "./repository";
/*
Vad är ansvarsområdeet för controllers?

Svar: Controllers är en del av vår HTTP-del, och har som ansvar att validera och plocka ut
indata från HTTP-requesten. Samt även ansvar att returnera en HTTP-respons.
*/
export async function register(
  request: FastifyRequest<{ Body: RegisterRequest }>,
  reply: FastifyReply,
) {
  const customer = await customerRepository.insertOne(request.body);

  return reply.code(201).send({
    message: "Customer created",
    customer,
  });
}

export async function login(
  request: FastifyRequest<{ Body: LoginRequest }>,
  reply: FastifyReply,
) {
  const foundUser = await customerRepository.getByUsername(
    request.body.username,
  );

  if (!foundUser)
    return reply.status(404).send({ message: "Customer not found!" });

  if (foundUser.password !== request.body.password)
    return reply.status(401).send({ message: "Incorrect password!" });

  const tokenPayload: TokenPayload = {
    username: foundUser.username,
    email: foundUser.email,
    role: foundUser.role,
  };

  request.user; // decoded token

  const token = await reply.jwtSign(tokenPayload, {
    expiresIn: "100y",
  });

  return reply.status(200).send({
    token,
    user: foundUser,
  });
}
