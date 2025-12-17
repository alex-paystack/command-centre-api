import { HttpStatus } from '@nestjs/common';
import { ResponseCode, ResponseType } from '@paystackhq/pkg-response-code';
import { PaystackError } from '../helpers/paystack.error';

const defaultMessage = 'An error occurred';

/**
 * Custom exception for internal API errors or unknown errors
 * Used for server-side errors that are not validation or processor related
 * Default HTTP status: 500 Internal Server Error
 */
export class APIError extends PaystackError {
  constructor(message = defaultMessage, code?: string, data?: object, statusOverride?: HttpStatus) {
    super({
      httpStatusCode: statusOverride ?? HttpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      type: ResponseType.API_ERROR,
      code: code ?? ResponseCode.UNKNOWN,
      message,
      data,
    });
  }
}

/**
 * Custom exception for validation failures and business rule violations
 * Used when input validation fails or business rules are not met
 * Default HTTP status: 400 Bad Request
 */
export class ValidationError extends PaystackError {
  constructor(message = 'Validation failed', code?: ResponseCode, data?: object, statusOverride?: HttpStatus) {
    super({
      httpStatusCode: statusOverride ?? HttpStatus.BAD_REQUEST,
      status: false,
      type: ResponseType.VALIDATION_ERROR,
      code: code ?? ResponseCode.INVALID_PARAMS,
      message,
      data,
    });
  }
}

/**
 * Custom exception for third-party service timeouts and external API failures
 * Used when external services are unavailable or timeout
 * Default HTTP status: 408 Request Timeout
 */
export class ProcessorError extends PaystackError {
  constructor(message = 'Unknown error', code?: ResponseCode, data?: object, statusOverride?: HttpStatus) {
    super({
      httpStatusCode: statusOverride ?? HttpStatus.REQUEST_TIMEOUT,
      status: false,
      type: ResponseType.PROCESSOR_ERROR,
      code: code ?? ResponseCode.UNKNOWN,
      message,
      data,
    });
  }
}

/**
 * Custom exception for resource not found errors
 * Used when a requested resource does not exist
 * Default HTTP status: 404 Not Found
 */
export class NotFoundError extends PaystackError {
  constructor(message: string, code?: ResponseCode, data?: object, statusOverride?: HttpStatus) {
    super({
      httpStatusCode: statusOverride ?? HttpStatus.NOT_FOUND,
      status: false,
      type: ResponseType.API_ERROR,
      code: code ?? ResponseCode.NOT_FOUND,
      message,
      data,
    });
  }
}
