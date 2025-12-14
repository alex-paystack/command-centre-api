import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
    description: 'Page key where the conversation is scoped (e.g. dashboard route or surface identifier)',
    example: 'dashboard/payments',
  })
  @IsString()
  @IsNotEmpty()
  pageKey: string;

  @ApiPropertyOptional({
    description: 'User ID who owns the conversation (automatically set from authenticated user)',
    example: 'user_12345',
  })
  @IsString()
  @IsOptional()
  userId?: string;
}
