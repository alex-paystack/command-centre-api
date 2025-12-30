import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SavedChart } from '../entities/saved-chart.entity';
import { ChartConfigDto } from './chart-config.dto';

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
    description: 'Creation timestamp',
    example: '2024-12-17T12:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-12-17T12:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Chart configuration snapshot',
    required: false,
    type: ChartConfigDto,
  })
  config?: ChartConfigDto;

  static fromEntity(savedChart: SavedChart): SavedChartResponseDto {
    const dto = new SavedChartResponseDto();
    dto.id = savedChart.id;
    dto.createdFromConversationId = savedChart.createdFromConversationId;
    dto.name = savedChart.name;
    dto.description = savedChart.description;
    dto.createdAt = savedChart.createdAt;
    dto.updatedAt = savedChart.updatedAt;
    dto.config = {
      resourceType: savedChart.resourceType,
      aggregationType: savedChart.aggregationType,
      from: savedChart.from,
      to: savedChart.to,
      status: savedChart.status,
      currency: savedChart.currency,
      channel: savedChart.channel,
    };
    return dto;
  }

  static fromEntities(savedCharts: SavedChart[]): SavedChartResponseDto[] {
    return savedCharts.map((chart) => this.fromEntity(chart));
  }
}
