import { ApiProperty } from '@nestjs/swagger';
import { ChartResourceType, AggregationType } from '~/common/ai/utilities/chart-config';
import { PaymentChannel } from '~/common/ai/types/data';

export class ChartConfigDto {
  @ApiProperty({ enum: ChartResourceType, example: ChartResourceType.TRANSACTION })
  resourceType: ChartResourceType;

  @ApiProperty({ enum: AggregationType, example: AggregationType.BY_DAY })
  aggregationType: AggregationType;

  @ApiProperty({ required: false, example: '2024-12-01' })
  from?: string;

  @ApiProperty({ required: false, example: '2024-12-31' })
  to?: string;

  @ApiProperty({ required: false, example: 'success' })
  status?: string;

  @ApiProperty({ required: false, example: 'NGN' })
  currency?: string;

  @ApiProperty({ required: false, enum: PaymentChannel, example: PaymentChannel.CARD })
  channel?: PaymentChannel;
}
