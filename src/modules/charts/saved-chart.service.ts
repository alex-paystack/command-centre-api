import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SavedChartRepository } from './repositories/saved-chart.repository';
import { PaystackApiService } from '~/common/services/paystack-api.service';
import { SaveChartDto } from './dto/save-chart.dto';
import { UpdateChartDto } from './dto/update-chart.dto';
import { RegenerateChartQueryDto } from './dto/regenerate-chart-query.dto';
import { SavedChartResponseDto } from './dto/saved-chart-response.dto';
import { SavedChartWithDataResponseDto } from './dto/saved-chart-with-data-response.dto';
import { validateChartParams } from '~/common/ai/utilities/chart-validation';
import { generateChartData, ChartGenerationState, ChartSuccessState } from '~/common/ai/utilities/chart-generator';
import { NotFoundError, ValidationError, ErrorCodes } from '~/common';
import { generateCacheKey } from './utilities/cache-key.util';

/**
 * Type for cached chart data
 * Matches the structure of ChartSuccessState without the 'success' flag
 */
interface CachedChartData {
  label: string;
  chartType: string;
  chartData: ChartSuccessState['chartData'];
  chartSeries: ChartSuccessState['chartSeries'];
  summary: ChartSuccessState['summary'];
  message: string;
}

@Injectable()
export class SavedChartService {
  private readonly logger = new Logger(SavedChartService.name);

  constructor(
    private readonly savedChartRepository: SavedChartRepository,
    private readonly paystackApiService: PaystackApiService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Save a new chart configuration
   */
  async saveChart(dto: SaveChartDto, userId: string) {
    this.validateChartConfiguration(dto);

    const savedChart = await this.savedChartRepository.createSavedChart({
      userId,
      createdFromConversationId: dto.createdFromConversationId,
      name: dto.name,
      description: dto.description,
      resourceType: dto.resourceType,
      aggregationType: dto.aggregationType,
      from: dto.from,
      to: dto.to,
      status: dto.status,
      currency: dto.currency,
    });

    return SavedChartResponseDto.fromEntity(savedChart);
  }

  /**
   * Get all saved charts for the authenticated user
   */
  async getAllSavedCharts(userId: string) {
    const charts = await this.savedChartRepository.findAllByUserId(userId);
    return SavedChartResponseDto.fromEntities(charts);
  }

  /**
   * Get a saved chart with data (with caching)
   * Query parameters can override saved configuration values
   *
   * Caching Strategy:
   * - Cache key includes chartId + all merged parameters (from, to, status, currency, channel)
   * - Each parameter combination gets its own cache entry
   * - Cache misses trigger full chart generation
   * - Cache failures are logged but don't break chart generation (graceful degradation)
   * - TTL: 3 hours (configured in cache.config.ts)
   */
  async getSavedChartWithData(
    chartId: string,
    userId: string,
    jwtToken: string,
    queryOverrides?: RegenerateChartQueryDto,
  ) {
    const savedChart = await this.savedChartRepository.findByIdAndUserId(chartId, userId);
    if (!savedChart) {
      throw new NotFoundError(`Saved chart with ID ${chartId} not found`, ErrorCodes.CHART_NOT_FOUND);
    }

    // Merge saved configuration with query overrides
    const chartConfig = {
      resourceType: savedChart.resourceType,
      aggregationType: savedChart.aggregationType,
      from: queryOverrides?.from ?? savedChart.from,
      to: queryOverrides?.to ?? savedChart.to,
      status: queryOverrides?.status ?? savedChart.status,
      currency: queryOverrides?.currency ?? savedChart.currency,
      channel: queryOverrides?.channel ?? savedChart.channel,
    };

    if (queryOverrides && Object.keys(queryOverrides).length > 0) {
      this.validateChartConfiguration(chartConfig as SaveChartDto);
    }

    // Generate cache key from merged configuration
    const cacheKey = generateCacheKey({
      chartId,
      resourceType: chartConfig.resourceType,
      aggregationType: chartConfig.aggregationType,
      from: chartConfig.from,
      to: chartConfig.to,
      status: chartConfig.status,
      currency: chartConfig.currency,
      channel: chartConfig.channel,
    });

    // Try to get from cache
    try {
      const cachedData = await this.cacheManager.get<CachedChartData>(cacheKey);
      if (cachedData) {
        this.logger.log(`Cache hit for chart ${chartId} (key: ${cacheKey})`);

        // Combine saved chart metadata with cached data
        const response = SavedChartResponseDto.fromEntity(savedChart) as SavedChartWithDataResponseDto;
        response.label = cachedData.label;
        response.chartType = cachedData.chartType;
        response.chartData = cachedData.chartData;
        response.chartSeries = cachedData.chartSeries;
        response.summary = cachedData.summary;
        response.message = cachedData.message;

        return response;
      }

      this.logger.log(`Cache miss for chart ${chartId} (key: ${cacheKey})`);
    } catch (error) {
      // Log cache errors but continue with generation (graceful degradation)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Cache retrieval error for chart ${chartId}: ${errorMessage}`, errorStack);
    }

    // Cache miss or error - generate chart data
    const generator = generateChartData(chartConfig, this.paystackApiService, jwtToken);

    // Consume the generator to get the final result
    let finalResult: ChartGenerationState | undefined;
    for await (const state of generator) {
      finalResult = state;
    }

    if (finalResult && 'error' in finalResult) {
      throw new ValidationError(finalResult.error, ErrorCodes.INVALID_PARAMS);
    }

    if (finalResult && 'success' in finalResult) {
      // Store in cache (fire-and-forget)
      const dataToCache: CachedChartData = {
        label: finalResult.label,
        chartType: finalResult.chartType,
        chartData: finalResult.chartData,
        chartSeries: finalResult.chartSeries,
        summary: finalResult.summary,
        message: finalResult.message,
      };

      try {
        await this.cacheManager.set(cacheKey, dataToCache);
        this.logger.log(`Cached chart data for chart ${chartId} (key: ${cacheKey})`);
      } catch (error) {
        // Log cache write errors but don't fail the request
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Cache write error for chart ${chartId}: ${errorMessage}`, errorStack);
      }

      // Combine saved chart metadata with fresh data
      const response = SavedChartResponseDto.fromEntity(savedChart) as SavedChartWithDataResponseDto;
      response.label = finalResult.label;
      response.chartType = finalResult.chartType;
      response.chartData = finalResult.chartData;
      response.chartSeries = finalResult.chartSeries;
      response.summary = finalResult.summary;
      response.message = finalResult.message;

      return response;
    }

    throw new ValidationError('Failed to generate chart data', ErrorCodes.INVALID_PARAMS);
  }

  /**
   * Update saved chart metadata (name and/or description)
   */
  async updateSavedChart(chartId: string, userId: string, dto: UpdateChartDto) {
    if (!dto.name && !dto.description) {
      throw new ValidationError(
        'At least one field (name or description) must be provided',
        ErrorCodes.MISSING_REQUIRED_FIELD,
      );
    }

    const updatedChart = await this.savedChartRepository.updateSavedChart(chartId, userId, dto);

    if (!updatedChart) {
      throw new NotFoundError(`Saved chart with ID ${chartId} not found`, ErrorCodes.CHART_NOT_FOUND);
    }

    return SavedChartResponseDto.fromEntity(updatedChart);
  }

  /**
   * Delete a saved chart
   * Cached data will expire via TTL (3 hours)
   */
  async deleteSavedChart(chartId: string, userId: string) {
    const deleted = await this.savedChartRepository.deleteByIdForUser(chartId, userId);
    if (!deleted) {
      throw new NotFoundError(`Saved chart with ID ${chartId} not found`, ErrorCodes.CHART_NOT_FOUND);
    }

    // Note: Cached data will expire via TTL
    // Pattern-based cache invalidation would require direct Redis access
    this.logger.log(`Chart ${chartId} deleted - cached data will expire via TTL`);
  }

  /**
   * Validate chart configuration
   */
  private validateChartConfiguration(dto: SaveChartDto) {
    const validation = validateChartParams({
      resourceType: dto.resourceType,
      aggregationType: dto.aggregationType,
      status: dto.status,
      from: dto.from,
      to: dto.to,
      channel: dto.channel,
    });

    if (!validation.isValid) {
      const { error, code } = validation;

      throw new ValidationError(error, code);
    }
  }
}
