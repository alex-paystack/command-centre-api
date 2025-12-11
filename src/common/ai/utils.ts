import { type UIMessage } from 'ai';
import { MessageResponseDto } from 'src/modules/chat/dto/message-response.dto';

export function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { type: 'text'; text: string }).text)
    .join('');
}

export function convertToUIMessages(messages: MessageResponseDto[]): UIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts,
  }));
}
