/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { MessageRole } from './entities/message.entity';

describe('ChatController', () => {
  let controller: ChatController;
  let service: jest.Mocked<ChatService>;

  const mockConversationResponse: ConversationResponseDto = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Conversation',
    userId: 'user_123',
    createdAt: new Date('2024-01-01'),
  };

  const mockMessageResponse: MessageResponseDto = {
    id: '987fcdeb-51a2-43e7-b890-123456789abc',
    conversationId: '123e4567-e89b-12d3-a456-426614174000',
    role: MessageRole.USER,
    parts: [{ type: 'text', text: 'Hello' }],
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const mockChatService = {
      saveConversation: jest.fn(),
      getConversationById: jest.fn(),
      getConversationsByUserId: jest.fn(),
      deleteConversationById: jest.fn(),
      deleteAllConversationsByUserId: jest.fn(),
      saveMessages: jest.fn(),
      getMessagesByConversationId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: mockChatService,
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    service = module.get(ChatService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createConversation', () => {
    it('should create a conversation', async () => {
      const dto: CreateConversationDto = {
        id: mockConversationResponse.id,
        title: mockConversationResponse.title,
        userId: mockConversationResponse.userId,
      };

      jest.spyOn(service, 'saveConversation').mockResolvedValue(mockConversationResponse);

      const result = await controller.createConversation(dto);

      expect(service.saveConversation).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        status: true,
        message: 'Conversation created successfully',
        data: mockConversationResponse,
      });
    });
  });

  describe('getConversation', () => {
    it('should get a conversation by id', async () => {
      jest.spyOn(service, 'getConversationById').mockResolvedValue(mockConversationResponse);

      const result = await controller.getConversation(mockConversationResponse.id);

      expect(service.getConversationById).toHaveBeenCalledWith(mockConversationResponse.id);
      expect(result).toEqual({
        status: true,
        message: 'Conversation retrieved successfully',
        data: mockConversationResponse,
      });
    });
  });

  describe('getConversationsByUserId', () => {
    it('should get conversations by user id', async () => {
      jest.spyOn(service, 'getConversationsByUserId').mockResolvedValue([mockConversationResponse]);

      const result = await controller.getConversationsByUserId('user_123');

      expect(service.getConversationsByUserId).toHaveBeenCalledWith('user_123');
      expect(result).toEqual({
        status: true,
        message: 'Conversations retrieved successfully',
        data: [mockConversationResponse],
      });
    });
  });

  describe('deleteConversation', () => {
    it('should delete a conversation', async () => {
      jest.spyOn(service, 'deleteConversationById').mockResolvedValue(undefined);

      const result = await controller.deleteConversation(mockConversationResponse.id);

      expect(service.deleteConversationById).toHaveBeenCalledWith(mockConversationResponse.id);
      expect(result).toEqual({
        status: true,
        message: 'Conversation deleted successfully',
        data: null,
      });
    });
  });

  describe('deleteAllConversationsByUserId', () => {
    it('should delete all conversations for a user', async () => {
      jest.spyOn(service, 'deleteAllConversationsByUserId').mockResolvedValue(3);

      const result = await controller.deleteAllConversationsByUserId('user_123');

      expect(service.deleteAllConversationsByUserId).toHaveBeenCalledWith('user_123');
      expect(result).toEqual({
        status: true,
        message: 'Conversations deleted successfully',
        data: { deleted: 3 },
      });
    });
  });

  describe('createMessages', () => {
    it('should create messages', async () => {
      const dtos: CreateMessageDto[] = [
        {
          conversationId: mockMessageResponse.conversationId,
          role: MessageRole.USER,
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ];

      jest.spyOn(service, 'saveMessages').mockResolvedValue([mockMessageResponse]);

      const result = await controller.createMessages(dtos);

      expect(service.saveMessages).toHaveBeenCalledWith(dtos);
      expect(result).toEqual({
        status: true,
        message: 'Messages created successfully',
        data: [mockMessageResponse],
      });
    });
  });

  describe('getMessagesByConversationId', () => {
    it('should get messages by chat id', async () => {
      jest.spyOn(service, 'getMessagesByConversationId').mockResolvedValue([mockMessageResponse]);

      const result = await controller.getMessagesByConversationId(mockConversationResponse.id);

      expect(service.getMessagesByConversationId).toHaveBeenCalledWith(mockConversationResponse.id);
      expect(result).toEqual({
        status: true,
        message: 'Messages retrieved successfully',
        data: [mockMessageResponse],
      });
    });
  });
});
