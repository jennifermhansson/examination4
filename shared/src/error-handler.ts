import { BaseError, InternalError } from "./errors";
import type { FastifyInstance } from "fastify";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request: any, reply: any) => {
    if (error instanceof BaseError) {
      return reply.status(error.statusCode).send(error.toPublicError());
    }

    app.log.error(
      { err: error, method: request.method, url: request.url },
      "Unhandled API error",
    );

    const unknownError = new InternalError("Internal server error", error);
    return reply.status(500).send(unknownError.toPublicError());
  });
}
