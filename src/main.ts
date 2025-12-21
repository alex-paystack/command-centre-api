import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { configureApp } from './app.setup';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

const serviceName = process.env.APP_NAME ?? 'myservice-api';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  // Get the logger service from the app context
  // NOTE: Observability instrumentation is loaded via NODE_OPTIONS="-r @paystackhq/nestjs-observability/register"
  // This ensures instrumentation loads before any application modules for complete tracing coverage.

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
}

void bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start application:', err);
  process.exit(1);
});
