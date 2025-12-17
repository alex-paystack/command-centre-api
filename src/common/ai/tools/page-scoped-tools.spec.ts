import { createPageScopedTools } from '.';
import { PageContextType } from '../types';
import { PaystackApiService } from '../../services/paystack-api.service';

describe('createPageScopedTools', () => {
  let mockPaystackService: jest.Mocked<PaystackApiService>;
  let mockGetAuthenticatedUser: jest.Mock;

  beforeEach(() => {
    mockPaystackService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<PaystackApiService>;

    mockGetAuthenticatedUser = jest.fn().mockReturnValue({ userId: 'test-user-id', jwtToken: 'test-token' });
  });

  it('should return only customer, dispute and refund tools for transaction context', () => {
    const tools = createPageScopedTools(mockPaystackService, mockGetAuthenticatedUser, PageContextType.TRANSACTION);

    const toolNames = Object.keys(tools);
    expect(toolNames).toContain('getCustomers');
    expect(toolNames).toContain('getRefunds');
    expect(toolNames).toContain('getDisputes');
    expect(toolNames).not.toContain('getTransactions');
    expect(toolNames).not.toContain('getPayouts');
    expect(toolNames).not.toContain('generateChartData');
  });

  it('should return transaction, refund, and export transaction tools for customer context', () => {
    const tools = createPageScopedTools(mockPaystackService, mockGetAuthenticatedUser, PageContextType.CUSTOMER);

    const toolNames = Object.keys(tools);
    expect(toolNames).toContain('getTransactions');
    expect(toolNames).toContain('getRefunds');
    expect(toolNames).toContain('exportTransactions');
    expect(toolNames).not.toContain('getCustomers');
    expect(toolNames).not.toContain('getDisputes');
    expect(toolNames).not.toContain('getPayouts');
    expect(toolNames).not.toContain('generateChartData');
  });

  it('should return transaction and customer tools for refund context', () => {
    const tools = createPageScopedTools(mockPaystackService, mockGetAuthenticatedUser, PageContextType.REFUND);

    const toolNames = Object.keys(tools);
    expect(toolNames).toContain('getTransactions');
    expect(toolNames).toContain('getCustomers');
    expect(toolNames).not.toContain('getRefunds');
    expect(toolNames).not.toContain('getPayouts');
    expect(toolNames).not.toContain('getDisputes');
    expect(toolNames).not.toContain('generateChartData');
  });

  it('should return only transaction tools for payout context', () => {
    const tools = createPageScopedTools(mockPaystackService, mockGetAuthenticatedUser, PageContextType.PAYOUT);

    const toolNames = Object.keys(tools);
    expect(toolNames).toContain('getTransactions');
    expect(toolNames).not.toContain('getCustomers');
    expect(toolNames).not.toContain('getRefunds');
    expect(toolNames).not.toContain('getPayouts');
    expect(toolNames).not.toContain('getDisputes');
    expect(toolNames).not.toContain('generateChartData');
  });

  it('should return transaction, customer, and refund tools for dispute context', () => {
    const tools = createPageScopedTools(mockPaystackService, mockGetAuthenticatedUser, PageContextType.DISPUTE);

    const toolNames = Object.keys(tools);
    expect(toolNames).toContain('getTransactions');
    expect(toolNames).toContain('getCustomers');
    expect(toolNames).toContain('getRefunds');
    expect(toolNames).not.toContain('getDisputes');
    expect(toolNames).not.toContain('getPayouts');
    expect(toolNames).not.toContain('generateChartData');
  });

  it('should return valid tool objects with correct structure', () => {
    const tools = createPageScopedTools(mockPaystackService, mockGetAuthenticatedUser, PageContextType.TRANSACTION);

    expect(tools.getCustomers).toBeDefined();
    expect(typeof tools.getCustomers).toBe('object');
    expect(tools.getCustomers).toHaveProperty('description');
    expect(tools.getCustomers).toHaveProperty('inputSchema');
    expect(tools.getCustomers).toHaveProperty('execute');
  });
});
