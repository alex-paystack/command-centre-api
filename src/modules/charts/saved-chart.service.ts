import { Injectable, Logger } from '@nestjs/common';
import { SavedChartRepository } from './repositories/saved-chart.repository';
import { PaystackApiService } from '~/common/services/paystack-api.service';
import { SaveChartDto } from './dto/save-chart.dto';
import { UpdateChartDto } from './dto/update-chart.dto';
import { RegenerateChartQueryDto } from './dto/regenerate-chart-query.dto';
import { SavedChartResponseDto } from './dto/saved-chart-response.dto';
import { SavedChartWithDataResponseDto } from './dto/saved-chart-with-data-response.dto';
import { validateChartParams } from '~/common/ai/utilities/chart-validation';
import { generateChartData, ChartGenerationState } from '~/common/ai/utilities/chart-generator';
import { NotFoundError, ValidationError, ErrorCodes } from '~/common';
import { ChartCacheService } from './chart-cache.service';

@Injectable()
export class SavedChartService {
  private readonly logger = new Logger(SavedChartService.name);
  constructor(
    private readonly savedChartRepository: SavedChartRepository,
    private readonly paystackApiService: PaystackApiService,
    private readonly chartCacheService: ChartCacheService,
  ) {}

  /**
   * Save a new chart configuration
   */
  async saveChart(dto: SaveChartDto, userId: string) {
    this.validateChartConfiguration(dto);

    const existingChartByName = await this.savedChartRepository.findByNameForUser(dto.name, userId);

    if (existingChartByName) {
      throw new ValidationError('A saved chart with this name already exists', ErrorCodes.INVALID_PARAMS);
    }

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
      channel: dto.channel,
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
   * Get a saved chart with fresh data (re-execute chart generation)
   * Query parameters can override saved configuration values
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
    // Only filter parameters (from, to, status, currency) can be overridden
    // resourceType and aggregationType are immutable
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

    const cacheKey = this.chartCacheService.buildCacheKey(chartId, userId, chartConfig);

    const cachedChart = await this.chartCacheService.safeGet<SavedChartWithDataResponseDto>(cacheKey);

    if (cachedChart) {
      this.logger.log(`Cached chart found for key ${cacheKey}`);

      return cachedChart;
    }

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
      // Combine saved chart metadata with fresh data
      const response = SavedChartResponseDto.fromEntity(savedChart) as SavedChartWithDataResponseDto;
      const updatedResponse: SavedChartWithDataResponseDto = {
        ...response,
        generated: {
          label: finalResult.label,
          chartType: finalResult.chartType,
          chartData: finalResult.chartData,
          chartSeries: finalResult.chartSeries,
          summary: finalResult.summary,
          message: finalResult.message,
        },
      };

      this.logger.log(`Caching chart for key ${cacheKey}`);
      await this.chartCacheService.safeSet(cacheKey, updatedResponse);

      return updatedResponse;
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
   */
  async deleteSavedChart(chartId: string, userId: string) {
    const deleted = await this.savedChartRepository.deleteByIdForUser(chartId, userId);
    if (!deleted) {
      throw new NotFoundError(`Saved chart with ID ${chartId} not found`, ErrorCodes.CHART_NOT_FOUND);
    }
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
