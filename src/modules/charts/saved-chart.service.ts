import { Injectable } from '@nestjs/common';
import { SavedChartRepository } from './repositories/saved-chart.repository';
import { PaystackApiService } from '~/common/services/paystack-api.service';
import { SaveChartDto } from './dto/save-chart.dto';
import { UpdateChartDto } from './dto/update-chart.dto';
import { RegenerateChartQueryDto } from './dto/regenerate-chart-query.dto';
import { SavedChartResponseDto } from './dto/saved-chart-response.dto';
import { SavedChartWithDataResponseDto } from './dto/saved-chart-with-data-response.dto';
import { validateChartParams } from '~/common/ai/chart-validation';
import { generateChartData, ChartGenerationState } from '~/common/ai/chart-generator';
import { NotFoundError, ValidationError, ErrorCodes } from '~/common';

@Injectable()
export class SavedChartService {
  constructor(
    private readonly savedChartRepository: SavedChartRepository,
    private readonly paystackApiService: PaystackApiService,
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

    // TODO: Consider caching the chart data and serving that if the params are the same
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
      // Map common error messages to existing error codes where possible
      const message = validation.error;
      let code = ErrorCodes.INVALID_PARAMS;

      if (message.includes('aggregation type')) {
        code = ErrorCodes.INVALID_AGGREGATION_TYPE;
      } else if (message.includes('status')) {
        code = ErrorCodes.INVALID_STATUS;
      } else if (message.toLowerCase().includes('date')) {
        code = ErrorCodes.INVALID_DATE_RANGE;
      }

      throw new ValidationError(message, code);
    }
  }
}
