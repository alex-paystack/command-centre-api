/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundError, ValidationError } from '~/common';
import { ChatService } from './chat.service';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { ChatMode, ResourceType } from '~/common/ai/types';
import { Conversation } from './entities/conversation.entity';
import { PaystackApiService } from '~/common/services/paystack-api.service';
import { PageContextService } from '~/common/services/page-context.service';
import { CreateConversationFromSummaryDto } from './dto/create-conversation-from-summary.dto';
import { Message, MessageRole } from './entities/message.entity';

// Mock the summarizeConversation function
// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('~/common/ai/actions', () => ({
  ...jest.requireActual('~/common/ai/actions'),
  summarizeConversation: jest.fn(),
}));

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
    lastActivityAt: new Date('2024-01-01'),
    expiresAt: new Date('2024-01-04'),
    messages: [],
    mode: ChatMode.GLOBAL,
    summary: 'This is the summary of the conversation.',
    summaryCount: 2,
    previousSummary: 'This was carried over from before.',
    lastSummarizedMessageId: 'last-msg-id',
    isClosed: true,
    totalTokensUsed: 0,
  };

  const mockOpenConversation = {
    _id: {} as Conversation['_id'],
    id: 'open-conversation-id',
    title: 'Open Conversation',
    userId: 'user_123',
    createdAt: new Date('2024-01-01'),
    lastActivityAt: new Date('2024-01-01'),
    expiresAt: new Date('2024-01-04'),
    messages: [],
    mode: ChatMode.GLOBAL,
    summaryCount: 0,
    isClosed: false,
    totalTokensUsed: 0,
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
      refreshExpiryWindow: jest.fn(),
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

    it('should throw NotFoundError when previous conversation is not found', async () => {
      const dto: CreateConversationFromSummaryDto = {
        previousConversationId: 'non-existent-id',
        mode: ChatMode.GLOBAL,
      };

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.createConversationFromSummary(dto, 'user_123')).rejects.toThrow(NotFoundError);
      expect(conversationRepository.findByIdAndUserId).toHaveBeenCalledWith('non-existent-id', 'user_123');
    });

    it('should throw ValidationError when previous conversation is not closed', async () => {
      const dto: CreateConversationFromSummaryDto = {
        previousConversationId: 'open-conversation-id',
        mode: ChatMode.GLOBAL,
      };

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(mockOpenConversation);

      await expect(service.createConversationFromSummary(dto, 'user_123')).rejects.toThrow(ValidationError);
      await expect(service.createConversationFromSummary(dto, 'user_123')).rejects.toThrow(
        'Can only continue from a closed conversation',
      );
    });

    it('should carry over page context when creating from page-scoped conversation', async () => {
      const pageContextConversation = {
        ...mockClosedConversation,
        mode: ChatMode.PAGE,
        pageContext: { type: ResourceType.TRANSACTION, resourceId: 'ref_123' },
      };

      const dto: CreateConversationFromSummaryDto = {
        previousConversationId: 'closed-conversation-id',
        mode: ChatMode.PAGE,
        pageContext: { type: ResourceType.TRANSACTION, resourceId: 'ref_456' },
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

  describe('handleMessageSummarization', () => {
    it('should not fail the request if summarization fails', async () => {
      const conversation = { ...mockOpenConversation, totalTokensUsed: 70000 };
      const mockMessages = Array.from({ length: 20 }, (_, i) => ({
        _id: {} as Message['_id'],
        id: `msg-${i}`,
        conversationId: conversation.id,
        role: i % 2 === 0 ? MessageRole.USER : MessageRole.ASSISTANT,
        parts: [{ type: 'text' as const, text: `Message ${i}` }],
        createdAt: new Date(),
        expiresAt: new Date(),
        conversation,
      }));

      jest.spyOn(messageRepository, 'findByConversationId').mockResolvedValue(mockMessages);
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(conversation);
      jest.spyOn(conversationRepository, 'save').mockResolvedValue(conversation);

      const { summarizeConversation } = await import('~/common/ai/actions');
      (summarizeConversation as jest.Mock).mockRejectedValue(new Error('AI service unavailable'));

      // Should not throw even when summarization fails (add tokens to trigger summarization)
      await expect(
        service.handleMessageSummarization({
          conversation,
          userId: 'user_123',
          savedMessages: [],
          tokenCountForThisInteraction: 10000,
        }),
      ).resolves.toBeUndefined();
    });

    describe('Token-based summarization', () => {
      beforeEach(() => {
        configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
          if (key === 'CONTEXT_WINDOW_SIZE') {
            return 128000;
          }
          if (key === 'TOKEN_THRESHOLD_PERCENTAGE') {
            return 0.6;
          }
          if (key === 'MAX_SUMMARIES') {
            return 2;
          }
          return defaultValue;
        });
      });

      it('should accumulate token count when tokenCountForThisInteraction is provided', async () => {
        const conversation = { ...mockOpenConversation, totalTokensUsed: 10000 };
        jest.spyOn(conversationRepository, 'save').mockResolvedValue(conversation);
        jest.spyOn(messageRepository, 'countUserMessagesByConversationId').mockResolvedValue(5);

        await service.handleMessageSummarization({
          conversation,
          userId: 'user_123',
          savedMessages: [],
          tokenCountForThisInteraction: 5000,
        });

        // Should save with accumulated tokens (10000 + 5000 = 15000)
        expect(conversationRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            totalTokensUsed: 15000,
          }),
        );
      });

      it('should not trigger summarization when token count is below threshold', async () => {
        const conversation = { ...mockOpenConversation, totalTokensUsed: 50000 };
        jest.spyOn(conversationRepository, 'save').mockResolvedValue(conversation);
        jest.spyOn(messageRepository, 'countUserMessagesByConversationId').mockResolvedValue(5);

        await service.handleMessageSummarization({
          conversation,
          userId: 'user_123',
          savedMessages: [],
          tokenCountForThisInteraction: 10000,
        });

        // Should only save once for token accumulation, not for summarization
        expect(conversationRepository.save).toHaveBeenCalledTimes(1);
        expect(conversationRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            totalTokensUsed: 60000,
          }),
        );
      });

      it('should trigger summarization when token count reaches 60% threshold', async () => {
        const conversation = { ...mockOpenConversation, totalTokensUsed: 70000 };
        const mockMessages = Array.from({ length: 10 }, (_, i) => ({
          _id: {} as Message['_id'],
          id: `msg-${i}`,
          conversationId: conversation.id,
          role: i % 2 === 0 ? MessageRole.USER : MessageRole.ASSISTANT,
          parts: [{ type: 'text' as const, text: `Message ${i}` }],
          createdAt: new Date(),
          expiresAt: new Date(),
          conversation,
        }));

        jest.spyOn(conversationRepository, 'save').mockResolvedValue(conversation);
        jest.spyOn(messageRepository, 'findByConversationId').mockResolvedValue(mockMessages);
        jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(conversation);

        const { summarizeConversation } = await import('~/common/ai/actions');
        (summarizeConversation as jest.Mock).mockResolvedValue('Token-based summary.');

        // Add 7000 tokens to reach 77000 (above 76800 threshold: 128000 * 0.6)
        await service.handleMessageSummarization({
          conversation,
          userId: 'user_123',
          savedMessages: [],
          tokenCountForThisInteraction: 7000,
        });

        // Should trigger summarization
        expect(conversationRepository.save).toHaveBeenCalled();
      });

      it('should reset token counter to 0 after summarization', async () => {
        const conversation = { ...mockOpenConversation, totalTokensUsed: 70000 };
        const mockMessages = Array.from({ length: 10 }, (_, i) => ({
          _id: {} as Message['_id'],
          id: `msg-${i}`,
          conversationId: conversation.id,
          role: i % 2 === 0 ? MessageRole.USER : MessageRole.ASSISTANT,
          parts: [{ type: 'text' as const, text: `Message ${i}` }],
          createdAt: new Date(),
          expiresAt: new Date(),
          conversation,
        }));

        jest.spyOn(conversationRepository, 'save').mockResolvedValue(conversation);
        jest.spyOn(messageRepository, 'findByConversationId').mockResolvedValue(mockMessages);
        jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(conversation);

        const { summarizeConversation } = await import('~/common/ai/actions');
        (summarizeConversation as jest.Mock).mockResolvedValue('Token-based summary.');

        await service.handleMessageSummarization({
          conversation,
          userId: 'user_123',
          savedMessages: [],
          tokenCountForThisInteraction: 7000,
        });

        // Find the call that includes the summary (second save call)
        const summarizationCall = conversationRepository.save.mock.calls.find((call) =>
          Object.prototype.hasOwnProperty.call(call[0], 'summary'),
        );

        expect(summarizationCall).toBeDefined();
        expect(summarizationCall?.[0]).toMatchObject({
          totalTokensUsed: 0,
        });
      });

      it('should calculate threshold correctly with different context window sizes', async () => {
        configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
          if (key === 'CONTEXT_WINDOW_SIZE') {
            return 200000; // Different model
          }
          if (key === 'TOKEN_THRESHOLD_PERCENTAGE') {
            return 0.6;
          }
          if (key === 'MAX_SUMMARIES') {
            return 2;
          }
          return defaultValue;
        });

        // Threshold should be 200000 * 0.6 = 120000
        const conversation = { ...mockOpenConversation, totalTokensUsed: 115000 };
        const mockMessages = Array.from({ length: 10 }, (_, i) => ({
          _id: {} as Message['_id'],
          id: `msg-${i}`,
          conversationId: conversation.id,
          role: i % 2 === 0 ? MessageRole.USER : MessageRole.ASSISTANT,
          parts: [{ type: 'text' as const, text: `Message ${i}` }],
          createdAt: new Date(),
          expiresAt: new Date(),
          conversation,
        }));

        jest.spyOn(conversationRepository, 'save').mockResolvedValue(conversation);
        jest.spyOn(messageRepository, 'findByConversationId').mockResolvedValue(mockMessages);
        jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(conversation);

        const { summarizeConversation } = await import('~/common/ai/actions');
        (summarizeConversation as jest.Mock).mockResolvedValue('Summary with larger context.');

        // Add 6000 tokens to reach 121000 (above 120000 threshold)
        await service.handleMessageSummarization({
          conversation,
          userId: 'user_123',
          savedMessages: [],
          tokenCountForThisInteraction: 6000,
        });

        expect(conversationRepository.save).toHaveBeenCalled();
      });
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
