import { tool, type Tool } from 'ai';
import { z } from 'zod';

export const getTransactionsTool = tool({
  name: 'Get Transactions',
  description: 'Get the transactions for a given integration',
  inputSchema: z.object({
    integrationId: z.string().describe('The integration ID to get the transactions for'),
  }),
  execute: ({ integrationId }) => {
    return `Getting transactions for integration ${integrationId}...`;
  },
});

export const tools: Record<string, Tool<unknown, unknown>> = {
  getTransactionsTool,
};
