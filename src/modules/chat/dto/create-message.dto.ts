import { IsNotEmpty, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MessageRole } from '../entities/message.entity';
import { UIMessage } from 'ai';

export class CreateMessageDto {
  @ApiProperty({
    description: 'Conversation UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({
    description: 'Message role',
    enum: MessageRole,
    example: MessageRole.USER,
  })
  @IsEnum(MessageRole)
  @IsNotEmpty()
  role: MessageRole;

  @ApiProperty({
    description: 'Flexible JSON object containing message content (text, images, etc.)',
    example: {
      text: 'How do I integrate the payment API?',
      metadata: { timestamp: '2024-01-01T12:00:00Z' },
    },
  })
  @IsNotEmpty()
  parts: UIMessage['parts'];
}
