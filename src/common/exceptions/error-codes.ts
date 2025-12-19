import { ResponseCode } from '@paystackhq/pkg-response-code';

/**
 * Standardized error codes for the application
 * Maps domain-specific error scenarios to ResponseCode values
 */
export const ErrorCodes = {
  // Resource not found errors
  CONVERSATION_NOT_FOUND: ResponseCode.NOT_FOUND,
  CHART_NOT_FOUND: ResponseCode.NOT_FOUND,
  RESOURCE_NOT_FOUND: ResponseCode.NOT_FOUND,

  // Validation errors
  INVALID_PARAMS: ResponseCode.INVALID_PARAMS,
  INVALID_RESOURCE_TYPE: ResponseCode.INVALID_PARAMS,
  INVALID_AGGREGATION_TYPE: ResponseCode.INVALID_PARAMS,
  INVALID_DATE_RANGE: ResponseCode.INVALID_PARAMS,
  INVALID_STATUS: ResponseCode.INVALID_PARAMS,
  INVALID_CHANNEL: ResponseCode.INVALID_PARAMS,
  MISSING_REQUIRED_FIELD: ResponseCode.INVALID_PARAMS,

  // Business logic errors
  CONVERSATION_CLOSED: ResponseCode.ACCESS_DENIED,
  CONTEXT_MISMATCH: ResponseCode.ACCESS_DENIED,
  CONVERSATION_MODE_LOCKED: ResponseCode.ACCESS_DENIED,

  // Rate limiting
  RATE_LIMITED: ResponseCode.RATE_LIMITED,

  // Internal errors
  INTERNAL_ERROR: ResponseCode.INTERNAL_API_ERROR,
  UNKNOWN: ResponseCode.UNKNOWN,
} as const;
