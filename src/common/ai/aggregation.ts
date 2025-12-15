import { format, getISOWeek, getISOWeekYear, isValid, parseISO } from 'date-fns';
import type { ChartableRecord } from './chart-config';
import { AggregationType, ChartResourceType, getResourceDisplayName } from './chart-config';
import { amountInSubUnitToBaseUnit } from './utils';

export { AggregationType } from './chart-config';

/**
 * Recharts-compatible data point for charting
 */
export interface ChartDataPoint {
  name: string; // Label (e.g., "2024-01-15", "Monday", "success")
  count: number; // Record count
  volume: number; // Total amount (converted from subunits)
  average: number; // Average amount
  currency: string; // Currency code for the aggregated data
}

/**
 * Series of chart points for a single currency (used for time-based charts)
 */
export interface ChartSeries {
  currency: string;
  points: ChartDataPoint[];
}

/**
 * Summary statistics for the entire dataset
 */
export interface ChartSummary {
  totalCount: number;
  totalVolume: number | null;
  overallAverage: number | null;
  perCurrency?: {
    currency: string;
    totalCount: number;
    totalVolume: number;
    overallAverage: number;
  }[];
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
  // For categorical aggregations
  chartData?: ChartDataPoint[];
  // For time-series aggregations (per-currency series)
  chartSeries?: ChartSeries[];
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
    [AggregationType.BY_TYPE]: ChartType.DOUGHNUT,
    [AggregationType.BY_CATEGORY]: ChartType.DOUGHNUT,
    [AggregationType.BY_RESOLUTION]: ChartType.DOUGHNUT,
  };

  return chartTypeMap[aggregationType];
}

/**
 * Generate a descriptive label for the chart based on aggregation type, resource type, and date range
 */
export function generateChartLabel(
  aggregationType: AggregationType,
  dateRange?: { from?: string; to?: string },
  resourceType: ChartResourceType = ChartResourceType.TRANSACTION,
): string {
  const resourceName = getResourceDisplayName(resourceType);

  const labelMap: Record<AggregationType, string> = {
    [AggregationType.BY_DAY]: `Daily ${resourceName} Metrics`,
    [AggregationType.BY_HOUR]: `Hourly ${resourceName} Metrics`,
    [AggregationType.BY_WEEK]: `Weekly ${resourceName} Metrics`,
    [AggregationType.BY_MONTH]: `Monthly ${resourceName} Metrics`,
    [AggregationType.BY_STATUS]: `${resourceName} Metrics by Status`,
    [AggregationType.BY_TYPE]: `${resourceName} Metrics by Type`,
    [AggregationType.BY_CATEGORY]: `${resourceName} Metrics by Category`,
    [AggregationType.BY_RESOLUTION]: `${resourceName} Metrics by Resolution`,
  };

  let label = labelMap[aggregationType];

  // Add date range if provided
  if ((dateRange?.from && isValid(parseISO(dateRange.from))) || (dateRange?.to && isValid(parseISO(dateRange.to)))) {
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
 * Helper to calculate metrics from a group of chartable records
 */
function calculateMetrics(records: ChartableRecord[]): {
  count: number;
  volume: number;
  average: number;
} {
  const count = records.length;
  const volume = records.reduce((sum, record) => sum + amountInSubUnitToBaseUnit(record.amount), 0);
  const average = count > 0 ? volume / count : 0;

  return {
    count,
    volume: Math.round(volume * 100) / 100,
    average: Math.round(average * 100) / 100,
  };
}

// Normalize a Date to midnight UTC to keep day/week/month bucketing consistent
function normalizeToUTCDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDayKeyToUTCDate(dayKey: string): Date {
  const [yearStr, monthStr, dayStr] = dayKey.split('-');
  return new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)));
}

/**
 * Group records by currency
 */
function groupByCurrency(records: ChartableRecord[]): Map<string, ChartableRecord[]> {
  const grouped = new Map<string, ChartableRecord[]>();

  for (const record of records) {
    const currency = record.currency;
    if (!grouped.has(currency)) {
      grouped.set(currency, []);
    }
    grouped.get(currency)!.push(record);
  }

  return grouped;
}

/**
 * Reusable categorical aggregator
 */
export function aggregateByKey(
  records: ChartableRecord[],
  keySelector: (record: ChartableRecord) => string | null | undefined,
  options: { unknownLabel?: string; sortKeys?: (a: string, b: string) => number } = {},
): ChartDataPoint[] {
  const chartData: ChartDataPoint[] = [];
  const { unknownLabel = 'unknown', sortKeys = (a, b) => a.localeCompare(b) } = options;
  const currencyGroups = groupByCurrency(records);

  for (const currency of Array.from(currencyGroups.keys()).sort()) {
    const recordsByCurrency = currencyGroups.get(currency)!;
    const groupedByKey = new Map<string, ChartableRecord[]>();

    for (const record of recordsByCurrency) {
      const key = keySelector(record) ?? unknownLabel;

      if (!groupedByKey.has(key)) {
        groupedByKey.set(key, []);
      }
      groupedByKey.get(key)!.push(record);
    }

    const sortedKeys = Array.from(groupedByKey.keys()).sort(sortKeys);

    for (const key of sortedKeys) {
      const keyRecords = groupedByKey.get(key)!;
      const metrics = calculateMetrics(keyRecords);
      chartData.push({
        name: key,
        currency,
        ...metrics,
      });
    }
  }

  return chartData;
}

// Format helpers that force UTC to avoid local timezone shifts
const dayNameFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' });
const monthDayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Aggregate records by day, showing day names (e.g., "Monday, Nov 25")
 */
export function aggregateByDay(records: ChartableRecord[]): ChartSeries[] {
  const series: ChartSeries[] = [];
  const currencyGroups = groupByCurrency(records);

  for (const currency of Array.from(currencyGroups.keys()).sort()) {
    const recordsByCurrency = currencyGroups.get(currency)!;
    const groupedByDay = new Map<string, ChartableRecord[]>();

    for (const record of recordsByCurrency) {
      const date = normalizeToUTCDate(parseISO(record.createdAt));
      const dayKey = `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date
        .getUTCDate()
        .toString()
        .padStart(2, '0')}`; // YYYY-MM-DD (UTC) for grouping

      if (!groupedByDay.has(dayKey)) {
        groupedByDay.set(dayKey, []);
      }
      groupedByDay.get(dayKey)!.push(record);
    }

    // Sort keys chronologically first
    const sortedKeys = Array.from(groupedByDay.keys()).sort();

    const points = sortedKeys.map((dayKey) => {
      const dayRecords = groupedByDay.get(dayKey)!;
      const metrics = calculateMetrics(dayRecords);
      const date = parseDayKeyToUTCDate(dayKey);
      const dayName = dayNameFormatter.format(date); // Full day name (e.g., "Monday")
      const formattedDate = monthDayFormatter.format(date); // e.g., "Nov 25"

      return {
        name: `${dayName}, ${formattedDate}`,
        currency,
        ...metrics,
      };
    });

    series.push({ currency, points });
  }

  return series;
}

/**
 * Aggregate records by hour (0-23, UTC)
 */
export function aggregateByHour(records: ChartableRecord[]): ChartSeries[] {
  const series: ChartSeries[] = [];
  const currencyGroups = groupByCurrency(records);

  for (const currency of Array.from(currencyGroups.keys()).sort()) {
    const recordsByCurrency = currencyGroups.get(currency)!;
    const groupedByHour = new Map<number, ChartableRecord[]>();

    for (const record of recordsByCurrency) {
      const date = parseISO(record.createdAt);
      const hour = date.getUTCHours(); // Use UTC hours for consistency

      if (!groupedByHour.has(hour)) {
        groupedByHour.set(hour, []);
      }
      groupedByHour.get(hour)!.push(record);
    }

    const sortedHours = Array.from(groupedByHour.keys()).sort((a, b) => a - b);

    const points = sortedHours.map((hour) => {
      const hourRecords = groupedByHour.get(hour)!;
      const metrics = calculateMetrics(hourRecords);
      return {
        name: format(new Date(2000, 0, 1, hour), 'HH:00'), // Format hour as "HH:00"
        currency,
        ...metrics,
      };
    });

    series.push({ currency, points });
  }

  return series;
}

/**
 * Aggregate records by week (ISO week format: YYYY-Www)
 */
export function aggregateByWeek(records: ChartableRecord[]): ChartSeries[] {
  const series: ChartSeries[] = [];
  const currencyGroups = groupByCurrency(records);

  for (const currency of Array.from(currencyGroups.keys()).sort()) {
    const recordsByCurrency = currencyGroups.get(currency)!;
    const groupedByWeek = new Map<string, ChartableRecord[]>();

    for (const record of recordsByCurrency) {
      const date = normalizeToUTCDate(parseISO(record.createdAt));
      const year = getISOWeekYear(date);
      const week = getISOWeek(date);
      const weekKey = `${year}-W${week.toString().padStart(2, '0')}`;

      if (!groupedByWeek.has(weekKey)) {
        groupedByWeek.set(weekKey, []);
      }
      groupedByWeek.get(weekKey)!.push(record);
    }

    const sortedWeeks = Array.from(groupedByWeek.keys()).sort();

    const points = sortedWeeks.map((week) => {
      const weekRecords = groupedByWeek.get(week)!;
      const metrics = calculateMetrics(weekRecords);
      return {
        name: week,
        currency,
        ...metrics,
      };
    });

    series.push({ currency, points });
  }

  return series;
}

/**
 * Aggregate records by month (YYYY-MM)
 */
export function aggregateByMonth(records: ChartableRecord[]): ChartSeries[] {
  const series: ChartSeries[] = [];
  const currencyGroups = groupByCurrency(records);

  for (const currency of Array.from(currencyGroups.keys()).sort()) {
    const recordsByCurrency = currencyGroups.get(currency)!;
    const groupedByMonth = new Map<string, ChartableRecord[]>();

    for (const record of recordsByCurrency) {
      const date = normalizeToUTCDate(parseISO(record.createdAt));
      const monthKey = `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}`;

      if (!groupedByMonth.has(monthKey)) {
        groupedByMonth.set(monthKey, []);
      }
      groupedByMonth.get(monthKey)!.push(record);
    }

    const sortedMonths = Array.from(groupedByMonth.keys()).sort();

    const points = sortedMonths.map((month) => {
      const monthRecords = groupedByMonth.get(month)!;
      const metrics = calculateMetrics(monthRecords);
      return {
        name: month,
        currency,
        ...metrics,
      };
    });

    series.push({ currency, points });
  }

  return series;
}

/**
 * Aggregate records by status
 */
export function aggregateByStatus(records: ChartableRecord[]): ChartDataPoint[] {
  return aggregateByKey(records, (record) => record.status);
}

/**
 * Aggregate records by type (for refunds: full/partial)
 */
export function aggregateByType(records: ChartableRecord[]): ChartDataPoint[] {
  return aggregateByKey(records, (record) => record.type);
}

/**
 * Aggregate records by category (for disputes: fraud/chargeback)
 */
export function aggregateByCategory(records: ChartableRecord[]): ChartDataPoint[] {
  return aggregateByKey(records, (record) => record.category);
}

/**
 * Aggregate records by resolution (for disputes: resolution outcomes)
 */
export function aggregateByResolution(records: ChartableRecord[]): ChartDataPoint[] {
  return aggregateByKey(records, (record) => record.resolution);
}

/**
 * Router function that calls the appropriate aggregator based on type
 * Works with generic ChartableRecord for all resource types
 */
export type AggregationResult =
  | { chartSeries: ChartSeries[]; chartData?: undefined }
  | { chartSeries?: undefined; chartData: ChartDataPoint[] };

export function aggregateRecords(records: ChartableRecord[], aggregationType: AggregationType): AggregationResult {
  switch (aggregationType) {
    case AggregationType.BY_DAY:
      return { chartSeries: aggregateByDay(records) };
    case AggregationType.BY_HOUR:
      return { chartSeries: aggregateByHour(records) };
    case AggregationType.BY_WEEK:
      return { chartSeries: aggregateByWeek(records) };
    case AggregationType.BY_MONTH:
      return { chartSeries: aggregateByMonth(records) };
    case AggregationType.BY_STATUS:
      return { chartData: aggregateByStatus(records) };
    case AggregationType.BY_TYPE:
      return { chartData: aggregateByType(records) };
    case AggregationType.BY_CATEGORY:
      return { chartData: aggregateByCategory(records) };
    case AggregationType.BY_RESOLUTION:
      return { chartData: aggregateByResolution(records) };
    default: {
      throw new Error(`Unknown aggregation type: ${String(aggregationType)}`);
    }
  }
}

const formatDate = (dateStr: string) => format(parseISO(dateStr), 'MMM d, yyyy');

/**
 * Calculate summary statistics for a set of chartable records
 */
export function calculateSummary(records: ChartableRecord[], dateRange?: { from?: string; to?: string }): ChartSummary {
  const currencyGroups = groupByCurrency(records);
  const perCurrency: NonNullable<ChartSummary['perCurrency']> = [];

  for (const [currency, currencyGroupedRecords] of Array.from(currencyGroups.entries())) {
    const metrics = calculateMetrics(currencyGroupedRecords);
    perCurrency.push({
      currency,
      totalCount: metrics.count,
      totalVolume: metrics.volume,
      overallAverage: metrics.average,
    });
  }

  // For mixed currencies, totalVolume/average are not meaningful; keep zero and rely on perCurrency.
  const summary: ChartSummary = {
    totalCount: records.length,
    totalVolume: records.length === 0 ? 0 : perCurrency.length === 1 ? perCurrency[0].totalVolume : null,
    overallAverage: records.length === 0 ? 0 : perCurrency.length === 1 ? perCurrency[0].overallAverage : null,
    perCurrency: perCurrency.sort((a, b) => a.currency.localeCompare(b.currency)),
  };

  if ((dateRange?.from && isValid(parseISO(dateRange.from))) || (dateRange?.to && isValid(parseISO(dateRange.to)))) {
    summary.dateRange = {
      from: dateRange.from ? formatDate(dateRange.from) : 'N/A',
      to: dateRange.to ? formatDate(dateRange.to) : 'N/A',
    };
  }

  return summary;
}
