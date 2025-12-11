import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';

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
    // Verify that the conversation exists
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
    // First, delete all messages associated with this conversation
    await this.messageRepository.deleteAllByChatId(id);

    // Then delete the conversation
    const deleted = await this.conversationRepository.deleteById(id);
    if (!deleted) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }
  }

  async deleteAllConversationsByUserId(userId: string): Promise<number> {
    // Get all conversations for the user
    const conversations = await this.conversationRepository.findByUserId(userId);

    // Delete all messages for each conversation
    for (const conversation of conversations) {
      await this.messageRepository.deleteAllByChatId(conversation.id);
    }

    // Delete all conversations for the user
    return this.conversationRepository.deleteAllByUserId(userId);
  }
}
