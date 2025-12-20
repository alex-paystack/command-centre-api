import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LangfuseService } from './langfuse.service';

// Mock the langfuse package to avoid dynamic import issues in Jest
jest.mock('langfuse', () => ({
  Langfuse: jest.fn().mockImplementation(() => ({
    trace: jest.fn(),
    getPrompt: jest.fn(),
    flushAsync: jest.fn().mockResolvedValue(undefined),
    shutdownAsync: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('LangfuseService', () => {
  let service: LangfuseService;

  const createTestingModule = async (config: Record<string, string | undefined>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LangfuseService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string): string | undefined => config[key]),
          },
        },
      ],
    }).compile();

    service = module.get<LangfuseService>(LangfuseService);
    return module;
  };

  describe('Graceful Degradation', () => {
    it('should disable when LANGFUSE_ENABLED is false', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
      });

      expect(service.isEnabled()).toBe(false);
      const config = service.getConfig();
      expect(config?.enabled).toBe(false);
    });

    it('should disable when LANGFUSE_SECRET_KEY is missing', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'true',
        LANGFUSE_PUBLIC_KEY: 'pk-test-123',
        LANGFUSE_BASE_URL: 'https://cloud.langfuse.com',
      });

      expect(service.isEnabled()).toBe(false);
    });

    it('should disable when LANGFUSE_PUBLIC_KEY is missing', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'true',
        LANGFUSE_SECRET_KEY: 'sk-test-123',
        LANGFUSE_BASE_URL: 'https://cloud.langfuse.com',
      });

      expect(service.isEnabled()).toBe(false);
    });

    it('should return null when calling trace() if disabled', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
      });

      const trace = service.trace({ name: 'test' });
      expect(trace).toBeNull();
    });

    it('should not throw when flush() is called if disabled', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
      });

      await expect(service.flush()).resolves.not.toThrow();
    });

    it('should not throw when shutdown() is called if disabled', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
      });

      await expect(service.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    it('should use default baseUrl if not provided', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
      });

      const config = service.getConfig();
      expect(config?.baseUrl).toBe('https://cloud.langfuse.com');
    });

    it('should parse numeric configuration correctly', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
        LANGFUSE_FLUSH_INTERVAL: '3000',
        LANGFUSE_FLUSH_AT: '20',
        LANGFUSE_REQUEST_TIMEOUT: '15000',
        LANGFUSE_SAMPLE_RATE: '0.5',
      });

      const config = service.getConfig();
      expect(config?.flushInterval).toBe(3000);
      expect(config?.flushAt).toBe(20);
      expect(config?.requestTimeout).toBe(15000);
      expect(config?.sampleRate).toBe(0.5);
    });

    it('should parse boolean configuration correctly', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
        LANGFUSE_MASK_INPUTS: 'true',
        LANGFUSE_MASK_OUTPUTS: 'true',
      });

      const config = service.getConfig();
      expect(config?.maskInputs).toBe(true);
      expect(config?.maskOutputs).toBe(true);
    });

    it('should handle self-hosted URL', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
        LANGFUSE_BASE_URL: 'http://localhost:3000',
      });

      const config = service.getConfig();
      expect(config?.baseUrl).toBe('http://localhost:3000');
    });

    it('should handle US cloud URL', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
        LANGFUSE_BASE_URL: 'https://us.cloud.langfuse.com',
      });

      const config = service.getConfig();
      expect(config?.baseUrl).toBe('https://us.cloud.langfuse.com');
    });
  });

  describe('Sampling', () => {
    it('should return false for shouldSample() when disabled', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
      });

      expect(service.shouldSample()).toBe(false);
    });

    it('should respect sampling rate of 0', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
        LANGFUSE_SAMPLE_RATE: '0.0',
      });

      const config = service.getConfig();
      expect(config?.sampleRate).toBe(0.0);
      expect(service.shouldSample()).toBe(false);
    });

    it('should always sample when rate is 1.0 and enabled', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
        LANGFUSE_SAMPLE_RATE: '1.0',
      });

      const config = service.getConfig();
      expect(config?.sampleRate).toBe(1.0);
    });
  });

  describe('Client Access', () => {
    it('should return null client when disabled', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
      });

      const client = service.getClient();
      expect(client).toBeNull();
    });

    it('should return null from getPrompt() when disabled', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
      });

      const prompt = await service.getPrompt('test-prompt');
      expect(prompt).toBeNull();
    });
  });

  describe('Lifecycle', () => {
    it('should handle onModuleDestroy gracefully when disabled', async () => {
      await createTestingModule({
        LANGFUSE_ENABLED: 'false',
      });

      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
