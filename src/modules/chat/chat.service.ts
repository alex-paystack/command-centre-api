import { Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class ChatService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
  ) {}

  async getMessagesByChatId(chatId: string): Promise<MessageResponseDto[]> {
    const messages = await this.messageRepository.findByChatId(chatId);
    return MessageResponseDto.fromEntities(messages);
  }

  async saveMessage(dto: CreateMessageDto): Promise<MessageResponseDto> {
    const conversation = await this.conversationRepository.findById(dto.chatId);

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${dto.chatId} not found`);
    }

    const message = await this.messageRepository.createMessage({
      chatId: dto.chatId,
      role: dto.role,
      parts: dto.parts,
    });

    return MessageResponseDto.fromEntity(message);
  }

  async getConversationById(id: string): Promise<ConversationResponseDto> {
    const conversation = await this.conversationRepository.findById(id);

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    return ConversationResponseDto.fromEntity(conversation);
  }

  async getConversationsByUserId(userId: string): Promise<ConversationResponseDto[]> {
    const conversations = await this.conversationRepository.findByUserId(userId);

    return ConversationResponseDto.fromEntities(conversations);
  }

  async saveConversation(dto: CreateConversationDto): Promise<ConversationResponseDto> {
    const conversation = await this.conversationRepository.createConversation({
      id: dto.id,
      title: dto.title,
      userId: dto.userId,
    });

    return ConversationResponseDto.fromEntity(conversation);
  }

  async deleteConversationById(id: string): Promise<void> {
    await this.messageRepository.deleteAllByChatId(id);

    const deleted = await this.conversationRepository.deleteById(id);
    if (!deleted) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }
  }

  async deleteAllConversationsByUserId(userId: string): Promise<number> {
    const conversations = await this.conversationRepository.findByUserId(userId);

    for (const conversation of conversations) {
      await this.messageRepository.deleteAllByChatId(conversation.id);
    }

    return this.conversationRepository.deleteAllByUserId(userId);
  }

  async handleStreamingChat(dto: ChatRequestDto) {
    const { conversationId, message } = dto;

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

    const allMessages = await this.getMessagesByChatId(conversationId);
    const uiMessages = [...convertToUIMessages(allMessages), message];

    await this.messageRepository.createMessage({
      chatId: conversationId,
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
