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

/**
 * Generate a conversation title from a message
 * Uses GPT-3.5-turbo for cost efficiency
 *
 * @param message - The first user message in the conversation
 * @returns A generated title or a fallback if generation fails
 */
export async function generateConversationTitle(message: UIMessage) {
  try {
    const { text } = await generateText({
      model: openai('gpt-3.5-turbo'),
      system: CONVERSATION_TITLE_GENERATION_PROMPT,
      prompt: getTextFromMessage(message),
      experimental_telemetry: {
        isEnabled: true,
      },
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
 * @returns A generated summary or empty string if generation fails
 */
export async function summarizeConversation(messages: UIMessage[], existingSummary?: string) {
  try {
    const conversationText = getTextFromMessages(messages);
    let prompt = conversationText;

    if (existingSummary) {
      prompt = `Previous Summary:\n${existingSummary}\n\n---\n\nNew Messages to Incorporate:\n${conversationText}`;
    }

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: CONVERSATION_SUMMARY_PROMPT,
      prompt,
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
 * @returns The classified intent
 */
export async function classifyMessage(messages: UIMessage[], pageContext?: PageContext) {
  try {
    let systemPrompt = CLASSIFIER_SYSTEM_PROMPT;

    if (pageContext) {
      systemPrompt = PAGE_SCOPED_CLASSIFIER_SYSTEM_PROMPT.replace(/\{\{RESOURCE_TYPE\}\}/g, pageContext.type);
    }

    const { formattedConversation, latestUserMessage } = buildClassifierConversation(messages);

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      temperature: 0,
      schema: ClassifierSchema,
      system: systemPrompt,
      prompt: getClassifierUserPrompt(formattedConversation, latestUserMessage),
      experimental_telemetry: {
        isEnabled: true,
      },
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
