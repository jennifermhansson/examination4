import type { FastifyRequest, FastifyReply } from "fastify";
import * as productRepository from "./repository"

export async function getProducts(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const products = await productRepository.getProducts();

  return reply.status(200).send(products);
}