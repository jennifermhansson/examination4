import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import * as productControllers from "./controller"

export async function productRoutes(
    httpServer: FastifyInstance,
    opts: FastifyPluginOptions,
) {
    httpServer.route({
        method: "GET",
        url: "/products",
        handler: productControllers.getProducts,
    })
}