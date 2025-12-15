import { IsNotEmpty, IsUUID, IsOptional, ValidateNested, IsEnum, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { type UIMessage } from 'ai';
import { PageContextDto } from './page-context.dto';
import { ChatMode, PageContextType } from '../../../common/ai/types';

export class ChatRequestDto {
  @ApiProperty({
    description: 'Conversation UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({
    description: 'Message from the user',
    example: {
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'How do I integrate the payment API?',
        },
      ],
    },
  })
  @IsNotEmpty()
  message: UIMessage;

  @ApiProperty({
    description: 'Chat mode: global (command centre page) or page (scoped to specific resource)',
    enum: ChatMode,
    default: ChatMode.GLOBAL,
    example: ChatMode.GLOBAL,
  })
  @IsEnum(ChatMode)
  @IsOptional()
  mode?: ChatMode = ChatMode.GLOBAL;

  @ApiPropertyOptional({
    description: 'Page context for resource-scoped chat. Required when mode is "page".',
    example: {
      type: PageContextType.TRANSACTION,
      resourceId: '123456',
    },
  })
  @ValidateIf((dto: ChatRequestDto) => dto.mode === ChatMode.PAGE)
  @IsNotEmpty({ message: 'pageContext is required when mode is "page"' })
  @ValidateNested()
  @Type(() => PageContextDto)
  pageContext?: PageContextDto;
}
