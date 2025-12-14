import { IsNotEmpty, IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type UIMessage } from 'ai';

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

  @ApiPropertyOptional({
    description: 'Page key where this conversation belongs. Required when creating a new conversation via stream.',
    example: 'dashboard/payments',
  })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  pageKey?: string;
}
