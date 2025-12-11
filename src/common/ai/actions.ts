import { generateText, type UIMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { CONVERSATION_TITLE_GENERATION_PROMPT } from './prompts';
import { getTextFromMessage } from './utils';

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
