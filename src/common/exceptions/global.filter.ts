import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ResponseCode, ResponseType } from '@paystackhq/pkg-response-code';
import { PaystackErrorResponse } from './types';
import { PaystackError } from '../helpers/paystack.error';

/**
 * Global exception filter that catches all unhandled exceptions
 * and formats them into standardized Paystack error responses.
 *
 * This filter provides consistent error formatting across the entire application,
 * handling both custom exceptions and built-in NestJS HttpExceptions.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  /**
   * Main exception handling method that catches all unhandled exceptions
   * @param exception The thrown exception of any type
   * @param host ArgumentsHost containing request/response context
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const errorResponse = this.buildErrorResponse(exception);
    const status = this.getHttpStatus(exception);

    response.status(status).json(errorResponse);
  }

  /**
   * Builds a standardized Paystack error response based on the exception type
   * @param exception The thrown exception
   * @returns PaystackErrorResponse with appropriate type, code, and message
   */
  private buildErrorResponse(exception: unknown): PaystackErrorResponse {
    // PaystackError and its subclasses (APIError, ValidationError, ProcessorError)
    if (exception instanceof PaystackError) {
      return {
        status: false,
        code: exception.code,
        type: exception.type,
        data: exception.data,
        message: exception.message,
      };
    }

    // Handle NestJS HttpException (e.g., BadRequestException, NotFoundException, etc.)
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string' ? response : ((response as { message?: string }).message ?? 'HTTP Exception');

      return {
        status: false,
        type: ResponseType.API_ERROR,
        code: ResponseCode.UNKNOWN,
        message,
      };
    }

    // Handle unknown exceptions
    const message = exception instanceof Error ? exception.message : 'Internal server error';
    return {
      status: false,
      type: ResponseType.API_ERROR,
      code: ResponseCode.UNKNOWN,
      message,
    };
  }

  /**
   * Determines the appropriate HTTP status code for the exception
   * Supports status code override from custom exceptions
   * @param exception The thrown exception
   * @returns HTTP status code
   */
  private getHttpStatus(exception: unknown): number {
    if (exception instanceof PaystackError) {
      return exception.httpStatusCode;
    }

    // Check if exception has statusOverride property (for custom exceptions)
    if (exception && typeof exception === 'object') {
      const maybeStatus = (exception as { statusOverride?: unknown }).statusOverride;
      if (typeof maybeStatus === 'number') {
        return maybeStatus;
      }
    }

    // Check if it's an HttpException (includes custom exceptions extending HttpException)
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    // Default for unknown exceptions
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
