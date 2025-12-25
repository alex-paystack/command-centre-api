/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChatMode } from '~/common/ai/types';
import { Conversation } from './entities/conversation.entity';
import { Message, MessageRole } from './entities/message.entity';
import { RateLimitExceededException } from './exceptions/rate-limit-exceeded.exception';
import { PaystackApiService } from '~/common/services/paystack-api.service';
import { PageContextService } from '~/common/services/page-context.service';
import {
  MessageClassificationIntent,
  ChatResponseType,
  PageContextType,
  ClassificationUIMessage,
} from '~/common/ai/types';
import { NotFoundError } from '~/common';
import { InferUIMessageChunk } from 'ai';

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('~/common/ai/actions', () => ({
  ...jest.requireActual('~/common/ai/actions'),
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
    pageContext: { type: PageContextType.TRANSACTION, resourceId: 'ref_abc123' },
    createdAt: new Date('2024-01-01'),
    lastActivityAt: new Date('2024-01-01'),
    expiresAt: new Date('2024-01-04'),
    messages: [],
    mode: ChatMode.PAGE,
    summaryCount: 0,
    isClosed: false,
    totalTokensUsed: 0,
  };

  const mockMessage: Message = {
    _id: {} as Message['_id'],
    id: '987fcdeb-51a2-43e7-b890-123456789abc',
    conversationId: '123e4567-e89b-12d3-a456-426614174000',
    role: MessageRole.USER,
    parts: [{ type: 'text', text: 'Hello' }],
    createdAt: new Date('2024-01-01'),
    expiresAt: new Date('2024-01-04'),
    conversation: mockConversation,
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

  describe('saveConversation', () => {
    it('should create and return a conversation', async () => {
      const dto = mockConversation;

      jest.spyOn(conversationRepository, 'createConversation').mockResolvedValue(mockConversation);

      const result = await service.saveConversation(dto);

      expect(conversationRepository.createConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: dto.id,
          title: dto.title,
          userId: dto.userId,
          pageContext: dto.pageContext,
          mode: dto.mode,
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

    it('should throw NotFoundError when conversation not found', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.getConversationById('non-existent-id', mockConversation.userId)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw NotFoundError when conversation belongs to another user', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null); // repo is user-scoped, so returns null

      await expect(service.getConversationById(mockConversation.id, 'other-user')).rejects.toThrow(NotFoundError);
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

    it('should filter conversations by context type when provided', async () => {
      jest.spyOn(conversationRepository, 'findByUserIdAndContextType').mockResolvedValue([mockConversation]);

      const result = await service.getConversationsByUserId('user_123', PageContextType.TRANSACTION);

      expect(conversationRepository.findByUserIdAndContextType).toHaveBeenCalledWith(
        'user_123',
        PageContextType.TRANSACTION,
      );
      expect(result).toHaveLength(1);
      expect(result[0].pageContext?.type).toBe(PageContextType.TRANSACTION);
      expect(result[0].pageContext?.resourceId).toBe('ref_abc123');
    });

    it('should filter conversations by mode when provided', async () => {
      jest.spyOn(conversationRepository, 'findByUserIdAndMode').mockResolvedValue([mockConversation]);

      const result = await service.getConversationsByUserId('user_123', undefined, ChatMode.PAGE);

      expect(conversationRepository.findByUserIdAndMode).toHaveBeenCalledWith('user_123', ChatMode.PAGE);
      expect(result).toHaveLength(1);
      expect(result[0].mode).toBe(ChatMode.PAGE);
    });

    it('should filter conversations by context type and mode when provided', async () => {
      jest.spyOn(conversationRepository, 'findByUserIdAndModeAndContextType').mockResolvedValue([mockConversation]);

      const result = await service.getConversationsByUserId('user_123', PageContextType.TRANSACTION, ChatMode.PAGE);

      expect(conversationRepository.findByUserIdAndModeAndContextType).toHaveBeenCalledWith(
        'user_123',
        ChatMode.PAGE,
        PageContextType.TRANSACTION,
      );
      expect(result).toHaveLength(1);
      expect(result[0].pageContext?.type).toBe(PageContextType.TRANSACTION);
      expect(result[0].pageContext?.resourceId).toBe('ref_abc123');
      expect(result[0].mode).toBe(ChatMode.PAGE);
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

    it('should throw NotFoundError when conversation not found', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.deleteConversationById('non-existent-id', mockConversation.userId)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw NotFoundError when deleting another user’s conversation', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.deleteConversationById(mockConversation.id, 'other-user')).rejects.toThrow(NotFoundError);
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
          id: '589fcdeb-51a2-43e7-b890-123456789abc',
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

    it('should throw when conversation is closed', async () => {
      const closedConversation = { ...mockConversation, isClosed: true };
      const dtos: CreateMessageDto[] = [
        {
          conversationId: closedConversation.id,
          role: MessageRole.USER,
          parts: [{ type: 'text', text: 'Hello' }],
          id: '589fcdeb-51a2-43e7-b890-123456789abc',
        },
      ];

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(closedConversation);

      await expect(service.saveMessages(dtos, closedConversation.userId)).rejects.toThrow('Conversation is closed');
      expect(messageRepository.createMessages).not.toHaveBeenCalled();
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
          id: '123e4567-e89b-12d3-a456-426614174000',
        },
        {
          conversationId: '987fcdeb-51a2-43e7-b890-123456789abc',
          role: MessageRole.USER,
          parts: [{ type: 'text', text: 'Hi' }],
          id: '987fcdeb-51a2-43e7-b890-123456789abc',
        },
      ];

      await expect(service.saveMessages(dtos, mockConversation.userId)).rejects.toThrow(
        'All messages must belong to the same conversation',
      );
    });

    it('should throw NotFoundError when conversation not found', async () => {
      const dtos: CreateMessageDto[] = [
        {
          conversationId: 'non-existent-id',
          role: MessageRole.USER,
          parts: [{ type: 'text', text: 'Hello' }],
          id: '589fcdeb-51a2-43e7-b890-123456789abc',
        },
      ];

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.saveMessages(dtos, mockConversation.userId)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when trying to save to another user’s conversation', async () => {
      const dtos: CreateMessageDto[] = [
        {
          conversationId: mockConversation.id,
          role: MessageRole.USER,
          parts: [{ type: 'text', text: 'Hello' }],
          id: '589fcdeb-51a2-43e7-b890-123456789abc',
        },
      ];

      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.saveMessages(dtos, 'other-user')).rejects.toThrow(NotFoundError);
    });

    it('should enforce rate limits and throw RateLimitExceededException', async () => {
      const dtos: CreateMessageDto[] = [
        {
          conversationId: mockConversation.id,
          role: MessageRole.USER,
          parts: [{ type: 'text', text: 'Hello' }],
          id: '589fcdeb-51a2-43e7-b890-123456789abc',
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

    it('should throw NotFoundError when accessing another user’s conversation', async () => {
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(null);

      await expect(service.getMessagesByConversationId(mockConversation.id, 'other-user')).rejects.toThrow(
        NotFoundError,
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
      const aiActions = await import('~/common/ai/actions');
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

      expect(classifyMessage).toHaveBeenCalledWith(mockHistory, undefined);
      expect(result).toBeDefined();
      expect(result?.type).toBe(ChatResponseType.REFUSAL);
      expect(result?.responseStream).toBeDefined();
    });

    it('should return refusal response when message is OUT_OF_PAGE_SCOPE', async () => {
      const mockUIMessage = {
        id: 'msg_123',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'How many terminals have I created?' }],
      };
      const mockHistory = [mockUIMessage];
      const mockPageContext = {
        type: PageContextType.TRANSACTION,
        resourceId: 'ref_123',
      };

      classifyMessage.mockResolvedValue({
        intent: MessageClassificationIntent.OUT_OF_PAGE_SCOPE,
        confidence: 0.95,
        needsMerchantData: false,
      });

      const result = await service.handleMessageClassification(mockHistory, mockPageContext);

      expect(classifyMessage).toHaveBeenCalledWith(mockHistory, mockPageContext);
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

      expect(classifyMessage).toHaveBeenCalledWith(mockHistory, undefined);
      expect(result).toBeNull();
    });

    it('should return null when message classification is PAYSTACK_PRODUCT_FAQ', async () => {
      classifyMessage.mockResolvedValue({
        intent: MessageClassificationIntent.PAYSTACK_PRODUCT_FAQ,
        confidence: 0.88,
        needsMerchantData: false,
      });

      const result = await service.handleMessageClassification(mockHistory);

      expect(classifyMessage).toHaveBeenCalledWith(mockHistory, undefined);
      expect(result).toBeNull();
    });

    it('should return null when message classification is ACCOUNT_HELP', async () => {
      classifyMessage.mockResolvedValue({
        intent: MessageClassificationIntent.ACCOUNT_HELP,
        confidence: 0.92,
        needsMerchantData: true,
      });

      const result = await service.handleMessageClassification(mockHistory);

      expect(classifyMessage).toHaveBeenCalledWith(mockHistory, undefined);
      expect(result).toBeNull();
    });

    it('should return null when message classification is ASSISTANT_CAPABILITIES', async () => {
      classifyMessage.mockResolvedValue({
        intent: MessageClassificationIntent.ASSISTANT_CAPABILITIES,
        confidence: 0.85,
        needsMerchantData: false,
      });

      const result = await service.handleMessageClassification(mockHistory);

      expect(classifyMessage).toHaveBeenCalledWith(mockHistory, undefined);
      expect(result).toBeNull();
    });

    it('should allow message when OUT_OF_SCOPE but low confidence', async () => {
      classifyMessage.mockResolvedValue({
        intent: MessageClassificationIntent.OUT_OF_SCOPE,
        confidence: 0.4,
        needsMerchantData: false,
      });

      const result = await service.handleMessageClassification(mockHistory);

      expect(classifyMessage).toHaveBeenCalledWith(mockHistory, undefined);
      expect(result).toBeNull();
    });

    it('should allow message when OUT_OF_PAGE_SCOPE but low confidence', async () => {
      const mockPageContext = {
        type: PageContextType.TRANSACTION,
        resourceId: 'ref_123',
      };

      classifyMessage.mockResolvedValue({
        intent: MessageClassificationIntent.OUT_OF_PAGE_SCOPE,
        confidence: 0.5,
        needsMerchantData: false,
      });

      const result = await service.handleMessageClassification(mockHistory, mockPageContext);

      expect(classifyMessage).toHaveBeenCalledWith(mockHistory, mockPageContext);
      expect(result).toBeNull();
    });
  });

  describe('handleStreamingChat', () => {
    it('should throw NotFoundError when conversation exists but belongs to another user', async () => {
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
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('validateChatMode', () => {
    it('should throw ValidationError when trying to use PAGE mode on a global conversation', () => {
      const globalConversation = { ...mockConversation, pageContext: undefined };

      expect(() => {
        service.validateChatMode(globalConversation, ChatMode.PAGE);
      }).toThrow('Cannot change an existing conversation to a page-scoped context');
    });

    it('should throw ValidationError when page-scoped conversation is used without PAGE mode', () => {
      const pageConversation = {
        ...mockConversation,
        pageContext: { type: PageContextType.TRANSACTION, resourceId: 'ref_123' },
      };

      expect(() => {
        service.validateChatMode(pageConversation, ChatMode.GLOBAL);
      }).toThrow('Conversation is page-scoped and must use mode "page"');
    });

    it('should throw ValidationError when page-scoped mode is used but pageContext is missing', () => {
      const pageConversation = {
        ...mockConversation,
        pageContext: { type: PageContextType.TRANSACTION, resourceId: 'ref_123' },
      };

      expect(() => {
        service.validateChatMode(pageConversation, ChatMode.PAGE);
      }).toThrow('pageContext is required when mode is "page"');
    });

    it('should throw ValidationError when pageContext type differs from saved context', () => {
      const pageConversation = {
        ...mockConversation,
        pageContext: { type: PageContextType.TRANSACTION, resourceId: 'ref_123' },
      };

      expect(() => {
        service.validateChatMode(pageConversation, ChatMode.PAGE, {
          type: PageContextType.CUSTOMER,
          resourceId: 'CUS_123',
        });
      }).toThrow('Conversation is locked to a different page context');
    });

    it('should throw ValidationError when pageContext resourceId differs from saved context', () => {
      const pageConversation = {
        ...mockConversation,
        pageContext: { type: PageContextType.TRANSACTION, resourceId: 'ref_123' },
      };

      expect(() => {
        service.validateChatMode(pageConversation, ChatMode.PAGE, {
          type: PageContextType.TRANSACTION,
          resourceId: 'ref_456',
        });
      }).toThrow('Conversation is locked to a different page context');
    });

    it('should not throw when page context matches', () => {
      const pageConversation = {
        ...mockConversation,
        pageContext: { type: PageContextType.TRANSACTION, resourceId: 'ref_123' },
      };

      expect(() => {
        service.validateChatMode(pageConversation, ChatMode.PAGE, {
          type: PageContextType.TRANSACTION,
          resourceId: 'ref_123',
        });
      }).not.toThrow();
    });

    it('should not throw when global conversation is used in global mode', () => {
      const globalConversation = { ...mockConversation, pageContext: undefined };

      expect(() => {
        service.validateChatMode(globalConversation, ChatMode.GLOBAL);
      }).not.toThrow();
    });
  });

  describe('handleClosedConversation', () => {
    it('should return a conversation closed response with appropriate stream', () => {
      const result = service.handleClosedConversation();

      expect(result).toBeDefined();
      expect(result.type).toBe(ChatResponseType.CONVERSATION_CLOSED);
      expect(result.responseStream).toBeDefined();
    });

    it('should include a message about starting a new conversation', async () => {
      const result = service.handleClosedConversation();

      const streamMessages: InferUIMessageChunk<ClassificationUIMessage>[] = [];
      for await (const message of result.responseStream) {
        streamMessages.push(message);
      }

      expect(streamMessages.length).toBeGreaterThan(0);
      const dataRefusalMessage = streamMessages.find((message) => message.type === 'data-refusal');
      expect(dataRefusalMessage).toBeDefined();
      expect(dataRefusalMessage?.data?.text).toContain('This conversation has reached its limit');
      expect(dataRefusalMessage?.data?.text).toContain('start a new conversation');
    });
  });

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

  describe('getSystemPromptAndTools', () => {
    const mockPageContextService = jest.fn();
    const mockGetAuthenticatedUser = () => ({
      userId: 'user_123',
      jwtToken: 'mock-jwt-token',
    });

    beforeEach(() => {
      mockPageContextService.mockClear();
    });

    it('should return global system prompt and tools when mode is GLOBAL', async () => {
      const result = await service.getSystemPromptAndTools(ChatMode.GLOBAL, mockGetAuthenticatedUser);

      expect(result.systemPrompt).toBeDefined();
      expect(result.tools).toBeDefined();
      expect(typeof result.tools).toBe('object');
    });

    it('should throw ValidationError when mode is PAGE but pageContext is missing', async () => {
      await expect(service.getSystemPromptAndTools(ChatMode.PAGE, mockGetAuthenticatedUser, undefined)).rejects.toThrow(
        'pageContext is required when mode is "page"',
      );
    });

    it('should return page-scoped system prompt and tools when mode is PAGE with valid context', async () => {
      const pageContext = { type: PageContextType.TRANSACTION, resourceId: 'ref_123' };
      const enrichedContext = {
        type: PageContextType.TRANSACTION,
        resourceId: 'ref_123',
        resourceData: { id: 123, reference: 'ref_123' },
        formattedData: 'Transaction Details:\n- Reference: ref_123',
      };

      const pageContextService = service['pageContextService'];
      jest.spyOn(pageContextService, 'enrichContext').mockResolvedValue(enrichedContext);

      const result = await service.getSystemPromptAndTools(ChatMode.PAGE, mockGetAuthenticatedUser, pageContext);

      expect(pageContextService.enrichContext).toHaveBeenCalledWith(pageContext, 'mock-jwt-token');
      expect(result.systemPrompt).toBeDefined();
      expect(result.systemPrompt).toContain('Transaction');
      expect(result.systemPrompt).toContain('ref_123');
      expect(result.tools).toBeDefined();
      expect(typeof result.tools).toBe('object');
    });

    it('should include current date in both global and page-scoped prompts', async () => {
      const currentDate = new Date().toISOString().split('T')[0];

      // Test global mode
      const globalResult = await service.getSystemPromptAndTools(ChatMode.GLOBAL, mockGetAuthenticatedUser);
      expect(globalResult.systemPrompt).toContain(currentDate);

      // Test page-scoped mode
      const pageContext = { type: PageContextType.TRANSACTION, resourceId: 'ref_123' };
      const enrichedContext = {
        type: PageContextType.TRANSACTION,
        resourceId: 'ref_123',
        resourceData: {},
        formattedData: 'Transaction Details',
      };

      const pageContextService = service['pageContextService'];
      jest.spyOn(pageContextService, 'enrichContext').mockResolvedValue(enrichedContext);

      const pageResult = await service.getSystemPromptAndTools(ChatMode.PAGE, mockGetAuthenticatedUser, pageContext);
      expect(pageResult.systemPrompt).toContain(currentDate);
    });
  });

  describe('buildMessagesForLLM', () => {
    const currentUserMessage = {
      id: 'current-msg',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'What is my current balance?' }],
    };

    it('should include only the current message when no conversation history exists', async () => {
      const conversation = { ...mockConversation, pageContext: undefined };
      jest.spyOn(messageRepository, 'findByConversationId').mockResolvedValue([]);
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(conversation);

      const result = await service['buildMessagesForLLM'](
        conversation,
        conversation.id,
        conversation.userId,
        currentUserMessage,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(currentUserMessage);
    });

    it('should prepend summary message when conversation has a summary', async () => {
      const conversation = {
        ...mockConversation,
        pageContext: undefined,
        summary: 'Previously discussed transaction fees.',
      };

      jest.spyOn(messageRepository, 'findByConversationId').mockResolvedValue([]);
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(conversation);

      const result = await service['buildMessagesForLLM'](
        conversation,
        conversation.id,
        conversation.userId,
        currentUserMessage,
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('summary-context');
      expect(result[0].role).toBe('assistant');
      const summaryPart = result[0].parts[0] as { type: 'text'; text: string };
      expect(summaryPart.text).toContain('Earlier in this conversation');
      expect(summaryPart.text).toContain('Previously discussed transaction fees.');
      expect(result[1]).toEqual(currentUserMessage);
    });

    it('should include both previousSummary and summary when both exist', async () => {
      const conversation = {
        ...mockConversation,
        pageContext: undefined,
        previousSummary: 'Carried over from closed conversation.',
        summary: 'Current conversation summary.',
      };

      jest.spyOn(messageRepository, 'findByConversationId').mockResolvedValue([]);
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(conversation);

      const result = await service['buildMessagesForLLM'](
        conversation,
        conversation.id,
        conversation.userId,
        currentUserMessage,
      );

      expect(result).toHaveLength(2);
      const summaryPart = result[0].parts[0] as { type: 'text'; text: string };
      expect(summaryPart.text).toContain('Carried over from previous conversation');
      expect(summaryPart.text).toContain('Carried over from closed conversation.');
      expect(summaryPart.text).toContain('Earlier in this conversation');
      expect(summaryPart.text).toContain('Current conversation summary.');
    });

    it('should fetch messages after lastSummarizedMessageId when it exists', async () => {
      const conversation = {
        ...mockConversation,
        pageContext: undefined,
        summary: 'Conversation summary.',
        lastSummarizedMessageId: 'msg-10',
      };

      const recentMessages = [
        {
          ...mockMessage,
          id: 'msg-11',
          role: MessageRole.USER,
          parts: [{ type: 'text' as const, text: 'Recent message' }],
        },
      ];

      jest.spyOn(messageRepository, 'findMessagesAfterMessageId').mockResolvedValue(recentMessages);

      const result = await service['buildMessagesForLLM'](
        conversation,
        conversation.id,
        conversation.userId,
        currentUserMessage,
      );

      expect(messageRepository.findMessagesAfterMessageId).toHaveBeenCalledWith(conversation.id, 'msg-10');
      expect(result).toHaveLength(3); // summary + recent message + current message
      expect(result[0].id).toBe('summary-context');
      expect(result[1].id).toBe('msg-11');
      expect(result[2]).toEqual(currentUserMessage);
    });

    it('should limit messages to MESSAGE_HISTORY_LIMIT when no summary exists', async () => {
      const conversation = { ...mockConversation, pageContext: undefined };

      const manyMessages = Array.from({ length: 50 }, (_, i) => ({
        ...mockMessage,
        id: `msg-${i}`,
        role: i % 2 === 0 ? MessageRole.USER : MessageRole.ASSISTANT,
        parts: [{ type: 'text' as const, text: `Message ${i}` }],
      }));

      jest.spyOn(messageRepository, 'findByConversationId').mockResolvedValue(manyMessages);
      jest.spyOn(conversationRepository, 'findByIdAndUserId').mockResolvedValue(conversation);

      configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'MESSAGE_HISTORY_LIMIT') return 40;
        return defaultValue;
      });

      const result = await service['buildMessagesForLLM'](
        conversation,
        conversation.id,
        conversation.userId,
        currentUserMessage,
      );

      // Should have last 40 messages + current message = 41 total
      expect(result).toHaveLength(41);
      expect(result[0].id).toBe('msg-10'); // Last 40 messages start from msg-10
      expect(result[40]).toEqual(currentUserMessage);
    });

    it('should combine summary, recent messages, and current message correctly', async () => {
      const conversation = {
        ...mockConversation,
        pageContext: undefined,
        summary: 'Summary of older messages.',
        lastSummarizedMessageId: 'msg-5',
      };

      const recentMessages = [
        {
          ...mockMessage,
          id: 'msg-6',
          role: MessageRole.USER,
          parts: [{ type: 'text' as const, text: 'Recent question' }],
        },
        {
          ...mockMessage,
          id: 'msg-7',
          role: MessageRole.ASSISTANT,
          parts: [{ type: 'text' as const, text: 'Recent answer' }],
        },
      ];

      jest.spyOn(messageRepository, 'findMessagesAfterMessageId').mockResolvedValue(recentMessages);

      const result = await service['buildMessagesForLLM'](
        conversation,
        conversation.id,
        conversation.userId,
        currentUserMessage,
      );

      expect(result).toHaveLength(4);
      expect(result[0].id).toBe('summary-context');
      const summaryPart = result[0].parts[0] as { type: 'text'; text: string };
      expect(summaryPart.text).toContain('Summary of older messages.');
      expect(result[1].id).toBe('msg-6');
      expect(result[2].id).toBe('msg-7');
      expect(result[3]).toEqual(currentUserMessage);
    });
  });
});
