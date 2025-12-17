import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChartResourceType, AggregationType } from '~/common/ai/chart-config';

export class SaveChartDto {
  @ApiProperty({
    description: 'Custom name/label for the saved chart',
    example: 'December Transaction Overview',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'Optional description for the saved chart',
    example: 'Daily transaction metrics for Q4 2024',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Optional reference to the conversation from which this chart was created',
    example: 'conv-uuid-123',
  })
  @IsUUID()
  @IsOptional()
  createdFromConversationId?: string;

  @ApiProperty({
    description: 'Type of resource (transaction, refund, payout, dispute)',
    enum: ChartResourceType,
    example: ChartResourceType.TRANSACTION,
  })
  @IsEnum(ChartResourceType)
  @IsNotEmpty()
  resourceType: ChartResourceType;

  @ApiProperty({
    description: 'Type of aggregation',
    enum: AggregationType,
    example: AggregationType.BY_DAY,
  })
  @IsEnum(AggregationType)
  @IsNotEmpty()
  aggregationType: AggregationType;

  @ApiPropertyOptional({
    description: 'Start date filter (ISO 8601)',
    example: '2024-12-01',
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date filter (ISO 8601)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Status filter',
    example: 'success',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Currency filter',
    example: 'NGN',
  })
  @IsOptional()
  @IsString()
  currency?: string;
}
