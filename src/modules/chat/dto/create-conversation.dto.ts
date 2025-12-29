import { IsString, IsNotEmpty, IsUUID, IsOptional, IsEnum, ValidateNested, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMode, ResourceType } from '~/common/ai/types';
import { Type } from 'class-transformer';
import { PageContextDto } from './page-context.dto';

export class CreateConversationDto {
  @ApiProperty({
    description: 'Conversation UUID (client-generated)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  id: string; // Client-generated UUID

  @ApiProperty({
    description: 'Title of the conversation',
    example: 'How to integrate payment API',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Page context for resource-scoped chat. Required when mode is "page".',
    example: {
      type: ResourceType.TRANSACTION,
      resourceId: '123456',
    },
  })
  @ValidateIf((dto: CreateConversationDto) => dto.mode === ChatMode.PAGE)
  @IsNotEmpty({ message: 'pageContext is required when mode is "page"' })
  @ValidateNested()
  @Type(() => PageContextDto)
  pageContext?: PageContextDto;

  @ApiProperty({
    description: 'Chat mode: global (command centre page) or page (scoped to specific resource)',
    enum: ChatMode,
    default: ChatMode.GLOBAL,
    example: ChatMode.PAGE,
  })
  @IsEnum(ChatMode)
  @IsNotEmpty()
  mode: ChatMode;

  @ApiPropertyOptional({
    description: 'User ID who owns the conversation (automatically set from authenticated user)',
    example: 'user_12345',
  })
  @IsString()
  @IsOptional()
  userId?: string;
}
