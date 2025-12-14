import { generateObject, generateText, type UIMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { CONVERSATION_TITLE_GENERATION_PROMPT, CLASSIFIER_SYSTEM_PROMPT, getClassifierUserPrompt } from './prompts';
import { getTextFromMessage, getTextFromMessages } from './utils';
import { z } from 'zod';
import { MessageClassificationIntent } from './types';

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
    });

    const title = text.trim();
    return title || 'New Conversation';
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error generating conversation title:', error);
    return 'New Conversation';
  }
}

const ClassifierSchema = z.object({
  intent: z.enum([
    MessageClassificationIntent.DASHBOARD_INSIGHT,
    MessageClassificationIntent.PAYSTACK_PRODUCT_FAQ,
    MessageClassificationIntent.ACCOUNT_HELP,
    MessageClassificationIntent.ASSISTANT_CAPABILITIES,
    MessageClassificationIntent.OUT_OF_SCOPE,
  ]),
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
export async function classifyMessage(messages: UIMessage[]) {
  try {
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: ClassifierSchema,
      system: CLASSIFIER_SYSTEM_PROMPT,
      prompt: getClassifierUserPrompt(getTextFromMessages(messages)),
    });

    return object;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error classifying message:', error);
    return {
      intent: MessageClassificationIntent.OUT_OF_SCOPE,
    };
  }
}
