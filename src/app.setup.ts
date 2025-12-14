import { INestApplication, ValidationPipe, ValidationError as NestValidationError } from '@nestjs/common';
import { GlobalExceptionFilter, ValidationError } from './common';

export function configureApp(app: INestApplication): void {
  // Enable CORS for external services
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*', // Allow configured origins or all origins
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Type', 'X-Request-Id'], // Expose headers for streaming responses
    credentials: true,
    maxAge: 3600, // Cache preflight requests for 1 hour
  });

  // Register global exception filter for standardized error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Configure validation pipe with enhanced error handling
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      errorHttpStatusCode: 400,
      exceptionFactory: (errors: NestValidationError[]) => {
        const formattedErrors = errors.map((err) => ({
          field: err.property,
          constraints: Object.values(err.constraints ?? {}),
        }));

        return new ValidationError('Validation failed', undefined, { errors: formattedErrors });
      },
    }),
  );
}
