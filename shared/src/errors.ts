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

export class Unauthorized extends BaseError {
  statusCode = 401;
  constructor(message = "Unauthorized", full_error?: unknown) {
    super(message, full_error);
  }
}

export class Forbidden extends BaseError {
  statusCode = 403;
  constructor(message = "Forbidden", full_error?: unknown) {
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
