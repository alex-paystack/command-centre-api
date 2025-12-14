import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { convertToModelMessages, createUIMessageStream, stepCountIs, streamText, UIMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { ChatRequestDto } from './dto/chat-request.dto';
import { MessageRole } from './entities/message.entity';
import {
  generateConversationTitle,
  convertToUIMessages,
  createTools,
  CHAT_AGENT_SYSTEM_PROMPT,
  classifyMessage,
  MessageClassificationIntent,
  policy,
  ChatResponseType,
  ClassificationUIMessage,
} from '../../common/ai';
import { PaystackApiService } from '../../common/services/paystack-api.service';
import { RateLimitExceededException } from './exceptions/rate-limit-exceeded.exception';

@Injectable()
export class ChatService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly configService: ConfigService,
    private readonly paystackApiService: PaystackApiService,
  ) {}

  async getMessagesByConversationId(conversationId: string, userId: string) {
    const conversation = await this.conversationRepository.findByIdAndUserId(conversationId, userId);
    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${conversationId} not found`);
    }

    const messages = await this.messageRepository.findByConversationId(conversationId);
    return MessageResponseDto.fromEntities(messages);
  }

  async saveMessages(dtos: CreateMessageDto[], userId: string) {
    if (dtos.length === 0) {
      return [];
    }

    const conversationId = dtos[0].conversationId;
    const allSameConversation = dtos.every((dto) => dto.conversationId === conversationId);

    if (!allSameConversation) {
      throw new Error('All messages must belong to the same conversation');
    }

    const conversation = await this.conversationRepository.findByIdAndUserId(conversationId, userId);
    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${conversationId} not found`);
    }

    await this.checkUserEntitlement(userId);

    const messagesToCreate = dtos.map((dto) => ({
      conversationId: dto.conversationId,
      role: dto.role,
      parts: dto.parts,
    }));

    const savedMessages = await this.messageRepository.createMessages(messagesToCreate);

    return MessageResponseDto.fromEntities(savedMessages);
  }

  async getConversationById(id: string, userId: string) {
    const conversation = await this.conversationRepository.findByIdAndUserId(id, userId);

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

  async deleteConversationById(id: string, userId: string) {
    const conversation = await this.conversationRepository.findByIdAndUserId(id, userId);
    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found`);
    }

    await this.messageRepository.deleteAllByConversationId(id);

    const deleted = await this.conversationRepository.deleteByIdForUser(id, userId);
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

  async handleMessageClassification(messages: UIMessage[]) {
    const messageClassification = await classifyMessage(messages);

    if (messageClassification?.intent === MessageClassificationIntent.OUT_OF_SCOPE) {
      const refusalText = policy.refusalText;

      const refusalStream = createUIMessageStream<ClassificationUIMessage>({
        execute: ({ writer }) => {
          writer.write({
            type: 'data-refusal',
            data: {
              text: refusalText,
            },
          });
        },
      });

      return {
        type: ChatResponseType.REFUSAL,
        responseStream: refusalStream,
        text: refusalText,
      };
    }

    return null;
  }

  async handleStreamingChat(dto: ChatRequestDto, userId: string, jwtToken: string) {
    const { conversationId, message } = dto;

    await this.checkUserEntitlement(userId);

    let conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      try {
        const title = await generateConversationTitle(message);

        conversation = await this.conversationRepository.createConversation({
          id: conversationId,
          title,
          userId,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error creating conversation:', error);
        throw new Error('Failed to create conversation');
      }
    } else if (conversation.userId !== userId) {
      throw new NotFoundException(`Conversation with ID ${conversationId} not found`);
    }

    const allMessages = await this.getMessagesByConversationId(conversationId, userId);
    const historyLimit = this.configService.get<number>('MESSAGE_HISTORY_LIMIT', 40);
    const limitedHistory = allMessages.slice(-historyLimit);
    const uiMessages = [...convertToUIMessages(limitedHistory), message];

    const messageClassification = await this.handleMessageClassification(uiMessages);

    await this.messageRepository.createMessage({
      conversationId,
      role: MessageRole.USER,
      parts: message.parts,
    });

    if (messageClassification) {
      await this.messageRepository.createMessage({
        conversationId,
        role: MessageRole.ASSISTANT,
        parts: [
          {
            type: 'text',
            text: messageClassification.text,
          },
        ],
      });

      return {
        type: messageClassification.type,
        responseStream: messageClassification.responseStream,
      };
    }

    const getJwtToken = () => jwtToken;

    const tools = createTools(this.paystackApiService, getJwtToken);

    // Inject current date into system prompt
    const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const systemPrompt = CHAT_AGENT_SYSTEM_PROMPT.replace(/\{\{CURRENT_DATE\}\}/g, currentDate);

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const result = streamText({
          model: openai('gpt-4o-mini'),
          system: systemPrompt,
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(10),
          tools,
        });

        writer.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      onFinish: async ({ messages }) => {
        const formattedMessages = messages.map((message) => ({
          conversationId: dto.conversationId,
          role: message.role as MessageRole,
          parts: message.parts,
        }));

        await this.saveMessages(formattedMessages, userId);
      },
    });

    return { type: ChatResponseType.CHAT_RESPONSE, responseStream: stream };
  }
}
