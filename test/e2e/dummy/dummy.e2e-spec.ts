import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from '../../utils/app';

describe('Dummy Exception Handling (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /dummy/paystack-error', () => {
    it('should handle PaystackError and return formatted response', async () => {
      const response = await request(app.getHttpServer()).get('/dummy/paystack-error').expect(400);

      expect(response.body).toMatchObject({
        status: false,
        type: 'api_error',
        code: 'invalid_params',
        message: 'Test PaystackError',
        data: { field: 'test', reason: 'invalid' },
      });
    });
  });

  describe('GET /dummy/api-error', () => {
    it('should handle APIError and return formatted response', async () => {
      const response = await request(app.getHttpServer()).get('/dummy/api-error').expect(500);

      expect(response.body).toMatchObject({
        status: false,
        type: 'api_error',
        code: 'unknown',
        message: 'Database connection failed',
        data: {
          service: 'database',
        },
      });
    });
  });

  describe('GET /dummy/validation-error', () => {
    it('should handle ValidationError and return formatted response', async () => {
      const response = await request(app.getHttpServer()).get('/dummy/validation-error').expect(400);

      expect(response.body).toMatchObject({
        status: false,
        type: 'validation_error',
        code: 'invalid_params',
        message: 'Invalid email format',
        data: { field: 'email', value: 'not-an-email' },
      });
    });
  });

  describe('GET /dummy/processor-error', () => {
    it('should handle ProcessorError and return formatted response', async () => {
      const response = await request(app.getHttpServer()).get('/dummy/processor-error').expect(408);

      expect(response.body).toMatchObject({
        status: false,
        type: 'processor_error',
        code: 'bank_timeout',
        message: 'Payment gateway timeout',
        data: { gateway: 'test-gateway', timeout: '30s' },
      });
    });
  });

  describe('GET /dummy/http-exception', () => {
    it('should handle HttpException and return formatted response', async () => {
      const response = await request(app.getHttpServer()).get('/dummy/http-exception').expect(404);

      expect(response.body).toMatchObject({
        status: false,
        type: 'api_error',
        code: 'unknown',
        message: 'Resource not found',
      });
    });
  });

  describe('GET /dummy/generic-error', () => {
    it('should handle generic Error and return formatted response', async () => {
      const response = await request(app.getHttpServer()).get('/dummy/generic-error').expect(500);

      expect(response.body).toMatchObject({
        status: false,
        type: 'api_error',
        code: 'unknown',
        message: 'Something went wrong',
      });
    });
  });

  describe('GET /dummy/success', () => {
    it('should return success response with correct format', async () => {
      const response = await request(app.getHttpServer()).get('/dummy/success').expect(200);

      expect(response.body).toMatchObject({
        status: true,
        type: 'success',
        code: 'ok',
        message: 'Operation successful',
        data: {
          id: '123',
          name: 'Test Item',
        },
      });
    });
  });

  describe('POST /dummy/create', () => {
    it('should return validation error when only 1 out of 3 required fields are provided', async () => {
      const invalidData = {
        email: 'test@example.com',
        // Missing name and password fields
      };

      const response = await request(app.getHttpServer())
        .post('/dummy/create')
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        status: false,
        type: 'validation_error',
        code: 'invalid_params',
        message: 'Validation failed',
        data: {
          errors: [
            {
              field: 'name',
              constraints: [
                'Name is required',
                'Name must be a string',
              ],
            },
            {
              field: 'password',
              constraints: [
                'Password is required',
                'Password must be at least 8 characters long',
                'Password must be a string',
              ],
            },
          ],
        },
      });
    });
  });
});

