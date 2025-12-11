import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HealthCheckItemDto {
  @ApiProperty({ enum: ['up', 'down', 'partial'], example: 'up' })
  status!: 'up' | 'down' | 'partial';

  @ApiProperty({ example: 'Application is healthy - timestamp: 2025-01-01T00:00:00.000Z' })
  message!: string;

  @ApiPropertyOptional({ description: 'Optional subsystem details', example: { read: true, write: false } })
  details?: Record<string, unknown>;
}

@ApiExtraModels(HealthCheckItemDto)
export class HealthResponseDto {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/HealthCheckItemDto' },
    example: {
      application: {
        status: 'up',
        message: 'Application is healthy - timestamp: 2025-01-01T00:00:00.000Z',
      },
      postgres: {
        status: 'up',
        message: 'Postgres connectivity is working as expected',
      },
      cache: {
        status: 'partial',
        message: 'Cache read: up, write: down',
        details: { read: true, write: false },
      },
    },
  })
  details!: Record<string, HealthCheckItemDto>;
}