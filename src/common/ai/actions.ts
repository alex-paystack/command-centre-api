import { generateObject, generateText, type UIMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  CONVERSATION_TITLE_GENERATION_PROMPT,
  CONVERSATION_SUMMARY_PROMPT,
  CLASSIFIER_SYSTEM_PROMPT,
  getClassifierUserPrompt,
  PAGE_SCOPED_CLASSIFIER_SYSTEM_PROMPT,
} from './prompts';
import { getTextFromMessage, getTextFromMessages, buildClassifierConversation } from './utils';
import { z } from 'zod';
import { MessageClassificationIntent, PageContext } from './types';
import type { LangfuseService } from '../observability/langfuse.service';
import { createAITelemetryConfig } from '../observability/utils/ai-telemetry-config';
import { Conversation } from '~/modules/chat/entities/conversation.entity';

/**
 * Generate a conversation title from a message
 * Uses GPT-3.5-turbo for cost efficiency
 *
 * @param message - The first user message in the conversation
 * @param langfuseService - Optional Langfuse service for observability
 * @returns A generated title or a fallback if generation fails
 */
export async function generateConversationTitle(message: UIMessage, langfuseService?: LangfuseService) {
  try {
    const telemetryConfig = langfuseService
      ? createAITelemetryConfig(langfuseService, {
          functionId: 'generate-title',
          promptName: 'title-generation-prompt',
          promptVersion: 1,
        })
      : {};

    const { text } = await generateText({
      model: openai('gpt-3.5-turbo'),
      system: CONVERSATION_TITLE_GENERATION_PROMPT,
      prompt: getTextFromMessage(message),
      ...telemetryConfig,
    });

    const title = text.trim();
    return title || 'New Conversation';
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error generating conversation title:', error);
    return 'New Conversation';
  }
}

/**
 * Generate a summary of a conversation
 * Uses GPT-4o-mini for cost efficiency while maintaining quality
 *
 * @param messages - The full conversation history to summarize
 * @param existingSummary - Optional existing summary to build upon
 * @param langfuseService - Optional Langfuse service for observability
 * @param conversationId - Optional conversation ID for tracing
 * @returns A generated summary or empty string if generation fails
 */
export async function summarizeConversation(
  messages: UIMessage[],
  conversation: Conversation,
  langfuseService?: LangfuseService,
) {
  try {
    const conversationText = getTextFromMessages(messages);
    let prompt = conversationText;
    const existingSummary = conversation.summary;

    if (existingSummary) {
      prompt = `Previous Summary:\n${existingSummary}\n\n---\n\nNew Messages to Incorporate:\n${conversationText}`;
    }

    const telemetryConfig = langfuseService
      ? createAITelemetryConfig(langfuseService, {
          functionId: 'conversation-summary',
          promptName: 'summary-prompt',
          promptVersion: 1,
          metadata: {
            conversationId: conversation.id,
            messageCount: messages.length,
            hasPreviousSummary: !!existingSummary,
          },
        })
      : {};

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: CONVERSATION_SUMMARY_PROMPT,
      prompt,
      ...telemetryConfig,
    });

    return text.trim();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error generating conversation summary:', error);
    return '';
  }
}

const ClassifierSchema = z.object({
  intent: z.enum(Object.values(MessageClassificationIntent)),
  confidence: z.number().min(0).max(1),
  needsMerchantData: z.boolean(),
});

/**
 * Classify a message into an intent
 * This ensures that the chat response is scoped to the merchant's dashboard and Paystack product usage.
 *
 * Uses a fast model to ensure a quick response.
 *
 * @param messages - The conversation history
 * @param pageContext - Optional page context for scoped classification
 * @param langfuseService - Optional Langfuse service for observability
 * @returns The classified intent
 */
export async function classifyMessage(
  messages: UIMessage[],
  pageContext?: PageContext,
  langfuseService?: LangfuseService,
) {
  try {
    let systemPrompt = CLASSIFIER_SYSTEM_PROMPT;

    if (pageContext) {
      systemPrompt = PAGE_SCOPED_CLASSIFIER_SYSTEM_PROMPT.replace(/\{\{RESOURCE_TYPE\}\}/g, pageContext.type);
    }

    const { formattedConversation, latestUserMessage } = buildClassifierConversation(messages);

    const telemetryConfig = langfuseService
      ? createAITelemetryConfig(langfuseService, {
          functionId: 'message-classification',
          promptName: pageContext ? 'page-scoped-classifier-prompt' : 'classifier-prompt',
          promptVersion: 1,
          metadata: {
            hasPageContext: !!pageContext,
            ...(pageContext?.type && { pageContextType: pageContext.type }),
          },
        })
      : {};

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      temperature: 0,
      schema: ClassifierSchema,
      system: systemPrompt,
      prompt: getClassifierUserPrompt(formattedConversation, latestUserMessage),
      ...telemetryConfig,
    });

    return object;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error classifying message:', error);
    return {
      intent: MessageClassificationIntent.OUT_OF_SCOPE,
      confidence: 0,
      needsMerchantData: false,
    };
  }
}
