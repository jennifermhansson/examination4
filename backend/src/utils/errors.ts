
export abstract class BaseError extends Error {
    abstract statusCode: number
    full_error: unknown
    params: Record<string, any>

    constructor(message: string, params = {}, full_error = {}) {
        super(message)
        this.params = params
        this.full_error = full_error
    }
    toPublicError() {
        return {
            success: false,
            code: this.statusCode,
            message: this.message
        }
    }
}

export class BadRequest extends BaseError {
    statusCode: number = 400

    constructor(
        message: string = "Invalid request",
        full_error: {}    
    ) {
        super(message, full_error)
    }
}

export class NotFound extends BaseError {
    statusCode: number = 404

    constructor(
        message: string = "Not found",
        full_error: {}
    ) {
        super(message, full_error)
    }
}

export class Unauthorized extends BaseError {
    statusCode: number = 401

    constructor(
        message: string = "You are not authorized",
        full_error: {}
    ) {
        super(message, full_error)
    }
}

export class InternalError extends BaseError {
    statusCode: number = 500

    constructor(
        message: string = "Internal Server Error",
        full_error: {}    
    ) {
        super(message, full_error)
    }
}

export class Forbidden extends BaseError {
    statusCode: number = 403

    constructor(
        message: string = "Not an admin",
        full_error: {}   
    ) {
        super(message, full_error)
    }
}

export class ValidationError extends BaseError {
    statusCode: number = 400

    constructor(
        message: string = "Invalid request data",
        full_error: {}   
    ) {
        super(message, full_error)
    }
}


