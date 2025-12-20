import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoggerService } from '@paystackhq/nestjs-observability';
import { configureApp } from './app.setup';

const serviceName = process.env.APP_NAME ?? 'myservice-api';

/**
 * Register Langfuse span processor with OpenTelemetry
 * This enables automatic instrumentation of AI operations via Vercel AI SDK
 */
async function registerLangfuseProcessor() {
  // Only register if Langfuse is enabled
  if (process.env.LANGFUSE_ENABLED !== 'true') {
    return;
  }

  try {
    // Dynamic imports to avoid loading Langfuse dependencies if not needed
    const langfuseVercel = await import('langfuse-vercel');
    const otelModule = (await import('@opentelemetry/api')) as {
      trace: {
        getTracerProvider: () => unknown;
      };
    };

    // Type-safe access to OpenTelemetry tracer provider
    interface TracerProviderWithProcessor {
      addSpanProcessor: (processor: unknown) => void;
    }

    const tracerProvider = otelModule.trace.getTracerProvider();

    if (tracerProvider && typeof tracerProvider === 'object' && 'addSpanProcessor' in tracerProvider) {
      const provider = tracerProvider as TracerProviderWithProcessor;

      const exporter = new langfuseVercel.LangfuseExporter({
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
      });

      provider.addSpanProcessor(exporter);
      // eslint-disable-next-line no-console
      console.log('Langfuse span processor registered successfully');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.warn('Failed to register Langfuse span processor, continuing without it:', errorMessage);
  }
}

async function bootstrap() {
  // Register Langfuse processor before creating app
  await registerLangfuseProcessor();

  const app = await NestFactory.create(AppModule);

  configureApp(app);

  // Get the logger service from the app context
  // NOTE: Observability instrumentation is loaded via NODE_OPTIONS="-r @paystackhq/nestjs-observability/register"
  // This ensures instrumentation loads before any application modules for complete tracing coverage.
  const logger = app.get(LoggerService);
  logger.addContext('service', 'Bootstrap');

  logger.info('Application starting');
  // Main application - start HTTP server and load Swagger
  logger.info('Main application starting');

  // Setup Swagger for main applications
  const config = new DocumentBuilder()
    .setTitle(serviceName)
    .setDescription('The Command Centre API description')
    .setVersion('1.0')
    .addTag('command-centre-api')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  // Start HTTP server
  await app.listen(process.env.PORT ?? 3000);
  logger.info(`Main application started on port ${process.env.PORT ?? 3000}`);
}

void bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start application:', err);
  process.exit(1);
});
