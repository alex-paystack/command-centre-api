/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { SavedChartService } from './saved-chart.service';
import { NotFoundError, ValidationError } from '~/common';
import { SavedChartRepository } from './repositories/saved-chart.repository';
import { PaystackApiService } from '~/common/services/paystack-api.service';
import { SavedChart } from './entities/saved-chart.entity';
import { SaveChartDto } from './dto/save-chart.dto';
import { UpdateChartDto } from './dto/update-chart.dto';
import { ChartResourceType, AggregationType } from '~/common/ai/utilities/chart-config';
import { ChartCacheService } from './chart-cache.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

jest.mock('~/common/ai/utilities/chart-generator', () => ({
  generateChartData: jest.fn(),
}));

import { generateChartData } from '~/common/ai/utilities/chart-generator';

describe('SavedChartService', () => {
  let service: SavedChartService;
  let savedChartRepository: jest.Mocked<SavedChartRepository>;
  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockSavedChart: SavedChart = {
    _id: {} as SavedChart['_id'],
    id: 'chart-123',
    createdFromConversationId: 'conv-123',
    userId: 'user-123',
    name: 'Test Chart',
    description: 'Test Description',
    resourceType: ChartResourceType.TRANSACTION,
    aggregationType: AggregationType.BY_DAY,
    from: '2024-01-01',
    to: '2024-01-31',
    status: 'success',
    currency: 'NGN',
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: jest.fn(),
  };

  beforeEach(async () => {
    const mockSavedChartRepository = {
      createSavedChart: jest.fn(),
      findAllByUserId: jest.fn(),
      findByIdAndUserId: jest.fn(),
      updateSavedChart: jest.fn(),
      deleteByIdForUser: jest.fn(),
      findByNameForUser: jest.fn(),
    };

    const mockPaystackApiService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedChartService,
        ChartCacheService,
        {
          provide: SavedChartRepository,
          useValue: mockSavedChartRepository,
        },
        {
          provide: PaystackApiService,
          useValue: mockPaystackApiService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<SavedChartService>(SavedChartService);
    savedChartRepository = module.get(SavedChartRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveChart', () => {
    const saveChartDto: SaveChartDto = {
      name: 'Test Chart',
      description: 'Test Description',
      createdFromConversationId: 'conv-123',
      resourceType: ChartResourceType.TRANSACTION,
      aggregationType: AggregationType.BY_DAY,
      from: '2024-01-01',
      to: '2024-01-31',
      status: 'success',
      currency: 'NGN',
    };

    it('should save a chart successfully', async () => {
      savedChartRepository.findByNameForUser.mockResolvedValue(null);
      savedChartRepository.createSavedChart.mockResolvedValue(mockSavedChart);

      const result = await service.saveChart(saveChartDto, 'user-123');

      expect(savedChartRepository.createSavedChart).toHaveBeenCalledWith({
        userId: 'user-123',
        createdFromConversationId: 'conv-123',
        name: saveChartDto.name,
        description: saveChartDto.description,
        resourceType: saveChartDto.resourceType,
        aggregationType: saveChartDto.aggregationType,
        from: saveChartDto.from,
        to: saveChartDto.to,
        status: saveChartDto.status,
        currency: saveChartDto.currency,
      });
      expect(result).toEqual(expect.objectContaining({ id: 'chart-123', name: 'Test Chart' }));
    });

    it('should throw ValidationError when name already exists for user', async () => {
      savedChartRepository.findByNameForUser.mockResolvedValue(mockSavedChart);

      await expect(service.saveChart(saveChartDto, 'user-123')).rejects.toThrow(ValidationError);
      expect(savedChartRepository.createSavedChart).not.toHaveBeenCalled();
    });

    it('should save a chart without conversation reference', async () => {
      savedChartRepository.findByNameForUser.mockResolvedValue(null);
      const dtoWithoutConversation = { ...saveChartDto };
      delete dtoWithoutConversation.createdFromConversationId;

      const chartWithoutConversation = {
        ...mockSavedChart,
        createdFromConversationId: undefined,
        generateId: jest.fn(),
      };
      savedChartRepository.createSavedChart.mockResolvedValue(chartWithoutConversation);

      const result = await service.saveChart(dtoWithoutConversation, 'user-123');

      expect(savedChartRepository.createSavedChart).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          name: dtoWithoutConversation.name,
        }),
      );
      expect(result.createdFromConversationId).toBeUndefined();
    });

    it('should throw ValidationError for invalid aggregation type', async () => {
      savedChartRepository.findByNameForUser.mockResolvedValue(null);
      const invalidDto = {
        ...saveChartDto,
        aggregationType: AggregationType.BY_TYPE, // Invalid for transactions
      };

      await expect(service.saveChart(invalidDto, 'user-123')).rejects.toThrow(ValidationError);
      expect(savedChartRepository.createSavedChart).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid status', async () => {
      savedChartRepository.findByNameForUser.mockResolvedValue(null);
      const invalidDto = {
        ...saveChartDto,
        status: 'invalid-status',
      };

      await expect(service.saveChart(invalidDto, 'user-123')).rejects.toThrow(ValidationError);
      expect(savedChartRepository.createSavedChart).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for date range exceeding 30 days', async () => {
      savedChartRepository.findByNameForUser.mockResolvedValue(null);
      const invalidDto = {
        ...saveChartDto,
        from: '2024-01-01',
        to: '2024-02-15', // More than 30 days
      };

      await expect(service.saveChart(invalidDto, 'user-123')).rejects.toThrow(ValidationError);
      expect(savedChartRepository.createSavedChart).not.toHaveBeenCalled();
    });
  });

  describe('getAllSavedCharts', () => {
    it('should return all saved charts for a user', async () => {
      savedChartRepository.findAllByUserId.mockResolvedValue([mockSavedChart]);

      const result = await service.getAllSavedCharts('user-123');

      expect(savedChartRepository.findAllByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({ id: 'chart-123' }));
    });

    it('should return empty array if no charts exist', async () => {
      savedChartRepository.findAllByUserId.mockResolvedValue([]);

      const result = await service.getAllSavedCharts('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('getSavedChartWithData', () => {
    const mockChartData = {
      success: true,
      label: 'Daily Transaction Metrics',
      chartType: 'area',
      chartData: [],
      chartSeries: [],
      summary: {
        totalCount: 100,
        totalVolume: 1000000,
        overallAverage: 10000,
      },
      message: 'Generated chart data',
    };

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/require-await
      (generateChartData as jest.Mock).mockImplementation(async function* () {
        yield mockChartData;
      });
    });

    it('should return saved chart with fresh data', async () => {
      savedChartRepository.findByIdAndUserId.mockResolvedValue(mockSavedChart);

      const result = await service.getSavedChartWithData('chart-123', 'user-123', 'jwt-token');

      expect(savedChartRepository.findByIdAndUserId).toHaveBeenCalledWith('chart-123', 'user-123');
      expect(generateChartData).toHaveBeenCalled();
      expect(result.id).toBe('chart-123');
      expect(result.config?.resourceType).toBe(mockSavedChart.resourceType);
      expect(result.config?.aggregationType).toBe(mockSavedChart.aggregationType);
      expect(result.generated?.label).toBe('Daily Transaction Metrics');
      expect(result.generated?.chartType).toBe('area');
    });

    it('should throw NotFoundError if chart does not exist', async () => {
      savedChartRepository.findByIdAndUserId.mockResolvedValue(null);

      await expect(service.getSavedChartWithData('chart-123', 'user-123', 'jwt-token')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if chart generation fails', async () => {
      savedChartRepository.findByIdAndUserId.mockResolvedValue(mockSavedChart);

      // eslint-disable-next-line @typescript-eslint/require-await
      (generateChartData as jest.Mock).mockImplementation(async function* () {
        yield { error: 'Failed to generate chart data' };
      });

      await expect(service.getSavedChartWithData('chart-123', 'user-123', 'jwt-token')).rejects.toThrow(
        ValidationError,
      );
    });

    it('should override filter parameters with query overrides', async () => {
      savedChartRepository.findByIdAndUserId.mockResolvedValue(mockSavedChart);

      const queryOverrides = {
        from: '2024-02-01',
        to: '2024-02-29',
        status: 'failed',
        currency: 'USD',
      };

      await service.getSavedChartWithData('chart-123', 'user-123', 'jwt-token', queryOverrides);

      expect(generateChartData).toHaveBeenCalledWith(
        {
          resourceType: mockSavedChart.resourceType,
          aggregationType: mockSavedChart.aggregationType,
          from: '2024-02-01',
          to: '2024-02-29',
          status: 'failed',
          currency: 'USD',
          channel: mockSavedChart.channel,
        },
        expect.anything(),
        'jwt-token',
      );
    });

    it('should keep resourceType and aggregationType immutable with query overrides', async () => {
      savedChartRepository.findByIdAndUserId.mockResolvedValue(mockSavedChart);

      const queryOverrides = {
        from: '2024-03-01',
        to: '2024-03-31',
        resourceType: ChartResourceType.REFUND,
        aggregationType: AggregationType.BY_WEEK,
      };

      await service.getSavedChartWithData('chart-123', 'user-123', 'jwt-token', queryOverrides);

      expect(generateChartData).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: mockSavedChart.resourceType,
          aggregationType: mockSavedChart.aggregationType,
          from: '2024-03-01',
          to: '2024-03-31',
        }),
        expect.anything(),
        'jwt-token',
      );
    });

    it('should partially override filter parameters', async () => {
      savedChartRepository.findByIdAndUserId.mockResolvedValue(mockSavedChart);

      const queryOverrides = {
        status: 'abandoned',
      };

      await service.getSavedChartWithData('chart-123', 'user-123', 'jwt-token', queryOverrides);

      expect(generateChartData).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: mockSavedChart.resourceType,
          aggregationType: mockSavedChart.aggregationType,
          from: mockSavedChart.from,
          to: mockSavedChart.to,
          status: 'abandoned',
          currency: mockSavedChart.currency,
        }),
        expect.anything(),
        'jwt-token',
      );
    });

    it('should validate overridden configuration', async () => {
      savedChartRepository.findByIdAndUserId.mockResolvedValue(mockSavedChart);

      const queryOverrides = {
        from: '2024-01-01',
        to: '2024-12-31', // More than 30 days
      };

      await expect(service.getSavedChartWithData('chart-123', 'user-123', 'jwt-token', queryOverrides)).rejects.toThrow(
        ValidationError,
      );
    });

    it('should validate invalid status with query overrides', async () => {
      savedChartRepository.findByIdAndUserId.mockResolvedValue(mockSavedChart);

      const queryOverrides = {
        status: 'invalid-status',
      };

      await expect(service.getSavedChartWithData('chart-123', 'user-123', 'jwt-token', queryOverrides)).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('updateSavedChart', () => {
    const updateDto: UpdateChartDto = {
      name: 'Updated Chart Name',
      description: 'Updated Description',
    };

    it('should update chart metadata successfully', async () => {
      const updatedChart = { ...mockSavedChart, ...updateDto, generateId: jest.fn() };
      savedChartRepository.updateSavedChart.mockResolvedValue(updatedChart);

      const result = await service.updateSavedChart('chart-123', 'user-123', updateDto);

      expect(savedChartRepository.updateSavedChart).toHaveBeenCalledWith('chart-123', 'user-123', updateDto);
      expect(result).toEqual(expect.objectContaining({ name: 'Updated Chart Name' }));
    });

    it('should throw ValidationError if no fields provided', async () => {
      await expect(service.updateSavedChart('chart-123', 'user-123', {})).rejects.toThrow(ValidationError);
      expect(savedChartRepository.updateSavedChart).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError if chart does not exist', async () => {
      savedChartRepository.updateSavedChart.mockResolvedValue(null);

      await expect(service.updateSavedChart('chart-123', 'user-123', updateDto)).rejects.toThrow(NotFoundError);
    });

    it('should update only name if description not provided', async () => {
      const nameOnlyDto = { name: 'New Name' };
      const updatedChart = { ...mockSavedChart, name: 'New Name', generateId: jest.fn() };
      savedChartRepository.updateSavedChart.mockResolvedValue(updatedChart);

      const result = await service.updateSavedChart('chart-123', 'user-123', nameOnlyDto);

      expect(result).toEqual(expect.objectContaining({ name: 'New Name' }));
    });
  });

  describe('deleteSavedChart', () => {
    it('should delete a chart successfully', async () => {
      savedChartRepository.deleteByIdForUser.mockResolvedValue(true);

      await service.deleteSavedChart('chart-123', 'user-123');

      expect(savedChartRepository.deleteByIdForUser).toHaveBeenCalledWith('chart-123', 'user-123');
    });

    it('should throw NotFoundError if chart does not exist', async () => {
      savedChartRepository.deleteByIdForUser.mockResolvedValue(false);

      await expect(service.deleteSavedChart('chart-123', 'user-123')).rejects.toThrow(NotFoundError);
    });
  });
});
