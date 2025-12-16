/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { ChatMode, PageContextType } from '~/common/ai/types';
import { Conversation } from './entities/conversation.entity';
import { PaystackApiService } from '~/common/services/paystack-api.service';
import { PageContextService } from '~/common/services/page-context.service';
import { CreateConversationFromSummaryDto } from './dto/create-conversation-from-summary.dto';
import { Message } from './entities/message.entity';

describe('ChatService - Summarization', () => {
  let service: ChatService;
  let conversationRepository: jest.Mocked<ConversationRepository>;
  let messageRepository: jest.Mocked<MessageRepository>;
  let configService: { get: jest.Mock };

  const mockClosedConversation = {
    _id: {} as Conversation['_id'],
    id: 'closed-conversation-id',
    title: 'Closed Conversation',
    userId: 'user_123',
    createdAt: new Date('2024-01-01'),
    messages: [],
    mode: ChatMode.GLOBAL,
    summary: 'This is the summary of the conversation.',
    summaryCount: 2,
    previousSummary: 'This was carried over from before.',
    lastSummarizedMessageId: 'last-msg-id',
    isClosed: true,
  };

  const mockOpenConversation = {
    _id: {} as Conversation['_id'],
    id: 'open-conversation-id',
    title: 'Open Conversation',
    userId: 'user_123',
    createdAt: new Date('2024-01-01'),
    messages: [],
    mode: ChatMode.GLOBAL,
    summaryCount: 0,
    isClosed: false,
  };

  beforeEach(async () => {
    const mockConversationRepository = {
      findById: jest.fn(),
      findByIdAndUserId: jest.fn(),
      findByUserId: jest.fn(),
      findByUserIdAndMode: jest.fn(),
      findByUserIdAndContextType: jest.fn(),
      findByUserIdAndModeAndContextType: jest.fn(),
      createConversation: jest.fn(),
      deleteById: jest.fn(),
      deleteByIdForUser: jest.fn(),
      deleteAllByUserId: jest.fn(),
      save: jest.fn(),
    };

    const mockMessageRepository = {
      findByConversationId: jest.fn(),
      createMessage: jest.fn(),
      createMessages: jest.fn(),
      deleteAllByConversationId: jest.fn(),
      countUserMessagesInPeriod: jest.fn().mockResolvedValue(0),
      countUserMessagesByConversationId: jest.fn(),
      countUserMessagesAfterMessageId: jest.fn(),
      findMessagesAfterMessageId: jest.fn(),
      countByConversationId: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'SUMMARIZATION_THRESHOLD') {
          return 20;
        }
        if (key === 'MAX_SUMMARIES') {
          return 2;
        }
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: PaystackApiService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
        {
          provide: PageContextService,
          useValue: {
            enrichContext: jest.fn(),
          },
        },
        {
          provide: ConversationRepository,
          useValue: mockConversationRepository,
        },
        {
          provide: MessageRepository,
          useValue: mockMessageRepository,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    conversationRepository = module.get(ConversationRepository);
    messageRepository = module.get(MessageRepository);
  });

  describe('createConversationFromSummary', () => {
    it('should create a new conversation with carried-over summary', async () => {
      const dto: CreateConversationFromSummaryDto = {
        previousConversationId: 'closed-conversation-id',
        mode: ChatMode.GLOBAL,
      };

      const newConversation = {
        ...mockOpenConversation,
        id: 'new-conversation-id',
        title: 'Closed Conversation (continued)',
        previousSummary: 'This was carried over from before.\n\n---\n\nThis is the summary of the conversation.',
      };

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(mockClosedConversation);
      jest.spyOn(conversationRepository, 'createConversation').mockResolvedValue(newConversation);

      const result = await service.createConversationFromSummary(dto, 'user_123');

      expect(conversationRepository.findByIdAndUserId).toHaveBeenCalledWith('closed-conversation-id', 'user_123');
      expect(conversationRepository.createConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Closed Conversation (continued)',
          userId: 'user_123',
          mode: ChatMode.GLOBAL,
          previousSummary: 'This was carried over from before.\n\n---\n\nThis is the summary of the conversation.',
        }),
      );
      expect(result.previousSummary).toBe(
        'This was carried over from before.\n\n---\n\nThis is the summary of the conversation.',
      );
    });

    it('should create conversation with only summary when no previousSummary exists', async () => {
      const conversationWithoutPreviousSummary = {
        ...mockClosedConversation,
        previousSummary: undefined,
      };

      const dto: CreateConversationFromSummaryDto = {
        previousConversationId: 'closed-conversation-id',
        mode: ChatMode.GLOBAL,
      };

      const newConversation = {
        ...mockOpenConversation,
        id: 'new-conversation-id',
        title: 'Closed Conversation (continued)',
        previousSummary: 'This is the summary of the conversation.',
      };

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(conversationWithoutPreviousSummary);
      jest.spyOn(conversationRepository, 'createConversation').mockResolvedValue(newConversation);

      await service.createConversationFromSummary(dto, 'user_123');

      expect(conversationRepository.createConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          previousSummary: 'This is the summary of the conversation.',
        }),
      );
    });

    it('should throw NotFoundException when previous conversation not found', async () => {
      const dto: CreateConversationFromSummaryDto = {
        previousConversationId: 'non-existent-id',
        mode: ChatMode.GLOBAL,
      };

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.createConversationFromSummary(dto, 'user_123')).rejects.toThrow(NotFoundException);
      expect(conversationRepository.findByIdAndUserId).toHaveBeenCalledWith('non-existent-id', 'user_123');
    });

    it('should throw BadRequestException when previous conversation is not closed', async () => {
      const dto: CreateConversationFromSummaryDto = {
        previousConversationId: 'open-conversation-id',
        mode: ChatMode.GLOBAL,
      };

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(mockOpenConversation);

      await expect(service.createConversationFromSummary(dto, 'user_123')).rejects.toThrow(BadRequestException);
      await expect(service.createConversationFromSummary(dto, 'user_123')).rejects.toThrow(
        'Can only continue from a closed conversation',
      );
    });

    it('should carry over page context when creating from page-scoped conversation', async () => {
      const pageContextConversation = {
        ...mockClosedConversation,
        mode: ChatMode.PAGE,
        pageContext: { type: PageContextType.TRANSACTION, resourceId: 'ref_123' },
      };

      const dto: CreateConversationFromSummaryDto = {
        previousConversationId: 'closed-conversation-id',
        mode: ChatMode.PAGE,
        pageContext: { type: PageContextType.TRANSACTION, resourceId: 'ref_456' },
      };

      const newConversation = {
        ...mockOpenConversation,
        id: 'new-conversation-id',
        title: 'Closed Conversation (continued)',
        mode: ChatMode.PAGE,
        pageContext: dto.pageContext,
        previousSummary: 'This was carried over from before.\n\n---\n\nThis is the summary of the conversation.',
      };

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(pageContextConversation);
      jest.spyOn(conversationRepository, 'createConversation').mockResolvedValue(newConversation);

      const result = await service.createConversationFromSummary(dto, 'user_123');

      expect(conversationRepository.createConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: ChatMode.PAGE,
          pageContext: dto.pageContext,
        }),
      );
      expect(result.mode).toBe(ChatMode.PAGE);
      expect(result.pageContext).toEqual(dto.pageContext);
    });
  });

  describe('Message repository methods', () => {
    it('should count all messages in a conversation', async () => {
      jest.spyOn(messageRepository, 'countByConversationId').mockResolvedValue(25);

      const count = await messageRepository.countByConversationId('conversation-id');

      expect(count).toBe(25);
      expect(messageRepository.countByConversationId).toHaveBeenCalledWith('conversation-id');
    });

    it('should count messages after a specific message ID', async () => {
      jest.spyOn(messageRepository, 'countUserMessagesAfterMessageId').mockResolvedValue(10);

      const count = await messageRepository.countUserMessagesAfterMessageId('conversation-id', 'message-id');

      expect(count).toBe(10);
      expect(messageRepository.countUserMessagesAfterMessageId).toHaveBeenCalledWith('conversation-id', 'message-id');
    });

    it('should find messages after a specific message ID', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          conversationId: 'conversation-id',
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: 'Hello' }],
          createdAt: new Date(),
        },
      ] as Message[];

      jest.spyOn(messageRepository, 'findMessagesAfterMessageId').mockResolvedValue(mockMessages);

      const messages = await messageRepository.findMessagesAfterMessageId('conversation-id', 'message-id');

      expect(messages).toHaveLength(1);
      expect(messageRepository.findMessagesAfterMessageId).toHaveBeenCalledWith('conversation-id', 'message-id');
    });
  });
});
