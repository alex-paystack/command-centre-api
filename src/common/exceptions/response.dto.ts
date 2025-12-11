import { PaystackSuccessResponse } from './types';

/**
 * Data Transfer Object for standardized Paystack success responses
 * 
 * This class provides a strongly-typed way to create consistent success responses
 * that follow the Paystack API response format. It eliminates the need for 
 * complex interceptor logic by making response formatting explicit.
 * 
 * @template T The type of data being returned in the response
 */
export class PaystackResponse<T> implements PaystackSuccessResponse<T> {
  /** Always true for success responses */
  readonly status = true as const;

  /** Human-readable success message */
  message: string;

  /** The actual data payload */
  data: T;

  /**
   * Creates a new Paystack-formatted success response
   * 
   * @param data The data to include in the response
   * @param message Optional success message (defaults to 'Success')
   */
  constructor(data: T, message = 'Success') {
    this.data = data;
    this.message = message;
  }

  /**
   * Static factory method to create a success response
   * 
   * @template T The type of data being returned
   * @param data The data to include in the response
   * @param message Optional success message (defaults to 'Success')
   * @returns PaystackResponse instance with the provided data and message
   * 
   * @example
   * ```typescript
   * // Basic usage
   * return PaystackResponse.success({ userId: 123, name: 'John' });
   * 
   * // With custom message
   * return PaystackResponse.success(users, 'Users retrieved successfully');
   * 
   * // With type inference
   * const response = PaystackResponse.success<User[]>(users);
   * ```
   */
  static success<T>(data: T, message = 'Success'): PaystackResponse<T> {
    return new PaystackResponse(data, message);
  }
}