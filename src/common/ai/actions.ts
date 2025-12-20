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
import { LangfuseRuntime } from '~/common/observability/langfuse.runtime';

/**
 * Generate a conversation title from a message
 * Uses GPT-3.5-turbo for cost efficiency
 *
 * @param message - The first user message in the conversation
 * @returns A generated title or a fallback if generation fails
 */
export async function generateConversationTitle(message: UIMessage) {
  const generation = LangfuseRuntime.startGeneration({
    name: 'chat.title',
    model: 'gpt-3.5-turbo',
    input: {
      message: getTextFromMessage(message),
    },
  });
  try {
    const { text, usage } = await generateText({
      model: openai('gpt-3.5-turbo'),
      system: CONVERSATION_TITLE_GENERATION_PROMPT,
      prompt: getTextFromMessage(message),
    });

    const title = text.trim();
    LangfuseRuntime.endGeneration(generation, {
      output: { title },
      usage: LangfuseRuntime.mapUsage(usage as Record<string, number>),
    });
    return title || 'New Conversation';
  } catch (error) {
    LangfuseRuntime.endGeneration(generation, {
      level: 'ERROR',
      statusMessage: error instanceof Error ? error.message : String(error),
    });
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
 * @returns A generated summary or empty string if generation fails
 */
export async function summarizeConversation(messages: UIMessage[], existingSummary?: string) {
  const conversationText = getTextFromMessages(messages);
  const generation = LangfuseRuntime.startGeneration({
    name: 'chat.summarize',
    model: 'gpt-4o-mini',
    input: {
      existingSummary,
      conversationText,
    },
  });
  try {
    let prompt = conversationText;

    if (existingSummary) {
      prompt = `Previous Summary:\n${existingSummary}\n\n---\n\nNew Messages to Incorporate:\n${conversationText}`;
    }

    const { text, usage } = await generateText({
      model: openai('gpt-4o-mini'),
      system: CONVERSATION_SUMMARY_PROMPT,
      prompt,
    });

    const summary = text.trim();
    LangfuseRuntime.endGeneration(generation, {
      output: { summary },
      usage: LangfuseRuntime.mapUsage(usage as Record<string, number>),
    });
    return summary;
  } catch (error) {
    LangfuseRuntime.endGeneration(generation, {
      level: 'ERROR',
      statusMessage: error instanceof Error ? error.message : String(error),
    });
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
 * @returns The classified intent
 */
export async function classifyMessage(messages: UIMessage[], pageContext?: PageContext) {
  const { formattedConversation, latestUserMessage } = buildClassifierConversation(messages);
  const generation = LangfuseRuntime.startGeneration({
    name: 'chat.classify',
    model: 'gpt-4o-mini',
    input: {
      formattedConversation,
      latestUserMessage,
      pageContext,
    },
  });
  try {
    let systemPrompt = CLASSIFIER_SYSTEM_PROMPT;

    if (pageContext) {
      systemPrompt = PAGE_SCOPED_CLASSIFIER_SYSTEM_PROMPT.replace(/\{\{RESOURCE_TYPE\}\}/g, pageContext.type);
    }

    const { object, usage } = await generateObject({
      model: openai('gpt-4o-mini'),
      temperature: 0,
      schema: ClassifierSchema,
      system: systemPrompt,
      prompt: getClassifierUserPrompt(formattedConversation, latestUserMessage),
    });

    LangfuseRuntime.endGeneration(generation, {
      output: object,
      usage: LangfuseRuntime.mapUsage(usage as Record<string, number>),
      metadata: {
        pageContextType: pageContext?.type,
      },
    });
    return object;
  } catch (error) {
    LangfuseRuntime.endGeneration(generation, {
      level: 'ERROR',
      statusMessage: error instanceof Error ? error.message : String(error),
      metadata: {
        pageContextType: pageContext?.type,
      },
    });
    // eslint-disable-next-line no-console
    console.error('Error classifying message:', error);
    return {
      intent: MessageClassificationIntent.OUT_OF_SCOPE,
      confidence: 0,
      needsMerchantData: false,
    };
  }
}
