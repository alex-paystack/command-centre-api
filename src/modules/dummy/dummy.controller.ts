import { Body, Controller, Get, NotFoundException, Post } from '@nestjs/common';
import { ResponseCode, ResponseType } from '@paystackhq/pkg-response-code';
import { PaystackError, APIError, ValidationError, ProcessorError, PaystackSuccessResponse } from '../../common';
import { CreateDummyDto } from './dto/create-dummy.dto';

@Controller('dummy')
export class DummyController {
  @Get('paystack-error')
  throwPaystackError() {
    throw new PaystackError({
      httpStatusCode: 400,
      type: ResponseType.API_ERROR,
      code: ResponseCode.INVALID_PARAMS,
      data: { field: 'test', reason: 'invalid' },
      message: 'Test PaystackError',
    });
  }

  @Get('api-error')
  throwApiError() {
    throw new APIError(
      'Database connection failed',
      ResponseCode.UNKNOWN,
      { service: 'database' },
    );
  }

  @Get('validation-error')
  throwValidationError() {
    throw new ValidationError(
      'Invalid email format',
      ResponseCode.INVALID_PARAMS,
      { field: 'email', value: 'not-an-email' },
    );
  }

  @Get('processor-error')
  throwProcessorError() {
    throw new ProcessorError(
      'Payment gateway timeout',
      ResponseCode.BANK_TIMEOUT,
      { gateway: 'test-gateway', timeout: '30s' },
    );
  }

  @Get('http-exception')
  throwHttpException() {
    throw new NotFoundException('Resource not found');
  }

  @Get('generic-error')
  throwGenericError() {
    throw new Error('Something went wrong');
  }

  @Get('success')
  getSuccess(): PaystackSuccessResponse<{ id: string; name: string }> {
    return {
      status: true,
      type: ResponseType.SUCCESS,
      code: ResponseCode.OK,
      message: 'Operation successful',
      data: {
        id: '123',
        name: 'Test Item',
      },
    };
  }

  @Post('create')
  createDummy(@Body() createDummyDto: CreateDummyDto): PaystackSuccessResponse<{ id: string; email: string; name: string }> {
    return {
      status: true,
      type: ResponseType.SUCCESS,
      code: ResponseCode.OK,
      message: 'Dummy created successfully',
      data: {
        id: '123',
        email: createDummyDto.email,
        name: createDummyDto.name,
      },
    };
  }
}

