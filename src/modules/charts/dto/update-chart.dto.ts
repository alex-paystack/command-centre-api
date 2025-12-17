import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateChartDto {
  @ApiPropertyOptional({
    description: 'Update the chart name',
    example: 'Updated Transaction Overview',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    description: 'Update the chart description',
    example: 'Updated description for Q4 2024 transactions',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
