// Single Fastify error handler shared by every service. Maps our own BaseError
// subclasses to their status code, turns a Zod .parse() failure from a route
// into a 400 (same public error shape as everything else), and logs anything
// else as an unhandled 500.
import { ZodError } from "zod";
import { BaseError, InternalError, ValidationError } from "./errors";
import type { FastifyInstance } from "fastify";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request: any, reply: any) => {
    if (error instanceof BaseError) {
      return reply.status(error.statusCode).send(error.toPublicError());
    }

    if (error instanceof ZodError) {
      const validationError = new ValidationError("Invalid request data", error);
      return reply
        .status(validationError.statusCode)
        .send(validationError.toPublicError());
    }

    app.log.error(
      { err: error, method: request.method, url: request.url },
      "Unhandled API error",
    );

    const unknownError = new InternalError("Internal server error", error);
    return reply.status(500).send(unknownError.toPublicError());
  });
}
