// Shared error types. BaseError carries an HTTP status code and a toPublicError()
// that produces the JSON shape sent to clients ({ success, code, message }); the
// subclasses are the concrete HTTP errors services throw. registerErrorHandler
// (error-handler.ts) turns these into responses.
export abstract class BaseError extends Error {
  abstract statusCode: number;
  full_error: unknown;

  constructor(message: string, full_error?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.full_error = full_error;
  }

  toPublicError() {
    return {
      success: false,
      code: this.statusCode,
      message: this.message,
    };
  }
}

export class BadRequest extends BaseError {
  statusCode = 400;
  constructor(message = "Bad request", full_error?: unknown) {
    super(message, full_error);
  }
}

export class NotFound extends BaseError {
  statusCode = 404;
  constructor(message = "Not found", full_error?: unknown) {
    super(message, full_error);
  }
}

export class InternalError extends BaseError {
  statusCode = 500;
  constructor(message = "Internal server error", full_error?: unknown) {
    super(message, full_error);
  }
}

export class ValidationError extends BaseError {
  statusCode = 400;
  constructor(message = "Invalid request data", full_error?: unknown) {
    super(message, full_error);
  }
}
