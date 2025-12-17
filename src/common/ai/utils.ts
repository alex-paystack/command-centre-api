import { type UIMessage } from 'ai';
import { isAfter, isValid, parseISO } from 'date-fns';
import { MessageResponseDto } from 'src/modules/chat/dto/message-response.dto';

export function getTextFromMessage(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { type: 'text'; text: string }).text)
    .join('');
}

export function getTextFromMessages(messages: UIMessage[]) {
  return messages
    .map((message) => {
      const content = getTextFromMessage(message);
      return `${message.role}: ${content}`.trim();
    })
    .join('\n');
}

/**
 * Prepare a trimmed, most-recent-first view of the conversation for classification.
 * Returns both the formatted conversation and the latest user message text.
 */
export function buildClassifierConversation(messages: UIMessage[], maxMessages = 15) {
  const trimmed = messages.slice(-maxMessages);

  const reversed = [...trimmed].reverse();
  const formattedConversation = reversed
    .map((message) => `${message.role}: ${getTextFromMessage(message)}`.trim())
    .join('\n');

  const latestUserMessage = reversed.find((message) => message.role === 'user');

  return {
    formattedConversation,
    latestUserMessage: latestUserMessage ? getTextFromMessage(latestUserMessage) : '',
  };
}

export function convertToUIMessages(messages: MessageResponseDto[]): UIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts,
  }));
}

function toUtcDayNumber(date: Date) {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / (24 * 60 * 60 * 1000));
}

function differenceInUtcDays(firstDate: Date, secondDate: Date) {
  return Math.abs(toUtcDayNumber(firstDate) - toUtcDayNumber(secondDate));
}

/**
 * Validates that the date range between from and to does not exceed 30 days
 * @param from - Start date (ISO 8601 format, e.g., 2024-01-01)
 * @param to - End date (ISO 8601 format, e.g., 2024-12-31)
 * @returns Object with isValid boolean and optional error message
 */
export function validateDateRange(
  from?: string,
  to?: string,
): { isValid: boolean; error?: string; daysDifference?: number } {
  const MAX_DAYS = 30;
  const today = new Date();

  if (!from && !to) {
    return { isValid: true };
  }

  const fromDate = from ? parseISO(from) : null;
  const toDate = to ? parseISO(to) : null;

  // Validate date formats
  if (fromDate && !isValid(fromDate)) {
    return {
      isValid: false,
      error: `Invalid 'from' date format: ${from}. Please use ISO 8601 format (e.g., 2024-01-01)`,
    };
  }

  if (toDate && !isValid(toDate)) {
    return {
      isValid: false,
      error: `Invalid 'to' date format: ${to}. Please use ISO 8601 format (e.g., 2024-01-01)`,
    };
  }

  // Both dates provided
  if (fromDate && toDate) {
    if (isAfter(fromDate, toDate)) {
      return {
        isValid: false,
        error: "The 'from' date cannot be after the 'to' date",
      };
    }

    const diffInDays = differenceInUtcDays(toDate, fromDate);

    if (diffInDays > MAX_DAYS) {
      return {
        isValid: false,
        error: `Date range exceeds the maximum allowed period of ${MAX_DAYS} days. The requested range is ${diffInDays} days. Please narrow your date range.`,
        daysDifference: diffInDays,
      };
    }

    return { isValid: true, daysDifference: diffInDays };
  }

  // Only 'from' date provided (defaults to today as end)
  if (fromDate && !toDate) {
    const diffInDays = differenceInUtcDays(today, fromDate);

    if (diffInDays > MAX_DAYS) {
      return {
        isValid: false,
        error: `Date range exceeds the maximum allowed period of ${MAX_DAYS} days when defaulting the end date to today. The requested range is ${diffInDays} days. Please narrow your date range or provide a closer end date.`,
        daysDifference: diffInDays,
      };
    }

    return { isValid: true, daysDifference: diffInDays };
  }

  // Only 'to' date provided (defaults to today as start)
  if (!fromDate && toDate) {
    const diffInDays = differenceInUtcDays(toDate, today);

    if (diffInDays > MAX_DAYS) {
      return {
        isValid: false,
        error: `Date range exceeds the maximum allowed period of ${MAX_DAYS} days when defaulting the start date to today. The requested range is ${diffInDays} days. Please narrow your date range or provide a closer start date.`,
        daysDifference: diffInDays,
      };
    }

    return { isValid: true, daysDifference: diffInDays };
  }

  return { isValid: true };
}

export function amountInBaseUnitToSubUnit(amount: number) {
  return amount * 100;
}

export function amountInSubUnitToBaseUnit(amount: number) {
  return amount / 100;
}
