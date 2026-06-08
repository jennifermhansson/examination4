import type { FastifyInstance } from "fastify";
import { BaseError, InternalError, ValidationError } from "../utils/errors";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: any, request, reply) => {
    console.error("========== API ERROR ==========");
    console.error(`${request.method} ${request.url}`);
    console.error("statusCode:", error.statusCode);
    console.error("code:", error.code);
    console.error("message:", error.message);
    console.error("validation:", error.validation);
    console.error("stack:", error.stack);
    console.error("===============================");

    if (error instanceof BaseError) {
      return reply.status(error.statusCode).send(error.toPublicError());
    }

    if (error.validation) {
      const validationError = new ValidationError(
        "Invalid request data",
        error as Error,
      );

      return reply.status(validationError.statusCode).send({
        ...validationError.toPublicError(),
        details: error.validation,
      });
    }

    const unknownError = new InternalError("Unknown error", error as Error);

    return reply.status(unknownError.statusCode).send({
      ...unknownError.toPublicError(),
      details: error.message,
    });
  });
}
