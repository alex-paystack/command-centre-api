/**
 * Interface for standardized Paystack error responses
 * Used when an error occurs and needs to be returned to the client
 */
export interface PaystackErrorResponse {
  status: false;
  type: string;
  code: string;
  message: string;
  data?: unknown;
}

/**
 * Interface for standardized Paystack success responses
 * Used when an operation completes successfully
 * @template T The type of data being returned
 */
export interface PaystackSuccessResponse<T> {
  status: true;
  message: string;
  data: T;
  type?: string;
  code?: string;
}
