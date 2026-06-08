import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import authenticate from "../../auth/authenticate";
import { registerSchema, loginSchema } from "./schema";
import * as customerControllers from "./controller"

export async function customerRoutes(
  httpServer: FastifyInstance,
  opts: FastifyPluginOptions,
) {
  httpServer.route({
    method: "POST",
    url: "/register",
    handler: customerControllers.register,
    schema: registerSchema,
  });

  httpServer.route({
    method: "POST",
    url: "/login",
    handler: customerControllers.login,
    schema: loginSchema,
  });

}

export default customerRoutes;