import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Query parameters for regenerating a chart with overridden filter values.
 * Only filter parameters can be overridden - resourceType and aggregationType remain immutable.
 * All fields are optional - if not provided, the saved configuration is used.
 */
export class RegenerateChartQueryDto {
  @ApiPropertyOptional({
    description: 'Override the start date (ISO format)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Override the end date (ISO format)',
    example: '2024-01-31',
  })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Override the status filter',
    example: 'success',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Override the currency filter',
    example: 'NGN',
  })
  @IsOptional()
  @IsString()
  currency?: string;
}
