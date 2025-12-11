import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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
}
