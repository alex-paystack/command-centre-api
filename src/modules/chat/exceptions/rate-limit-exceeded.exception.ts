import { HttpStatus } from '@nestjs/common';
import { ResponseCode, ResponseType } from '@paystackhq/pkg-response-code';
import { PaystackError } from '~/common/helpers/paystack.error';

export class RateLimitExceededException extends PaystackError {
  constructor(limit: number, periodHours: number, currentCount: number) {
    const message = `Rate limit exceeded. You have sent ${currentCount} messages in the last ${periodHours} hour(s). The limit is ${limit} messages per ${periodHours} hour(s).`;

    super({
      httpStatusCode: HttpStatus.TOO_MANY_REQUESTS,
      status: false,
      type: ResponseType.API_ERROR,
      code: ResponseCode.RATE_LIMITED as string,
      message,
      data: {
        limit,
        periodHours,
        currentCount,
      },
    });
  }
}
