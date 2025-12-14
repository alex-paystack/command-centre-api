/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatMode } from '../../common/ai/types';
import { Conversation } from './entities/conversation.entity';
import { Message, MessageRole } from './entities/message.entity';
import { RateLimitExceededException } from './exceptions/rate-limit-exceeded.exception';
import { PaystackApiService } from '../../common/services/paystack-api.service';
import { PageContextService } from '../../common/services/page-context.service';
import { MessageClassificationIntent, ChatResponseType, PageContextType } from '../../common/ai/types';

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('../../common/ai/actions', () => ({
  ...jest.requireActual('../../common/ai/actions'),
  classifyMessage: jest.fn(),
}));

describe('ChatService', () => {
  let service: ChatService;
  let conversationRepository: jest.Mocked<ConversationRepository>;
  let messageRepository: jest.Mocked<MessageRepository>;
  let configService: { get: jest.Mock };

  const mockConversation: Conversation = {
    _id: {} as Conversation['_id'],
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Conversation',
    userId: 'user_123',
    pageKey: 'dashboard/payments',
    createdAt: new Date('2024-01-01'),
    messages: [],
  };

  const mockMessage: Message = {
    _id: {} as Message['_id'],
    id: '987fcdeb-51a2-43e7-b890-123456789abc',
    conversationId: '123e4567-e89b-12d3-a456-426614174000',
    role: MessageRole.USER,
    parts: [{ type: 'text', text: 'Hello' }],
    createdAt: new Date('2024-01-01'),
    conversation: mockConversation,
    generateId: jest.fn(),
  };

  beforeEach(async () => {
    const mockConversationRepository = {
      findById: jest.fn(),
      findByIdAndUserId: jest.fn(),
      findByUserId: jest.fn(),
      findByUserIdAndPageKey: jest.fn(),
      createConversation: jest.fn(),
      deleteById: jest.fn(),
      deleteByIdForUser: jest.fn(),
      deleteAllByUserId: jest.fn(),
    };

    const mockMessageRepository = {
      findByConversationId: jest.fn(),
      createMessage: jest.fn(),
      createMessages: jest.fn(),
      deleteAllByConversationId: jest.fn(),
      countUserMessagesInPeriod: jest.fn().mockResolvedValue(0),
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveConversation', () => {
    it('should create and return a conversation', async () => {
      const dto: CreateConversationDto = {
        id: mockConversation.id,
        title: mockConversation.title,
        userId: mockConversation.userId,
        pageKey: mockConversation.pageKey,
      };

      jest.spyOn(conversationRepository, 'createConversation').mockResolvedValue(mockConversation);

      const result = await service.saveConversation(dto);

      expect(conversationRepository.createConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: dto.id,
          title: dto.title,
          userId: dto.userId,
          pageKey: dto.pageKey,
        }),
      );
      expect(result.id).toBe(mockConversation.id);
      expect(result.title).toBe(mockConversation.title);
      expect(result.userId).toBe(mockConversation.userId);
    });
  });

  describe('getConversationById', () => {
    it('should return a conversation by id', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(mockConversation);

      const result = await service.getConversationById(mockConversation.id, mockConversation.userId);

      expect(conversationRepository.findByIdAndUserId).toHaveBeenCalledWith(
        mockConversation.id,
        mockConversation.userId,
      );
      expect(result.id).toBe(mockConversation.id);
    });

    it('should throw NotFoundException when conversation not found', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.getConversationById('non-existent-id', mockConversation.userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when conversation belongs to another user', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null); // repo is user-scoped, so returns null

      await expect(service.getConversationById(mockConversation.id, 'other-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getConversationsByUserId', () => {
    it('should return conversations for a user', async () => {
      jest.spyOn(conversationRepository, 'findByUserId').mockResolvedValue([mockConversation]);

      const result = await service.getConversationsByUserId('user_123');

      expect(conversationRepository.findByUserId).toHaveBeenCalledWith('user_123');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockConversation.id);
    });

    it('should return empty array when user has no conversations', async () => {
      jest.spyOn(conversationRepository, 'findByUserId').mockResolvedValue([]);

      const result = await service.getConversationsByUserId('user_123');

      expect(result).toEqual([]);
    });

    it('should filter conversations by page key when provided', async () => {
      jest.spyOn(conversationRepository, 'findByUserIdAndPageKey').mockResolvedValue([mockConversation]);

      const result = await service.getConversationsByUserId('user_123', 'dashboard/payments');

      expect(conversationRepository.findByUserIdAndPageKey).toHaveBeenCalledWith('user_123', 'dashboard/payments');
      expect(result).toHaveLength(1);
      expect(result[0].pageKey).toBe('dashboard/payments');
    });
  });

  describe('deleteConversationById', () => {
    it('should delete a conversation and its messages', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(mockConversation);
      jest.spyOn(messageRepository, 'deleteAllByConversationId').mockResolvedValue(2);
      jest.spyOn(conversationRepository, 'deleteByIdForUser').mockResolvedValue(true);

      await service.deleteConversationById(mockConversation.id, mockConversation.userId);

      expect(conversationRepository.findByIdAndUserId).toHaveBeenCalledWith(
        mockConversation.id,
        mockConversation.userId,
      );
      expect(messageRepository.deleteAllByConversationId).toHaveBeenCalledWith(mockConversation.id);
      expect(conversationRepository.deleteByIdForUser).toHaveBeenCalledWith(
        mockConversation.id,
        mockConversation.userId,
      );
    });

    it('should throw NotFoundException when conversation not found', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.deleteConversationById('non-existent-id', mockConversation.userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when deleting another user’s conversation', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.deleteConversationById(mockConversation.id, 'other-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteAllConversationsByUserId', () => {
    it('should delete all conversations and messages for a user', async () => {
      jest.spyOn(conversationRepository, 'findByUserId').mockResolvedValue([mockConversation]);
      jest.spyOn(messageRepository, 'deleteAllByConversationId').mockResolvedValue(2);
      jest.spyOn(conversationRepository, 'deleteAllByUserId').mockResolvedValue(1);

      const result = await service.deleteAllConversationsByUserId('user_123');

      expect(conversationRepository.findByUserId).toHaveBeenCalledWith('user_123');
      expect(messageRepository.deleteAllByConversationId).toHaveBeenCalledWith(mockConversation.id);
      expect(conversationRepository.deleteAllByUserId).toHaveBeenCalledWith('user_123');
      expect(result).toBe(1);
    });
  });

  describe('saveMessages', () => {
    it('should create and return messages', async () => {
      const dtos: CreateMessageDto[] = [
        {
          conversationId: mockMessage.conversationId,
          role: MessageRole.USER,
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ];

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(mockConversation);
      jest.spyOn(messageRepository, 'createMessages').mockResolvedValue([mockMessage]);
      jest.spyOn(messageRepository, 'countUserMessagesInPeriod').mockResolvedValue(0);

      const result = await service.saveMessages(dtos, mockConversation.userId);

      expect(conversationRepository.findByIdAndUserId).toHaveBeenCalledWith(
        dtos[0].conversationId,
        mockConversation.userId,
      );
      expect(messageRepository.createMessages).toHaveBeenCalledWith([
        expect.objectContaining({
          conversationId: dtos[0].conversationId,
          role: dtos[0].role,
        }),
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockMessage.id);
      expect(result[0].conversationId).toBe(mockMessage.conversationId);
      expect(result[0].role).toBe(mockMessage.role);
    });

    it('should return empty array when given empty array', async () => {
      const result = await service.saveMessages([], mockConversation.userId);

      expect(result).toEqual([]);
    });

    it('should throw error when messages belong to different conversations', async () => {
      const dtos: CreateMessageDto[] = [
        {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          role: MessageRole.USER,
          parts: [{ type: 'text', text: 'Hello' }],
        },
        {
          conversationId: '987fcdeb-51a2-43e7-b890-123456789abc',
          role: MessageRole.USER,
          parts: [{ type: 'text', text: 'Hi' }],
        },
      ];

      await expect(service.saveMessages(dtos, mockConversation.userId)).rejects.toThrow(
        'All messages must belong to the same conversation',
      );
    });

    it('should throw NotFoundException when conversation not found', async () => {
      const dtos: CreateMessageDto[] = [
        {
          conversationId: 'non-existent-id',
          role: MessageRole.USER,
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ];

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.saveMessages(dtos, mockConversation.userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when trying to save to another user’s conversation', async () => {
      const dtos: CreateMessageDto[] = [
        {
          conversationId: mockConversation.id,
          role: MessageRole.USER,
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ];

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.saveMessages(dtos, 'other-user')).rejects.toThrow(NotFoundException);
    });

    it('should enforce rate limits and throw RateLimitExceededException', async () => {
      const dtos: CreateMessageDto[] = [
        {
          conversationId: mockConversation.id,
          role: MessageRole.USER,
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ];

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(mockConversation);
      jest.spyOn(messageRepository, 'countUserMessagesInPeriod').mockResolvedValue(5);
      configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'MESSAGE_LIMIT') return 3;
        if (key === 'RATE_LIMIT_PERIOD_HOURS') return 24;
        return defaultValue;
      });

      await expect(service.saveMessages(dtos, mockConversation.userId)).rejects.toThrow(RateLimitExceededException);
    });
  });

  describe('getMessagesByConversationId', () => {
    it('should return messages for a conversation', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(mockConversation);
      jest.spyOn(messageRepository, 'findByConversationId').mockResolvedValue([mockMessage]);

      const result = await service.getMessagesByConversationId(mockConversation.id, mockConversation.userId);

      expect(conversationRepository.findByIdAndUserId).toHaveBeenCalledWith(
        mockConversation.id,
        mockConversation.userId,
      );
      expect(messageRepository.findByConversationId).toHaveBeenCalledWith(mockConversation.id);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockMessage.id);
    });

    it('should return empty array when conversation has no messages', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(mockConversation);
      jest.spyOn(messageRepository, 'findByConversationId').mockResolvedValue([]);

      const result = await service.getMessagesByConversationId(mockConversation.id, mockConversation.userId);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when accessing another user’s conversation', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.getMessagesByConversationId(mockConversation.id, 'other-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('checkUserEntitlement', () => {
    it('should not throw when user is under message limit', async () => {
      jest.spyOn(messageRepository, 'countUserMessagesInPeriod').mockResolvedValue(50);
      configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'MESSAGE_LIMIT') {
          return 100;
        }
        if (key === 'RATE_LIMIT_PERIOD_HOURS') {
          return 24;
        }
        return defaultValue;
      });

      await expect(service.checkUserEntitlement('user_123')).resolves.toBeUndefined();
      expect(messageRepository.countUserMessagesInPeriod).toHaveBeenCalledWith('user_123', 24);
    });

    it('should throw RateLimitExceededException when user exceeds message limit', async () => {
      jest.spyOn(messageRepository, 'countUserMessagesInPeriod').mockResolvedValue(150);
      configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'MESSAGE_LIMIT') {
          return 100;
        }
        if (key === 'RATE_LIMIT_PERIOD_HOURS') {
          return 24;
        }
        return defaultValue;
      });

      await expect(service.checkUserEntitlement('user_123')).rejects.toThrow(RateLimitExceededException);
    });

    it('should throw RateLimitExceededException when user is exactly at the limit', async () => {
      jest.spyOn(messageRepository, 'countUserMessagesInPeriod').mockResolvedValue(100);
      configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'MESSAGE_LIMIT') {
          return 100;
        }
        if (key === 'RATE_LIMIT_PERIOD_HOURS') {
          return 24;
        }
        return defaultValue;
      });

      await expect(service.checkUserEntitlement('user_123')).rejects.toThrow(RateLimitExceededException);
    });

    it('should use default values when config values are not set', async () => {
      jest.spyOn(messageRepository, 'countUserMessagesInPeriod').mockResolvedValue(50);
      configService.get.mockImplementation((key: string, defaultValue?: unknown) => defaultValue);

      await expect(service.checkUserEntitlement('user_123')).resolves.toBeUndefined();
      expect(messageRepository.countUserMessagesInPeriod).toHaveBeenCalledWith('user_123', 24);
    });
  });

  describe('handleMessageClassification', () => {
    const mockUIMessage = {
      id: 'msg_123',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'Can you help me with my taxes?' }],
    };
    const mockHistory = [mockUIMessage];

    let classifyMessage: jest.Mock;

    beforeEach(async () => {
      // Get the mocked classifyMessage function
      const aiActions = await import('../../common/ai/actions');
      classifyMessage = aiActions.classifyMessage as jest.Mock;
      jest.clearAllMocks();
    });

    it('should return refusal response when message is OUT_OF_SCOPE', async () => {
      classifyMessage.mockResolvedValue({
        intent: MessageClassificationIntent.OUT_OF_SCOPE,
        confidence: 0.95,
        needsMerchantData: false,
        suggestedClarification: null,
      });

      const result = await service.handleMessageClassification(mockHistory);

      expect(classifyMessage).toHaveBeenCalledWith(mockHistory);
      expect(result).toBeDefined();
      expect(result?.type).toBe(ChatResponseType.REFUSAL);
      expect(result?.responseStream).toBeDefined();
    });

    it('should return null when message classification is DASHBOARD_INSIGHT', async () => {
      classifyMessage.mockResolvedValue({
        intent: MessageClassificationIntent.DASHBOARD_INSIGHT,
        confidence: 0.9,
        needsMerchantData: true,
      });

      const result = await service.handleMessageClassification(mockHistory);

      expect(classifyMessage).toHaveBeenCalledWith(mockHistory);
      expect(result).toBeNull();
    });

    it('should return null when message classification is PAYSTACK_PRODUCT_FAQ', async () => {
      classifyMessage.mockResolvedValue({
        intent: MessageClassificationIntent.PAYSTACK_PRODUCT_FAQ,
        confidence: 0.88,
        needsMerchantData: false,
      });

      const result = await service.handleMessageClassification(mockHistory);

      expect(classifyMessage).toHaveBeenCalledWith(mockHistory);
      expect(result).toBeNull();
    });

    it('should return null when message classification is ACCOUNT_HELP', async () => {
      classifyMessage.mockResolvedValue({
        intent: MessageClassificationIntent.ACCOUNT_HELP,
        confidence: 0.92,
        needsMerchantData: true,
      });

      const result = await service.handleMessageClassification(mockHistory);

      expect(classifyMessage).toHaveBeenCalledWith(mockHistory);
      expect(result).toBeNull();
    });

    it('should return null when message classification is ASSISTANT_CAPABILITIES', async () => {
      classifyMessage.mockResolvedValue({
        intent: MessageClassificationIntent.ASSISTANT_CAPABILITIES,
        confidence: 0.85,
        needsMerchantData: false,
      });

      const result = await service.handleMessageClassification(mockHistory);

      expect(classifyMessage).toHaveBeenCalledWith(mockHistory);
      expect(result).toBeNull();
    });
  });

  describe('handleStreamingChat', () => {
    it('should throw NotFoundException when conversation exists but belongs to another user', async () => {
      jest.spyOn(conversationRepository, 'findById').mockResolvedValue({ ...mockConversation, userId: 'someone-else' });

      await expect(
        service.handleStreamingChat(
          {
            conversationId: mockConversation.id,
            message: { id: '123', role: MessageRole.USER, parts: [{ type: 'text', text: 'hi' }] },
          },
          mockConversation.userId,
          'mock-jwt-token',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Page-Scoped Chat', () => {
    describe('buildPageScopedPrompt', () => {
      it('should build prompt with transaction context', () => {
        const enrichedContext = {
          type: PageContextType.TRANSACTION,
          resourceId: 'ref_123',
          resourceData: { id: 123, reference: 'ref_123' },
          formattedData: 'Transaction Details:\n- Reference: ref_123\n- Amount: NGN 1000.00',
        };

        const prompt = service['buildPageScopedPrompt'](enrichedContext);

        expect(prompt).toContain('Transaction');
        expect(prompt).toContain('Transaction Details');
        expect(prompt).toContain('ref_123');
      });

      it('should build prompt with customer context', () => {
        const enrichedContext = {
          type: PageContextType.CUSTOMER,
          resourceId: 'CUS_123',
          resourceData: { customer_code: 'CUS_123', email: 'test@example.com' },
          formattedData: 'Customer Details:\n- Customer Code: CUS_123\n- Email: test@example.com',
        };

        const prompt = service['buildPageScopedPrompt'](enrichedContext);

        expect(prompt).toContain('Customer');
        expect(prompt).toContain('Customer Details');
        expect(prompt).toContain('CUS_123');
      });

      it('should include current date in prompt', () => {
        const enrichedContext = {
          type: PageContextType.TRANSACTION,
          resourceId: 'ref_123',
          resourceData: {},
          formattedData: 'Transaction Details',
        };

        const prompt = service['buildPageScopedPrompt'](enrichedContext);
        const currentDate = new Date().toISOString().split('T')[0];

        expect(prompt).toContain(currentDate);
      });
    });

    describe('handleStreamingChat with ChatMode', () => {
      beforeEach(() => {
        jest.spyOn(conversationRepository, 'findById').mockResolvedValue(mockConversation);
        jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(mockConversation);
        jest.spyOn(messageRepository, 'findByConversationId').mockResolvedValue([]);
        jest.spyOn(messageRepository, 'createMessage').mockResolvedValue(mockMessage);
        jest.spyOn(messageRepository, 'countUserMessagesInPeriod').mockResolvedValue(0);
      });

      it('should throw BadRequestException when mode is PAGE but pageContext is missing', async () => {
        await expect(
          service.handleStreamingChat(
            {
              conversationId: mockConversation.id,
              message: { id: '123', role: MessageRole.USER, parts: [{ type: 'text', text: 'hi' }] },
              mode: ChatMode.PAGE,
            },
            mockConversation.userId,
            'mock-jwt-token',
          ),
        ).rejects.toThrow('pageContext is required when mode is "page"');
      });
    });
  });
});
