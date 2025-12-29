import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Conversation } from '../entities/conversation.entity';
import { ChatMode, ResourceType, PageContext } from '~/common/ai/types';

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
    description: 'Page key where the conversation is scoped',
    example: {
      type: ResourceType.TRANSACTION,
      resourceId: 'ref_abc123',
    },
  })
  @Expose()
  pageContext?: PageContext;

  @ApiProperty({
    description: 'Chat mode: global (command centre page) or page (scoped to specific resource)',
    enum: ChatMode,
    default: ChatMode.GLOBAL,
    example: ChatMode.GLOBAL,
  })
  @Expose()
  mode: ChatMode;

  @ApiProperty({
    description: 'Summary of the conversation (generated after reaching message threshold)',
    example: 'The user asked about transaction failures. The assistant explained...',
    required: false,
  })
  @Expose()
  summary?: string;

  @ApiProperty({
    description: 'Number of times the conversation has been summarized (max 2)',
    example: 0,
  })
  @Expose()
  summaryCount: number;

  @ApiProperty({
    description: 'Summary carried over from a previous closed conversation',
    required: false,
  })
  @Expose()
  previousSummary?: string;

  @ApiProperty({
    description: 'ID of the last message included in the summary',
    required: false,
  })
  @Expose()
  lastSummarizedMessageId?: string;

  @ApiProperty({
    description: 'Whether the conversation is closed (after 2 summaries)',
    example: false,
  })
  @Expose()
  isClosed: boolean;

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
    dto.pageContext = conversation.pageContext;
    dto.createdAt = conversation.createdAt;
    dto.mode = conversation.mode;
    dto.summary = conversation.summary;
    dto.summaryCount = conversation.summaryCount;
    dto.previousSummary = conversation.previousSummary;
    dto.lastSummarizedMessageId = conversation.lastSummarizedMessageId;
    dto.isClosed = conversation.isClosed;
    return dto;
  }

  static fromEntities(conversations: Conversation[]): ConversationResponseDto[] {
    return conversations.map((conversation) => this.fromEntity(conversation));
  }
}
