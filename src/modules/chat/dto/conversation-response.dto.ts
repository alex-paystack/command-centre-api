import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Conversation } from '../entities/conversation.entity';
import { ChatMode, PageContextType } from 'src/common/ai/types';

@Exclude()
export class ConversationResponseDto {
  @ApiProperty({
    description: 'Conversation UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Title of the conversation',
    example: 'How to integrate payment API',
  })
  @Expose()
  title: string;

  @ApiProperty({
    description: 'User ID who owns the conversation',
    example: 'user_12345',
  })
  @Expose()
  userId: string;

  @ApiProperty({
    description: 'Chat mode: global (command centre page) or page (scoped to specific resource)',
    enum: ChatMode,
    default: ChatMode.GLOBAL,
    example: ChatMode.GLOBAL,
  })
  @Expose()
  mode: ChatMode;

  @ApiProperty({
    description: 'Page context type: transaction, customer, refund, payout, dispute',
    enum: PageContextType,
    example: PageContextType.TRANSACTION,
  })
  @Expose()
  contextType?: PageContextType;

  @ApiProperty({
    description: 'Resource ID or reference (e.g., transaction reference, customer code)',
    example: 'ref_abc123',
  })
  @Expose()
  contextResourceId?: string;

  @ApiProperty({
    description: 'Timestamp when the conversation was created',
    example: '2024-01-01T12:00:00.000Z',
  })
  @Expose()
  createdAt: Date;

  static fromEntity(conversation: Conversation): ConversationResponseDto {
    const dto = new ConversationResponseDto();
    dto.id = conversation.id;
    dto.title = conversation.title;
    dto.userId = conversation.userId;
    dto.contextType = conversation.contextType;
    dto.contextResourceId = conversation.contextResourceId;
    dto.mode = conversation.mode;
    dto.createdAt = conversation.createdAt;
    return dto;
  }

  static fromEntities(conversations: Conversation[]): ConversationResponseDto[] {
    return conversations.map((conversation) => this.fromEntity(conversation));
  }
}
