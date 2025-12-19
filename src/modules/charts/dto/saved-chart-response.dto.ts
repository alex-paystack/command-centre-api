import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SavedChart } from '../entities/saved-chart.entity';
import { ChartResourceType, AggregationType } from '~/common/ai/chart-config';
import { PaymentChannel } from '~/common/ai/types/data';

export class SavedChartResponseDto {
  @ApiProperty({
    description: 'Saved chart UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Reference to source conversation (if chart was created from a conversation)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  createdFromConversationId?: string;

  @ApiProperty({
    description: 'Custom name/label',
    example: 'December Transaction Overview',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Chart description',
    example: 'Daily transaction metrics for Q4 2024',
  })
  description?: string;

  @ApiProperty({
    description: 'Resource type',
    enum: ChartResourceType,
    example: ChartResourceType.TRANSACTION,
  })
  resourceType: ChartResourceType;

  @ApiProperty({
    description: 'Aggregation type',
    enum: AggregationType,
    example: AggregationType.BY_DAY,
  })
  aggregationType: AggregationType;

  @ApiPropertyOptional({
    description: 'Start date filter',
    example: '2024-12-01',
  })
  from?: string;

  @ApiPropertyOptional({
    description: 'End date filter',
    example: '2024-12-31',
  })
  to?: string;

  @ApiPropertyOptional({
    description: 'Status filter',
    example: 'success',
  })
  status?: string;

  @ApiPropertyOptional({
    description: 'Currency filter',
    example: 'NGN',
  })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Payment channel filter (transactions only)',
    enum: PaymentChannel,
    example: PaymentChannel.CARD,
  })
  channel?: PaymentChannel;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-12-17T12:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-12-17T12:00:00.000Z',
  })
  updatedAt: Date;

  static fromEntity(savedChart: SavedChart): SavedChartResponseDto {
    const dto = new SavedChartResponseDto();
    dto.id = savedChart.id;
    dto.createdFromConversationId = savedChart.createdFromConversationId;
    dto.name = savedChart.name;
    dto.description = savedChart.description;
    dto.resourceType = savedChart.resourceType;
    dto.aggregationType = savedChart.aggregationType;
    dto.from = savedChart.from;
    dto.to = savedChart.to;
    dto.status = savedChart.status;
    dto.currency = savedChart.currency;
    dto.channel = savedChart.channel;
    dto.createdAt = savedChart.createdAt;
    dto.updatedAt = savedChart.updatedAt;
    return dto;
  }

  static fromEntities(savedCharts: SavedChart[]): SavedChartResponseDto[] {
    return savedCharts.map((chart) => this.fromEntity(chart));
  }
}
