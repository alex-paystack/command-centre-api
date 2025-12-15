import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PageContextType } from '../../../common/ai/types';

export class PageContextDto {
  @ApiProperty({
    description: 'Type of resource for page-scoped chat',
    enum: PageContextType,
    example: PageContextType.TRANSACTION,
  })
  @IsEnum(PageContextType)
  @IsNotEmpty()
  type: PageContextType;

  @ApiProperty({
    description: 'Resource ID or reference (e.g., transaction reference, customer code)',
    example: 'ref_abc123',
  })
  @IsString()
  @IsNotEmpty()
  resourceId: string;
}
