import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Message, MessageRole } from '../entities/message.entity';
import { UIMessage } from 'ai';

@Exclude()
export class MessageResponseDto {
  @ApiProperty({
    description: 'Message UUID',
    example: '987fcdeb-51a2-43e7-b890-123456789abc',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Conversation UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  conversationId: string;

  @ApiProperty({
    description: 'Message role',
    enum: MessageRole,
    example: MessageRole.USER,
  })
  @Expose()
  role: MessageRole;

  @ApiProperty({
    description: 'Flexible JSON object containing message content',
    example: {
      text: 'How do I integrate the payment API?',
      metadata: { timestamp: '2024-01-01T12:00:00Z' },
    },
  })
  @Expose()
  parts: UIMessage['parts'];

  @ApiProperty({
    description: 'Timestamp when the message was created',
    example: '2024-01-01T12:00:00.000Z',
  })
  @Expose()
  createdAt: Date;

  static fromEntity(message: Message): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = message.id;
    dto.conversationId = message.conversationId;
    dto.role = message.role;
    dto.parts = message.parts;
    dto.createdAt = message.createdAt;
    return dto;
  }

  static fromEntities(messages: Message[]): MessageResponseDto[] {
    return messages.map((message) => this.fromEntity(message));
  }
}
