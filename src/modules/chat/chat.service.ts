import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  convertToModelMessages,
  createUIMessageStream,
  stepCountIs,
  streamText,
  Tool,
  TypeValidationError,
  UIMessage,
  validateUIMessages,
  LanguageModelUsage,
} from 'ai';
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
import { AuthenticatedUser, ChatMode, PageContext, PageContextType } from '~/common/ai/types';
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
  TelemetryContext,
  LLMOperationType,
  createTelemetryConfig,
  createChatTelemetryContext,
  createMinimalTelemetryContext,
  createConversationTrace,
  getLangfuseClient,
  getTextFromMessage,
} from '~/common/ai';
import { PaystackApiService } from '~/common/services/paystack-api.service';
import { PageContextService } from '~/common/services/page-context.service';
import { RateLimitExceededException } from './exceptions/rate-limit-exceeded.exception';
import { Conversation } from './entities/conversation.entity';
import { NotFoundError, ValidationError, APIError, ErrorCodes } from '~/common';

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
      throw new NotFoundError(`Conversation with ID ${conversationId} not found`, ErrorCodes.CONVERSATION_NOT_FOUND);
    }

    const messages = await this.messageRepository.findByConversationId(conversationId);
    return MessageResponseDto.fromEntities(messages);
  }

  async saveMessages(dtos: CreateMessageDto[], userId: string) {
    if (dtos.length === 0) {
      return [];
    }

    const retentionDays = this.configService.get<number>('CONVERSATION_TTL_DAYS', 3);
    const conversationId = dtos[0].conversationId;
    const allSameConversation = dtos.every((dto) => dto.conversationId === conversationId);

    if (!allSameConversation) {
      throw new ValidationError('All messages must belong to the same conversation', ErrorCodes.INVALID_PARAMS);
    }

    const conversation = await this.conversationRepository.findByIdAndUserId(conversationId, userId);
    if (!conversation) {
      throw new NotFoundError(`Conversation with ID ${conversationId} not found`, ErrorCodes.CONVERSATION_NOT_FOUND);
    }

    if (conversation.isClosed) {
      throw new ValidationError('Conversation is closed', ErrorCodes.CONVERSATION_CLOSED);
    }

    await this.checkUserEntitlement(userId);

    const messagesToCreate = dtos.map((dto) => ({
      conversationId: dto.conversationId,
      role: dto.role,
      parts: dto.parts,
      id: dto.id,
      expiresAt: this.calculateExpiry(retentionDays),
    }));

    const savedMessages = await this.messageRepository.createMessages(messagesToCreate);

    await this.conversationRepository.refreshExpiryWindow(conversationId, retentionDays);

    return MessageResponseDto.fromEntities(savedMessages);
  }

  async getConversationById(id: string, userId: string) {
    const conversation = await this.conversationRepository.findByIdAndUserId(id, userId);

    if (!conversation) {
      throw new NotFoundError(`Conversation with ID ${id} not found`, ErrorCodes.CONVERSATION_NOT_FOUND);
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
    const retentionDays = this.configService.get<number>('CONVERSATION_TTL_DAYS', 3);
    const now = new Date();
    const conversation = await this.conversationRepository.createConversation({
      ...dto,
      lastActivityAt: now,
      expiresAt: this.calculateExpiry(retentionDays, now),
    });

    return ConversationResponseDto.fromEntity(conversation);
  }

  async createConversationFromSummary(dto: CreateConversationFromSummaryDto, userId: string) {
    const previousConversation = await this.conversationRepository.findByIdAndUserId(
      dto.previousConversationId,
      userId,
    );

    if (!previousConversation) {
      throw new NotFoundError(
        `Conversation with ID ${dto.previousConversationId} not found`,
        ErrorCodes.CONVERSATION_NOT_FOUND,
      );
    }

    if (!previousConversation.isClosed) {
      throw new ValidationError('Can only continue from a closed conversation', ErrorCodes.INVALID_PARAMS);
    }

    // Combine all summaries from the previous conversation
    const combinedSummary = [previousConversation.previousSummary, previousConversation.summary]
      .filter(Boolean)
      .join('\n\n---\n\n');

    // Create new conversation with carried-over summary
    const retentionDays = this.configService.get<number>('CONVERSATION_TTL_DAYS', 3);
    const now = new Date();
    const newConversation = await this.conversationRepository.createConversation({
      id: randomUUID(),
      title: `${previousConversation.title} (continued)`,
      userId,
      mode: dto.mode,
      pageContext: dto.pageContext,
      previousSummary: combinedSummary,
      lastActivityAt: now,
      expiresAt: this.calculateExpiry(retentionDays, now),
    });

    return ConversationResponseDto.fromEntity(newConversation);
  }

  async deleteConversationById(id: string, userId: string) {
    const conversation = await this.conversationRepository.findByIdAndUserId(id, userId);
    if (!conversation) {
      throw new NotFoundError(`Conversation with ID ${id} not found`, ErrorCodes.CONVERSATION_NOT_FOUND);
    }

    await this.messageRepository.deleteAllByConversationId(id);

    const deleted = await this.conversationRepository.deleteByIdForUser(id, userId);
    if (!deleted) {
      throw new NotFoundError(`Conversation with ID ${id} not found`, ErrorCodes.CONVERSATION_NOT_FOUND);
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

  async handleMessageClassification(
    messages: UIMessage[],
    pageContext?: PageContext,
    telemetryContext?: TelemetryContext,
  ) {
    const messageClassification = await classifyMessage(messages, pageContext, telemetryContext);
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

  validateChatMode(conversation: Conversation, mode?: ChatMode, pageContext?: PageContext) {
    const savedConversationPageContext = conversation.pageContext;
    const newPageContext = pageContext;

    if (savedConversationPageContext) {
      if (mode !== ChatMode.PAGE) {
        throw new ValidationError(
          'Conversation is page-scoped and must use mode "page"',
          ErrorCodes.CONVERSATION_MODE_LOCKED,
        );
      }

      if (!newPageContext) {
        throw new ValidationError('pageContext is required when mode is "page"', ErrorCodes.MISSING_REQUIRED_FIELD);
      }

      if (
        newPageContext.type !== savedConversationPageContext.type ||
        newPageContext.resourceId !== savedConversationPageContext.resourceId
      ) {
        throw new ValidationError('Conversation is locked to a different page context', ErrorCodes.CONTEXT_MISMATCH);
      }
    } else if (mode === ChatMode.PAGE) {
      // Do not allow turning an existing global conversation into page-scoped
      throw new ValidationError(
        'Cannot change an existing conversation to a page-scoped context',
        ErrorCodes.CONVERSATION_MODE_LOCKED,
      );
    }
  }

  handleClosedConversation() {
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

  async getSystemPromptAndTools(
    mode: ChatMode,
    getAuthenticatedUser: () => AuthenticatedUser,
    pageContext?: PageContext,
  ) {
    const { jwtToken } = getAuthenticatedUser();

    if (mode === ChatMode.PAGE) {
      if (!pageContext) {
        throw new ValidationError('pageContext is required when mode is "page"', ErrorCodes.MISSING_REQUIRED_FIELD);
      }

      const enrichedContext = await this.pageContextService.enrichContext(pageContext, jwtToken);
      const systemPrompt = this.buildPageScopedPrompt(enrichedContext);
      const tools = createPageScopedTools(this.paystackApiService, getAuthenticatedUser, pageContext.type);

      return { systemPrompt, tools };
    } else {
      const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
      const systemPrompt = CHAT_AGENT_SYSTEM_PROMPT.replace(/\{\{CURRENT_DATE\}\}/g, currentDate);
      const tools = createTools(this.paystackApiService, getAuthenticatedUser);

      return { systemPrompt, tools };
    }
  }

  async handleMessageSummarization(
    conversation: Conversation,
    userId: string,
    savedMessages: MessageResponseDto[],
    tokenCountForThisInteraction?: number,
    telemetryContext?: TelemetryContext,
  ) {
    if (tokenCountForThisInteraction) {
      conversation.totalTokensUsed += tokenCountForThisInteraction;
      await this.conversationRepository.save(conversation);
    }

    const maxSummaries = this.configService.get<number>('MAX_SUMMARIES', 2);
    const currentSummaryCount = conversation.summaryCount;

    const contextWindowSize = this.configService.get<number>('CONTEXT_WINDOW_SIZE', 128000);
    const thresholdPercentage = this.configService.get<number>('TOKEN_THRESHOLD_PERCENTAGE', 0.6);
    const tokenThreshold = Math.floor(contextWindowSize * thresholdPercentage);

    const shouldSummarize = conversation.totalTokensUsed >= tokenThreshold;

    if (shouldSummarize && currentSummaryCount < maxSummaries) {
      try {
        // Only summarize messages that haven't been summarized yet to avoid reprocessing full history
        const messagesNeedingSummary = conversation.lastSummarizedMessageId
          ? MessageResponseDto.fromEntities(
              await this.messageRepository.findMessagesAfterMessageId(
                conversation.id,
                conversation.lastSummarizedMessageId,
              ),
            )
          : await this.getMessagesByConversationId(conversation.id, userId);

        if (messagesNeedingSummary.length > 0) {
          // Create summarization telemetry context if not provided
          const summaryTelemetryContext = telemetryContext
            ? { ...telemetryContext, operationType: LLMOperationType.SUMMARIZATION }
            : undefined;

          const newSummary = await summarizeConversation(
            convertToUIMessages(messagesNeedingSummary),
            conversation.summary,
            summaryTelemetryContext,
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
              totalTokensUsed: 0, // Reset token counter after summarization -- TODO: Instead, use the number of tokens that makes up the summary
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
  }

  async validateMessages(messages: UIMessage[], tools: Record<string, Tool<unknown, unknown>>) {
    try {
      const validatedMessages = await validateUIMessages({ messages, tools });
      return validatedMessages;
    } catch (error) {
      if (error instanceof TypeValidationError) {
        // Log validation error for monitoring
        // eslint-disable-next-line no-console
        console.error('Database messages validation failed:', error);
        // TODO: Could implement message migration or filtering here
        // For now, start with empty history
        return [];
      } else {
        throw error;
      }
    }
  }

  // TODO: Consider decoding the JWT here to get the userId
  async handleStreamingChat(dto: ChatRequestDto, userId: string, jwtToken: string) {
    const { conversationId, message, mode, pageContext } = dto;
    const parentTraceId = randomUUID();

    await this.checkUserEntitlement(userId);

    const retentionDays = this.configService.get<number>('CONVERSATION_TTL_DAYS', 3);

    let conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      try {
        // Create telemetry context for title generation
        const titleTelemetryContext = createMinimalTelemetryContext(
          conversationId,
          userId,
          LLMOperationType.TITLE_GENERATION,
          parentTraceId,
        );

        const title = await generateConversationTitle(message, titleTelemetryContext);

        conversation = await this.conversationRepository.createConversation({
          id: conversationId,
          title,
          userId,
          mode,
          pageContext,
          lastActivityAt: new Date(),
          expiresAt: this.calculateExpiry(retentionDays),
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error creating conversation:', error);
        throw new APIError('Failed to create conversation', ErrorCodes.INTERNAL_ERROR);
      }
    } else if (conversation.userId !== userId) {
      throw new NotFoundError(`Conversation with ID ${conversationId} not found`, ErrorCodes.CONVERSATION_NOT_FOUND);
    }

    if (conversation.isClosed) {
      return this.handleClosedConversation();
    }

    this.validateChatMode(conversation, mode, pageContext);

    // Build messages with summary support
    const uiMessages = await this.buildMessagesForLLM(conversation, conversationId, userId, message);

    // Extract user message text for tracing
    const userMessageText = getTextFromMessage(message);

    // Create telemetry context for classification
    const classificationTelemetryContext = createChatTelemetryContext(
      conversationId,
      userId,
      mode,
      pageContext,
      LLMOperationType.CLASSIFICATION,
      parentTraceId,
    );

    // Create parent Langfuse trace for this chat interaction
    const conversationTrace = createConversationTrace(classificationTelemetryContext, parentTraceId, {
      message: userMessageText,
      mode: mode || ChatMode.GLOBAL,
      pageContext,
    });

    const messageClassification = await this.handleMessageClassification(
      uiMessages,
      pageContext,
      classificationTelemetryContext,
    );

    await this.saveMessages(
      [
        {
          conversationId,
          role: MessageRole.USER,
          parts: message.parts,
          id: randomUUID(),
        },
      ],
      userId,
    );

    if (messageClassification) {
      await this.messageRepository.createMessage({
        conversationId,
        role: MessageRole.ASSISTANT,
        id: randomUUID(),
        parts: [
          {
            type: 'text',
            text: messageClassification.text,
          },
        ],
        expiresAt: this.calculateExpiry(retentionDays),
      });

      // Update trace with refusal output
      if (conversationTrace) {
        conversationTrace.update({
          output: {
            type: messageClassification.type,
            text: messageClassification.text,
          },
        });
        await getLangfuseClient()?.flushAsync();
      }

      return {
        type: messageClassification.type,
        responseStream: messageClassification.responseStream,
      };
    }

    const getAuthenticatedUser = () => ({
      userId,
      jwtToken,
    });

    const { systemPrompt, tools } = await this.getSystemPromptAndTools(
      mode || ChatMode.GLOBAL,
      getAuthenticatedUser,
      pageContext,
    );

    const validatedMessages = await this.validateMessages(uiMessages, tools);

    // Create telemetry context for chat response streaming
    const chatTelemetryContext = createChatTelemetryContext(
      conversationId,
      userId,
      mode,
      pageContext,
      LLMOperationType.CHAT_RESPONSE,
      parentTraceId,
    );

    let capturedUsage: LanguageModelUsage;
    let assistantResponse = '';

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({
          type: 'start',
          messageId: randomUUID(),
        });

        const result = streamText({
          model: openai('gpt-4o-mini'),
          system: systemPrompt,
          messages: convertToModelMessages(validatedMessages),
          stopWhen: stepCountIs(10),
          tools,
          experimental_telemetry: createTelemetryConfig(chatTelemetryContext),
          onFinish: ({ totalUsage }) => {
            capturedUsage = totalUsage;
          },
        });

        /**
         * Consume the stream to ensure it runs to completion & triggers onFinish
         * even when the client response is aborted
         */
        void result.consumeStream();

        writer.merge(
          result.toUIMessageStream({
            sendReasoning: true,
            sendStart: false,
          }),
        );
      },
      onFinish: async ({ messages }) => {
        const formattedMessages = messages.map((message) => ({
          conversationId: dto.conversationId,
          role: message.role as MessageRole,
          parts: message.parts,
          id: message.id,
        }));

        const savedMessages = await this.saveMessages(formattedMessages, userId);

        // Extract assistant response text for tracing
        const assistantMessage = messages.find((msg) => msg.role === 'assistant');
        if (assistantMessage) {
          assistantResponse = getTextFromMessage(assistantMessage);
        }

        // Update trace with final output
        if (conversationTrace) {
          conversationTrace.update({
            output: {
              type: ChatResponseType.CHAT_RESPONSE,
              response: assistantResponse,
              usage: capturedUsage,
            },
          });
          await getLangfuseClient()?.flushAsync();
        }

        // Pass telemetry context for summarization (will be modified with SUMMARIZATION operation type)
        await this.handleMessageSummarization(
          conversation,
          userId,
          savedMessages,
          capturedUsage?.totalTokens,
          chatTelemetryContext,
        );
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

  private calculateExpiry(retentionDays: number, fromDate = new Date()) {
    return new Date(fromDate.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  }
}
