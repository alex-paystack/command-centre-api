import { ApiProperty } from '@nestjs/swagger';
import { SavedChartResponseDto } from './saved-chart-response.dto';
import { ChartDataPoint, ChartSeries, ChartSummary } from '~/common/ai/aggregation';

export class SavedChartWithDataResponseDto extends SavedChartResponseDto {
  @ApiProperty({
    description: 'Generated chart label',
    example: 'Daily Transaction Metrics',
  })
  label: string;

  @ApiProperty({
    description: 'Chart type for visualization',
    example: 'area',
    enum: ['line', 'area', 'bar', 'doughnut', 'pie'],
  })
  chartType: string;

  @ApiProperty({
    description: 'Chart data points (for categorical aggregations)',
    example: [{ name: 'success', count: 150, volume: 1500000, average: 10000, currency: 'NGN' }],
    required: false,
  })
  chartData?: ChartDataPoint[];

  @ApiProperty({
    description: 'Chart series (for time-series aggregations)',
    example: [
      {
        currency: 'NGN',
        points: [{ name: 'Monday, Dec 1', count: 100, volume: 1000000, average: 10000, currency: 'NGN' }],
      },
    ],
    required: false,
  })
  chartSeries?: ChartSeries[];

  @ApiProperty({
    description: 'Summary statistics',
    example: {
      totalCount: 1500,
      totalVolume: 15000000,
      overallAverage: 10000,
      dateRange: {
        from: 'Dec 1, 2024',
        to: 'Dec 31, 2024',
      },
    },
  })
  summary: ChartSummary;

  @ApiProperty({
    description: 'Success message',
    example: 'Generated chart data with 31 data points from 1500 transactions',
  })
  message: string;
}
