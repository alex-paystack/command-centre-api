import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { convertToModelMessages, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { ChatRequestDto } from './dto/chat-request.dto';
import { MessageRole } from './entities/message.entity';
import { generateConversationTitle, convertToUIMessages, tools } from '../../common/ai';
import { RateLimitExceededException } from './exceptions/rate-limit-exceeded.exception';

@Injectable()
export class ChatService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly configService: ConfigService,
  ) {}

  async getMessagesByConversationId(conversationId: string) {
    const messages = await this.messageRepository.findByConversationId(conversationId);
    return MessageResponseDto.fromEntities(messages);
  }

  async saveMessages(dtos: CreateMessageDto[]) {
    if (dtos.length === 0) {
      return [];
    }

    const conversationId = dtos[0].conversationId;
    const allSameConversation = dtos.every((dto) => dto.conversationId === conversationId);

    if (!allSameConversation) {
      throw new Error('All messages must belong to the same conversation');
    }

    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${conversationId} not found`);
    }

    const messagesToCreate = dtos.map((dto) => ({
      conversationId: dto.conversationId,
      role: dto.role,
      parts: dto.parts,
    }));

    const savedMessages = await this.messageRepository.createMessages(messagesToCreate);

    return MessageResponseDto.fromEntities(savedMessages);
  }

  async getConversationById(id: string) {
    const conversation = await this.conversationRepository.findById(id);

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    return ConversationResponseDto.fromEntity(conversation);
  }

  async getConversationsByUserId(userId: string) {
    const conversations = await this.conversationRepository.findByUserId(userId);

    return ConversationResponseDto.fromEntities(conversations);
  }

  async saveConversation(dto: CreateConversationDto) {
    const conversation = await this.conversationRepository.createConversation({
      id: dto.id,
      title: dto.title,
      userId: dto.userId,
    });

    return ConversationResponseDto.fromEntity(conversation);
  }

  async deleteConversationById(id: string) {
    await this.messageRepository.deleteAllByConversationId(id);

    const deleted = await this.conversationRepository.deleteById(id);
    if (!deleted) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }
  }

  async deleteAllConversationsByUserId(userId: string) {
    const conversations = await this.conversationRepository.findByUserId(userId);

    for (const conversation of conversations) {
      await this.messageRepository.deleteAllByConversationId(conversation.id);
    }

    return this.conversationRepository.deleteAllByUserId(userId);
  }

  async checkUserEntitlement(userId: string) {
    const messageLimit = this.configService.get<number>('MESSAGE_LIMIT', 100);
    const rateLimitPeriodHours = this.configService.get<number>('RATE_LIMIT_PERIOD_HOURS', 24);

    const messageCount = await this.messageRepository.countUserMessagesInPeriod(userId, rateLimitPeriodHours);

    if (messageCount >= messageLimit) {
      throw new RateLimitExceededException(messageLimit, rateLimitPeriodHours, messageCount);
    }
  }

  async handleStreamingChat(dto: ChatRequestDto) {
    const { conversationId, message } = dto;

    await this.checkUserEntitlement('test-user-id');

    let conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      try {
        const title = await generateConversationTitle(message);

        conversation = await this.conversationRepository.createConversation({
          id: conversationId,
          title,
          userId: 'test-user-id',
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error creating conversation:', error);
        throw new Error('Failed to create conversation');
      }
    }

    const allMessages = await this.getMessagesByConversationId(conversationId);
    const uiMessages = [...convertToUIMessages(allMessages), message];

    await this.messageRepository.createMessage({
      conversationId,
      role: MessageRole.USER,
      parts: message.parts,
    });

    const result = streamText({
      model: openai('gpt-4o-mini'),
      messages: convertToModelMessages(uiMessages),
      tools,
    });

    return result;
  }
}
