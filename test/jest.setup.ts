// Jest setup file for unit tests
import 'reflect-metadata';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.APP_NAME = 'test-service';
process.env.APP_VERSION = '1.0.0';
process.env.LOG_LEVEL = 'error';
process.env.METRICS_ENABLED = 'false';
process.env.TRACING_ENABLED = 'false';

// Increase timeout for tests
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
