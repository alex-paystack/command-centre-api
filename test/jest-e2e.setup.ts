// Jest setup file for E2E tests
import 'reflect-metadata';

// Set e2e test environment variables
process.env.NODE_ENV = 'e2e';
process.env.APP_NAME = 'test-service';
process.env.APP_VERSION = '1.0.0';
process.env.LOG_LEVEL = 'error';

// Disable OpenTelemetry exporters to prevent teardown race conditions
// These MUST be set as env vars because @paystackhq/nestjs-observability/register
// loads via -r flag BEFORE NestJS starts, so it only reads process.env directly
process.env.OTEL_LOGS_EXPORTER = 'none';
process.env.OTEL_TRACES_EXPORTER = 'none';
process.env.OTEL_METRICS_EXPORTER = 'none';

// Increase timeout for E2E tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  dir: jest.fn(),
};
