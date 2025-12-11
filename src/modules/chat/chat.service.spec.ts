/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { Conversation } from './entities/conversation.entity';
import { Message, MessageRole } from './entities/message.entity';

describe('ChatService', () => {
  let service: ChatService;
  let conversationRepository: jest.Mocked<ConversationRepository>;
  let messageRepository: jest.Mocked<MessageRepository>;

  const mockConversation: Conversation = {
    _id: {} as Conversation['_id'],
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Conversation',
    userId: 'user_123',
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
      findByUserId: jest.fn(),
      createConversation: jest.fn(),
      deleteById: jest.fn(),
      deleteAllByUserId: jest.fn(),
    };

    const mockMessageRepository = {
      findByConversationId: jest.fn(),
      createMessage: jest.fn(),
      createMessages: jest.fn(),
      deleteAllByConversationId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: ConversationRepository,
          useValue: mockConversationRepository,
        },
        {
          provide: MessageRepository,
          useValue: mockMessageRepository,
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
      };

      jest.spyOn(conversationRepository, 'createConversation').mockResolvedValue(mockConversation);

      const result = await service.saveConversation(dto);

      expect(conversationRepository.createConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: dto.id,
          title: dto.title,
          userId: dto.userId,
        }),
      );
      expect(result.id).toBe(mockConversation.id);
      expect(result.title).toBe(mockConversation.title);
      expect(result.userId).toBe(mockConversation.userId);
    });
  });

  describe('getConversationById', () => {
    it('should return a conversation by id', async () => {
      jest.spyOn(conversationRepository, 'findById').mockResolvedValue(mockConversation);

      const result = await service.getConversationById(mockConversation.id);

      expect(conversationRepository.findById).toHaveBeenCalledWith(mockConversation.id);
      expect(result.id).toBe(mockConversation.id);
    });

    it('should throw NotFoundException when conversation not found', async () => {
      jest.spyOn(conversationRepository, 'findById').mockResolvedValue(null);

      await expect(service.getConversationById('non-existent-id')).rejects.toThrow(NotFoundException);
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
  });

  describe('deleteConversationById', () => {
    it('should delete a conversation and its messages', async () => {
      jest.spyOn(messageRepository, 'deleteAllByConversationId').mockResolvedValue(2);
      jest.spyOn(conversationRepository, 'deleteById').mockResolvedValue(true);

      await service.deleteConversationById(mockConversation.id);

      expect(messageRepository.deleteAllByConversationId).toHaveBeenCalledWith(mockConversation.id);
      expect(conversationRepository.deleteById).toHaveBeenCalledWith(mockConversation.id);
    });

    it('should throw NotFoundException when conversation not found', async () => {
      jest.spyOn(messageRepository, 'deleteAllByConversationId').mockResolvedValue(0);
      jest.spyOn(conversationRepository, 'deleteById').mockResolvedValue(false);

      await expect(service.deleteConversationById('non-existent-id')).rejects.toThrow(NotFoundException);
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

      jest.spyOn(conversationRepository, 'findById').mockResolvedValue(mockConversation);
      jest.spyOn(messageRepository, 'createMessages').mockResolvedValue([mockMessage]);

      const result = await service.saveMessages(dtos);

      expect(conversationRepository.findById).toHaveBeenCalledWith(dtos[0].conversationId);
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
      const result = await service.saveMessages([]);

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

      await expect(service.saveMessages(dtos)).rejects.toThrow('All messages must belong to the same conversation');
    });

    it('should throw NotFoundException when conversation not found', async () => {
      const dtos: CreateMessageDto[] = [
        {
          conversationId: 'non-existent-id',
          role: MessageRole.USER,
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ];

      jest.spyOn(conversationRepository, 'findById').mockResolvedValue(null);

      await expect(service.saveMessages(dtos)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMessagesByConversationId', () => {
    it('should return messages for a conversation', async () => {
      jest.spyOn(messageRepository, 'findByConversationId').mockResolvedValue([mockMessage]);

      const result = await service.getMessagesByConversationId(mockConversation.id);

      expect(messageRepository.findByConversationId).toHaveBeenCalledWith(mockConversation.id);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockMessage.id);
    });

    it('should return empty array when conversation has no messages', async () => {
      jest.spyOn(messageRepository, 'findByConversationId').mockResolvedValue([]);

      const result = await service.getMessagesByConversationId(mockConversation.id);

      expect(result).toEqual([]);
    });
  });
});
