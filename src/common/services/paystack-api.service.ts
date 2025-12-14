import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { PaystackError } from '../helpers/paystack.error';

export interface PaystackApiResponse<T = unknown> {
  status: boolean;
  message: string;
  data: T;
  meta?: {
    total: number;
    total_volume: number;
    skipped: number;
    perPage: number;
    page: number;
    pageCount: number;
  };
}

@Injectable()
export class PaystackApiService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('PAYSTACK_API_BASE_URL') || 'https://studio-api.paystack.co';
  }

  /**
   * Make a GET request to the Paystack API
   * @param endpoint - API endpoint (e.g., '/transaction')
   * @param jwtToken - User's JWT authentication token
   * @param params - Optional query parameters
   */
  async get<T = unknown>(
    endpoint: string,
    jwtToken: string,
    params?: Record<string, unknown>,
  ): Promise<PaystackApiResponse<T>> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<PaystackApiResponse<T>>(`${this.baseUrl}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
            'jwt-auth': 'true',
          },
          params,
        }),
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Make a POST request to the Paystack API
   * @param endpoint - API endpoint
   * @param jwtToken - User's JWT authentication token
   * @param data - Request body
   */
  async post<T = unknown>(
    endpoint: string,
    jwtToken: string,
    data?: Record<string, unknown>,
  ): Promise<PaystackApiResponse<T>> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<PaystackApiResponse<T>>(`${this.baseUrl}${endpoint}`, data, {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
            'jwt-auth': 'true',
          },
        }),
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Handle Paystack API errors and transform them into PaystackError
   */
  private handleError(error: unknown): never {
    if (error instanceof AxiosError && error.response) {
      const { status } = error.response;
      const data = error.response.data as Record<string, unknown>;

      // Paystack error response format
      if (data && typeof data === 'object') {
        throw new PaystackError({
          httpStatusCode: status,
          status: typeof data.status === 'boolean' ? data.status : false,
          type: typeof data.type === 'string' ? data.type : 'api_error',
          code: typeof data.code === 'string' ? data.code : 'PAYSTACK_API_ERROR',
          message: typeof data.message === 'string' ? data.message : 'An error occurred while calling Paystack API',
          data: typeof data.data === 'object' ? (data.data as object) : undefined,
        });
      }
    }

    throw new PaystackError({
      httpStatusCode: 500,
      status: false,
      type: 'api_error',
      code: 'PAYSTACK_API_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}
