import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { convertToModelMessages, createUIMessageStream, stepCountIs, streamText, UIMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { randomUUID } from 'crypto';
import { ConversationRepository } from './repositories/conversation.repository';
import { MessageRepository } from './repositories/message.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateConversationFromSummaryDto } from './dto/create-conversation-from-summary.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatMode, PageContext, PageContextType } from '~/common/ai/types';
import { MessageRole } from './entities/message.entity';
import {
  generateConversationTitle,
  summarizeConversation,
  convertToUIMessages,
  createTools,
  createPageScopedTools,
  CHAT_AGENT_SYSTEM_PROMPT,
  PAGE_SCOPED_SYSTEM_PROMPT,
  classifyMessage,
  MessageClassificationIntent,
  policy,
  ChatResponseType,
  ClassificationUIMessage,
  EnrichedPageContext,
} from '~/common/ai';
import { PaystackApiService } from '~/common/services/paystack-api.service';
import { PageContextService } from '~/common/services/page-context.service';
import { RateLimitExceededException } from './exceptions/rate-limit-exceeded.exception';
import { Conversation } from './entities/conversation.entity';

@Injectable()
export class ChatService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly configService: ConfigService,
    private readonly paystackApiService: PaystackApiService,
    private readonly pageContextService: PageContextService,
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

  async getConversationsByUserId(userId: string, contextType?: PageContextType, mode?: ChatMode) {
    const resolvedMode = mode && Object.values(ChatMode).includes(mode) ? mode : undefined;
    const resolvedContext =
      contextType && Object.values(PageContextType).includes(contextType) ? contextType : undefined;

    let conversations: Conversation[];

    if (resolvedMode && resolvedContext) {
      conversations = await this.conversationRepository.findByUserIdAndModeAndContextType(
        userId,
        resolvedMode,
        resolvedContext,
      );
    } else if (resolvedMode) {
      conversations = await this.conversationRepository.findByUserIdAndMode(userId, resolvedMode);
    } else if (resolvedContext) {
      conversations = await this.conversationRepository.findByUserIdAndContextType(userId, resolvedContext);
    } else {
      conversations = await this.conversationRepository.findByUserId(userId);
    }

    return ConversationResponseDto.fromEntities(conversations);
  }

  async saveConversation(dto: CreateConversationDto) {
    const conversation = await this.conversationRepository.createConversation(dto);

    return ConversationResponseDto.fromEntity(conversation);
  }

  async createConversationFromSummary(dto: CreateConversationFromSummaryDto, userId: string) {
    const previousConversation = await this.conversationRepository.findByIdAndUserId(
      dto.previousConversationId,
      userId,
    );

    if (!previousConversation) {
      throw new NotFoundException(`Conversation with ID ${dto.previousConversationId} not found`);
    }

    if (!previousConversation.isClosed) {
      throw new BadRequestException('Can only continue from a closed conversation');
    }

    // Combine all summaries from the previous conversation
    const combinedSummary = [previousConversation.previousSummary, previousConversation.summary]
      .filter(Boolean)
      .join('\n\n---\n\n');

    // Create new conversation with carried-over summary
    const newConversation = await this.conversationRepository.createConversation({
      id: randomUUID(),
      title: `${previousConversation.title} (continued)`,
      userId,
      mode: dto.mode,
      pageContext: dto.pageContext,
      previousSummary: combinedSummary,
    });

    return ConversationResponseDto.fromEntity(newConversation);
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

  async handleMessageClassification(messages: UIMessage[], pageContext?: PageContext) {
    const messageClassification = await classifyMessage(messages, pageContext);
    const confidence = messageClassification?.confidence ?? 1;
    const LOW_CONFIDENCE_THRESHOLD = 0.6;

    const isLowConfidenceOutScope =
      [MessageClassificationIntent.OUT_OF_SCOPE, MessageClassificationIntent.OUT_OF_PAGE_SCOPE].includes(
        messageClassification?.intent,
      ) && confidence < LOW_CONFIDENCE_THRESHOLD;

    if (isLowConfidenceOutScope) {
      return null;
    }

    if (messageClassification?.intent === MessageClassificationIntent.OUT_OF_SCOPE) {
      const refusalText = policy.outOfScopeRefusalText;

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

    if (messageClassification?.intent === MessageClassificationIntent.OUT_OF_PAGE_SCOPE) {
      const refusalText = policy.outOfPageScopeRefusalText.replace(/\{\{RESOURCE_TYPE\}\}/g, pageContext?.type || '');

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

  // TODO: Consider decoding the JWT here to get the userId
  async handleStreamingChat(dto: ChatRequestDto, userId: string, jwtToken: string) {
    const { conversationId, message, mode, pageContext } = dto;

    await this.checkUserEntitlement(userId);

    let conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      try {
        const title = await generateConversationTitle(message);

        conversation = await this.conversationRepository.createConversation({
          id: conversationId,
          title,
          userId,
          mode,
          pageContext,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error creating conversation:', error);
        throw new Error('Failed to create conversation');
      }
    } else if (conversation.userId !== userId) {
      throw new NotFoundException(`Conversation with ID ${conversationId} not found`);
    }

    if (conversation.isClosed) {
      const closedConversationMessage =
        'This conversation has reached its limit and has been closed. Please start a new conversation or continue from this one to carry over the context.';

      const closedStream = createUIMessageStream<ClassificationUIMessage>({
        execute: ({ writer }) => {
          writer.write({
            type: 'data-refusal',
            data: {
              text: closedConversationMessage,
            },
          });
        },
      });

      return {
        type: ChatResponseType.CONVERSATION_CLOSED,
        responseStream: closedStream,
      };
    }

    if (conversation.pageContext) {
      if (mode !== ChatMode.PAGE) {
        throw new BadRequestException('Conversation is page-scoped and must use mode "page"');
      }

      if (!pageContext) {
        throw new BadRequestException('pageContext is required when mode is "page"');
      }

      if (
        pageContext.type !== conversation.pageContext.type ||
        pageContext.resourceId !== conversation.pageContext.resourceId
      ) {
        throw new BadRequestException('Conversation is locked to a different page context');
      }
    } else if (mode === ChatMode.PAGE) {
      // Do not allow turning an existing global conversation into page-scoped
      throw new BadRequestException('Cannot change an existing conversation to a page-scoped context');
    }

    // Build messages with summary support
    const uiMessages = await this.buildMessagesForLLM(conversation, conversationId, userId, message);

    const messageClassification = await this.handleMessageClassification(uiMessages, pageContext);

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

    const getAuthenticatedUser = () => ({
      userId,
      jwtToken,
    });

    const chatMode = dto.mode || ChatMode.GLOBAL;
    let systemPrompt: string;
    let tools: ReturnType<typeof createTools>;

    if (chatMode === ChatMode.PAGE) {
      if (!dto.pageContext) {
        throw new BadRequestException('pageContext is required when mode is "page"');
      }

      const enrichedContext = await this.pageContextService.enrichContext(dto.pageContext, jwtToken);
      systemPrompt = this.buildPageScopedPrompt(enrichedContext);
      tools = createPageScopedTools(this.paystackApiService, getAuthenticatedUser, dto.pageContext.type);
    } else {
      const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
      systemPrompt = CHAT_AGENT_SYSTEM_PROMPT.replace(/\{\{CURRENT_DATE\}\}/g, currentDate);
      tools = createTools(this.paystackApiService, getAuthenticatedUser);
    }

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

        const savedMessages = await this.saveMessages(formattedMessages, userId);

        // Check if summarization is needed
        const summarizationThreshold = this.configService.get<number>('SUMMARIZATION_THRESHOLD', 20);
        const maxSummaries = this.configService.get<number>('MAX_SUMMARIES', 2);

        let messageCount: number;

        if (conversation.lastSummarizedMessageId) {
          messageCount = await this.messageRepository.countUserMessagesAfterMessageId(
            conversationId,
            conversation.lastSummarizedMessageId,
          );
        } else {
          messageCount = await this.messageRepository.countUserMessagesByConversationId(conversationId);
        }

        const currentSummaryCount = conversation.summaryCount;

        if (messageCount >= summarizationThreshold && currentSummaryCount < maxSummaries) {
          try {
            // Only summarize messages that haven't been summarized yet to avoid reprocessing full history
            const messagesNeedingSummary = conversation.lastSummarizedMessageId
              ? MessageResponseDto.fromEntities(
                  await this.messageRepository.findMessagesAfterMessageId(
                    conversationId,
                    conversation.lastSummarizedMessageId,
                  ),
                )
              : await this.getMessagesByConversationId(conversationId, userId);

            if (messagesNeedingSummary.length > 0) {
              const newSummary = await summarizeConversation(
                convertToUIMessages(messagesNeedingSummary),
                conversation.summary,
              );

              if (newSummary) {
                // Track the newest user message as the watermark for next summarization
                const lastUserMessageId = [...messagesNeedingSummary]
                  .reverse()
                  .find((msg) => msg.role === MessageRole.USER)?.id;

                const lastMessageId =
                  lastUserMessageId || (savedMessages.length > 0 ? savedMessages[savedMessages.length - 1].id : null);

                const newSummaryCount = currentSummaryCount + 1;
                const updates: Partial<Conversation> = {
                  summary: newSummary,
                  summaryCount: newSummaryCount,
                  lastSummarizedMessageId: lastMessageId || conversation.lastSummarizedMessageId,
                  isClosed: newSummaryCount >= maxSummaries,
                };

                await this.conversationRepository.save({
                  ...conversation,
                  ...updates,
                });
              }
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error generating conversation summary:', error);
            // Don't fail the entire request if summarization fails
          }
        }
      },
    });

    return { type: ChatResponseType.CHAT_RESPONSE, responseStream: stream };
  }

  private buildPageScopedPrompt(enrichedContext: EnrichedPageContext) {
    const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const resourceType = enrichedContext.type.charAt(0).toUpperCase() + enrichedContext.type.slice(1);

    return PAGE_SCOPED_SYSTEM_PROMPT.replace(/\{\{CURRENT_DATE\}\}/g, currentDate)
      .replace(/\{\{RESOURCE_TYPE\}\}/g, resourceType)
      .replace(/\{\{RESOURCE_DATA\}\}/g, enrichedContext.formattedData);
  }

  private async buildMessagesForLLM(
    conversation: Conversation,
    conversationId: string,
    userId: string,
    currentUserMessage: UIMessage,
  ): Promise<UIMessage[]> {
    const messages: UIMessage[] = [];

    // If summary exists, inject it as first assistant message
    if (conversation.previousSummary || conversation.summary) {
      const summaryParts: string[] = [];

      if (conversation.previousSummary) {
        summaryParts.push(`**Carried over from previous conversation:**\n${conversation.previousSummary}`);
      }

      if (conversation.summary) {
        summaryParts.push(`**Earlier in this conversation:**\n${conversation.summary}`);
      }

      messages.push({
        id: 'summary-context',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: `[Conversation Summary]\n\nHere's what we've discussed so far:\n\n${summaryParts.join('\n\n')}`,
          },
        ],
      });
    }

    // Get recent messages (after lastSummarizedMessageId if summary exists)
    let recentMessages: MessageResponseDto[];

    if (conversation.lastSummarizedMessageId) {
      const messagesAfterSummary = await this.messageRepository.findMessagesAfterMessageId(
        conversationId,
        conversation.lastSummarizedMessageId,
      );
      recentMessages = MessageResponseDto.fromEntities(messagesAfterSummary);
    } else {
      // No summary yet, get all messages with history limit
      const allMessages = await this.getMessagesByConversationId(conversationId, userId);
      const historyLimit = this.configService.get<number>('MESSAGE_HISTORY_LIMIT', 40);
      recentMessages = allMessages.slice(-historyLimit);
    }

    messages.push(...convertToUIMessages(recentMessages), currentUserMessage);

    return messages;
  }
}
