import { IsEnum, IsNotEmpty, IsString, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceType } from '~/common/ai/types';

export class PageContextDto {
  @ApiProperty({
    description: 'Type of resource for page-scoped chat',
    enum: ResourceType,
    example: ResourceType.TRANSACTION,
  })
  @IsEnum(ResourceType)
  @IsNotEmpty()
  type: ResourceType;

  @ApiProperty({
    description: 'Resource ID or reference (e.g., transaction reference, customer code)',
    example: 'ref_abc123',
  })
  @IsString()
  @IsNotEmpty()
  resourceId: string;

  @ApiPropertyOptional({
    description: 'Optional pre-fetched resource data from client',
    example: {
      id: 123,
      amount: 100000,
      status: 'success',
    },
  })
  @IsOptional()
  @ValidateIf((dto: PageContextDto) => dto.resourceData !== undefined)
  resourceData?: unknown;
}
