import { format, getISOWeek, parseISO } from 'date-fns';
import type { PaystackTransaction } from './types/index';
import { amountInSubUnitToBaseUnit } from './utils';

/**
 * Aggregation type options for transaction data
 */
export enum AggregationType {
  BY_DAY = 'by-day',
  BY_HOUR = 'by-hour',
  BY_WEEK = 'by-week',
  BY_MONTH = 'by-month',
  BY_STATUS = 'by-status',
}

/**
 * Recharts-compatible data point for charting
 */
export interface ChartDataPoint {
  name: string; // Label (e.g., "2024-01-15", "Monday", "success")
  count: number; // Transaction count
  volume: number; // Total amount (converted from subunits)
  average: number; // Average transaction amount
}

/**
 * Summary statistics for the entire dataset
 */
export interface ChartSummary {
  totalCount: number;
  totalVolume: number;
  overallAverage: number;
  dateRange?: {
    from: string; // ISO date string or localized date
    to: string; // ISO date string or localized date
  };
}

/**
 * Supported chart types for data visualization
 */
export enum ChartType {
  LINE = 'line',
  AREA = 'area',
  BAR = 'bar',
  DOUGHNUT = 'doughnut',
  PIE = 'pie',
}

/**
 * Full chart result with descriptive label and chart type for UI display
 */
export interface ChartResult {
  label: string; // e.g., "Daily Transaction Metrics"
  chartType: ChartType; // Suggested chart type for visualization
  chartData: ChartDataPoint[];
  summary: ChartSummary;
}

/**
 * Determine the best chart type for a given aggregation type
 */
export function getChartType(aggregationType: AggregationType): ChartType {
  const chartTypeMap: Record<AggregationType, ChartType> = {
    [AggregationType.BY_DAY]: ChartType.AREA,
    [AggregationType.BY_HOUR]: ChartType.BAR,
    [AggregationType.BY_WEEK]: ChartType.AREA,
    [AggregationType.BY_MONTH]: ChartType.AREA,
    [AggregationType.BY_STATUS]: ChartType.DOUGHNUT,
  };

  return chartTypeMap[aggregationType];
}

/**
 * Generate a descriptive label for the chart based on aggregation type and date range
 */
export function generateChartLabel(
  aggregationType: AggregationType,
  dateRange?: { from?: string; to?: string },
): string {
  const labelMap: Record<AggregationType, string> = {
    [AggregationType.BY_DAY]: 'Daily Transaction Metrics',
    [AggregationType.BY_HOUR]: 'Hourly Transaction Metrics',
    [AggregationType.BY_WEEK]: 'Weekly Transaction Metrics',
    [AggregationType.BY_MONTH]: 'Monthly Transaction Metrics',
    [AggregationType.BY_STATUS]: 'Transaction Metrics by Status',
  };

  let label = labelMap[aggregationType];

  // Add date range if provided
  if (dateRange?.from || dateRange?.to) {
    const formatDate = (dateStr: string) => format(parseISO(dateStr), 'MMM d, yyyy');

    if (dateRange.from && dateRange.to) {
      label += ` (${formatDate(dateRange.from)} - ${formatDate(dateRange.to)})`;
    } else if (dateRange.from) {
      label += ` (from ${formatDate(dateRange.from)})`;
    } else if (dateRange.to) {
      label += ` (until ${formatDate(dateRange.to)})`;
    }
  }

  return label;
}

/**
 * Helper to calculate metrics from a group of transactions
 */
function calculateMetrics(transactions: PaystackTransaction[]): {
  count: number;
  volume: number;
  average: number;
} {
  const count = transactions.length;
  const volume = transactions.reduce((sum, transaction) => sum + amountInSubUnitToBaseUnit(transaction.amount), 0);
  const average = count > 0 ? volume / count : 0;

  return {
    count,
    volume: Math.round(volume * 100) / 100,
    average: Math.round(average * 100) / 100,
  };
}

/**
 * Aggregate transactions by day, showing day names (e.g., "Monday, Nov 25")
 */
export function aggregateByDay(transactions: PaystackTransaction[]): ChartDataPoint[] {
  const groupedByDay = new Map<string, PaystackTransaction[]>();

  for (const transaction of transactions) {
    const date = parseISO(transaction.createdAt);
    const dayKey = format(date, 'yyyy-MM-dd'); // YYYY-MM-DD for grouping

    if (!groupedByDay.has(dayKey)) {
      groupedByDay.set(dayKey, []);
    }
    groupedByDay.get(dayKey)!.push(transaction);
  }

  const chartData: ChartDataPoint[] = [];

  // Sort keys chronologically first
  const sortedKeys = Array.from(groupedByDay.keys()).sort();

  for (const dayKey of sortedKeys) {
    const transactions = groupedByDay.get(dayKey)!;
    const metrics = calculateMetrics(transactions);
    const date = parseISO(dayKey);
    const dayName = format(date, 'EEEE'); // Full day name (e.g., "Monday")
    const formattedDate = format(date, 'MMM d'); // e.g., "Nov 25"

    chartData.push({
      name: `${dayName}, ${formattedDate}`,
      ...metrics,
    });
  }

  return chartData;
}

/**
 * Aggregate transactions by hour (0-23, UTC)
 */
export function aggregateByHour(transactions: PaystackTransaction[]): ChartDataPoint[] {
  const groupedByHour = new Map<number, PaystackTransaction[]>();

  for (const transaction of transactions) {
    const date = parseISO(transaction.createdAt);
    const hour = date.getUTCHours(); // Use UTC hours for consistency

    if (!groupedByHour.has(hour)) {
      groupedByHour.set(hour, []);
    }
    groupedByHour.get(hour)!.push(transaction);
  }

  const chartData: ChartDataPoint[] = [];

  for (const [hour, transactions] of groupedByHour) {
    const metrics = calculateMetrics(transactions);
    chartData.push({
      name: format(new Date(2000, 0, 1, hour), 'HH:00'), // Format hour as "HH:00"
      ...metrics,
    });
  }

  // Sort by hour
  return chartData.sort((a, b) => {
    const hourA = parseInt(a.name.split(':')[0]);
    const hourB = parseInt(b.name.split(':')[0]);
    return hourA - hourB;
  });
}

/**
 * Aggregate transactions by week (ISO week format: YYYY-Www)
 */
export function aggregateByWeek(transactions: PaystackTransaction[]): ChartDataPoint[] {
  const groupedByWeek = new Map<string, PaystackTransaction[]>();

  for (const transaction of transactions) {
    const date = parseISO(transaction.createdAt);
    const year = format(date, 'yyyy');
    const week = getISOWeek(date);
    const weekKey = `${year}-W${week.toString().padStart(2, '0')}`;

    if (!groupedByWeek.has(weekKey)) {
      groupedByWeek.set(weekKey, []);
    }
    groupedByWeek.get(weekKey)!.push(transaction);
  }

  const chartData: ChartDataPoint[] = [];

  for (const [week, transactions] of groupedByWeek) {
    const metrics = calculateMetrics(transactions);
    chartData.push({
      name: week,
      ...metrics,
    });
  }

  // Sort chronologically
  return chartData.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Aggregate transactions by month (YYYY-MM)
 */
export function aggregateByMonth(transactions: PaystackTransaction[]): ChartDataPoint[] {
  const groupedByMonth = new Map<string, PaystackTransaction[]>();

  for (const transaction of transactions) {
    const date = parseISO(transaction.createdAt);
    const monthKey = format(date, 'yyyy-MM');

    if (!groupedByMonth.has(monthKey)) {
      groupedByMonth.set(monthKey, []);
    }
    groupedByMonth.get(monthKey)!.push(transaction);
  }

  const chartData: ChartDataPoint[] = [];

  for (const [month, transactions] of groupedByMonth) {
    const metrics = calculateMetrics(transactions);
    chartData.push({
      name: month,
      ...metrics,
    });
  }

  // Sort chronologically
  return chartData.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Aggregate transactions by status (success/failed/abandoned)
 */
export function aggregateByStatus(transactions: PaystackTransaction[]): ChartDataPoint[] {
  const groupedByStatus = new Map<string, PaystackTransaction[]>();

  for (const transaction of transactions) {
    const status = transaction.status;

    if (!groupedByStatus.has(status)) {
      groupedByStatus.set(status, []);
    }
    groupedByStatus.get(status)!.push(transaction);
  }

  const chartData: ChartDataPoint[] = [];

  for (const [status, transactions] of groupedByStatus) {
    const metrics = calculateMetrics(transactions);
    chartData.push({
      name: status,
      ...metrics,
    });
  }

  // Sort by status name
  return chartData.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Router function that calls the appropriate aggregator based on type
 */
export function aggregateTransactions(
  transactions: PaystackTransaction[],
  aggregationType: AggregationType,
): ChartDataPoint[] {
  switch (aggregationType) {
    case AggregationType.BY_DAY:
      return aggregateByDay(transactions);
    case AggregationType.BY_HOUR:
      return aggregateByHour(transactions);
    case AggregationType.BY_WEEK:
      return aggregateByWeek(transactions);
    case AggregationType.BY_MONTH:
      return aggregateByMonth(transactions);
    case AggregationType.BY_STATUS:
      return aggregateByStatus(transactions);
    default: {
      throw new Error(`Unknown aggregation type: ${String(aggregationType)}`);
    }
  }
}

/**
 * Calculate summary statistics for a set of transactions
 */
export function calculateSummary(
  transactions: PaystackTransaction[],
  dateRange?: { from?: string; to?: string },
): ChartSummary {
  const metrics = calculateMetrics(transactions);

  const formatDate = (dateStr: string) => format(parseISO(dateStr), 'MMM d, yyyy');

  const summary: ChartSummary = {
    totalCount: metrics.count,
    totalVolume: metrics.volume,
    overallAverage: metrics.average,
  };

  if (dateRange?.from || dateRange?.to) {
    summary.dateRange = {
      from: dateRange.from ? formatDate(dateRange.from) : 'N/A',
      to: dateRange.to ? formatDate(dateRange.to) : 'N/A',
    };
  }

  return summary;
}
