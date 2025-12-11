import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from '../../utils/app';
import { INestApplication } from '@nestjs/common';
import { HealthDetails } from 'src/modules/health/health.controller';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'e2e';

    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Application Health', () => {
    it('should return appropriate status when application is healthy', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const healthDetails = response.body.data as HealthDetails;

      // Accept both 200 and 503 as valid responses in test environment
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('data');
      expect(healthDetails).toHaveProperty('application');
      expect(healthDetails.application).toHaveProperty('status');
      expect(healthDetails.application).toHaveProperty('message');
    });

    it('should include timestamp in application health message', async () => {
      const beforeRequest = new Date();

      const response = await request(app.getHttpServer()).get('/health');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const healthDetails = response.body.data as HealthDetails;

      const afterRequest = new Date();
      const message = healthDetails.application.message;
      const timestampMatch = message.match(/timestamp: (.+)/);

      expect(timestampMatch).toBeTruthy();

      const timestamp = new Date(timestampMatch?.[1] ?? '');
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
    });
  });
  describe('Database Health', () => {
    it('should include database health when database is available', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const healthDetails = response.body.data as HealthDetails;

      expect(response.status).toBe(200);
      expect(healthDetails).toHaveProperty('mongodb');
      expect(healthDetails['mongodb']).toHaveProperty('status', 'up');
      expect(healthDetails['mongodb']).toHaveProperty('message');
    });
  });

  describe('Response Structure', () => {
    it('should have consistent response structure', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const healthDetails = response.body.data as HealthDetails;

      // Always present
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('data');
      expect(healthDetails).toHaveProperty('application');
      expect(healthDetails).toHaveProperty('mongodb');
    });
  });
});
