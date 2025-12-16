import { IsNotEmpty, IsUUID, IsEnum, ValidateNested, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMode } from '~/common/ai/types';
import { Type } from 'class-transformer';
import { PageContextDto } from './page-context.dto';

export class CreateConversationFromSummaryDto {
  @ApiProperty({
    description: 'ID of the closed conversation to continue from',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  previousConversationId: string;

  @ApiProperty({
    description: 'Chat mode: global (command centre page) or page (scoped to specific resource)',
    enum: ChatMode,
    example: ChatMode.GLOBAL,
  })
  @IsEnum(ChatMode)
  @IsNotEmpty()
  mode: ChatMode;

  @ApiPropertyOptional({
    description: 'Page context for resource-scoped chat. Required when mode is "page".',
  })
  @ValidateIf((dto: CreateConversationFromSummaryDto) => dto.mode === ChatMode.PAGE)
  @IsNotEmpty({ message: 'pageContext is required when mode is "page"' })
  @ValidateNested()
  @Type(() => PageContextDto)
  pageContext?: PageContextDto;
}
