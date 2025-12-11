import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({
    description: 'User ID who owns the conversation',
    example: 'user_12345',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
