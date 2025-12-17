/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, NotFoundException, BadRequestException } from '@nestjs/common';
import { ChartsController } from './charts.controller';
import { SavedChartService } from './saved-chart.service';
import { SaveChartDto } from './dto/save-chart.dto';
import { UpdateChartDto } from './dto/update-chart.dto';
import { SavedChartResponseDto } from './dto/saved-chart-response.dto';
import { SavedChartWithDataResponseDto } from './dto/saved-chart-with-data-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChartResourceType, AggregationType } from '~/common/ai/chart-config';

describe('ChartsController', () => {
  let controller: ChartsController;
  let savedChartService: jest.Mocked<SavedChartService>;

  const mockUserId = 'user_123';
  const mockChartId = 'chart_123';

  const mockSavedChartResponse: SavedChartResponseDto = {
    id: mockChartId,
    createdFromConversationId: 'conv_123',
    name: 'Test Chart',
    description: 'Test Description',
    resourceType: ChartResourceType.TRANSACTION,
    aggregationType: AggregationType.BY_DAY,
    from: '2024-01-01',
    to: '2024-01-31',
    status: 'success',
    currency: 'NGN',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockSavedChartWithData: SavedChartWithDataResponseDto = {
    ...mockSavedChartResponse,
    label: 'Daily Transaction Metrics',
    chartType: 'area',
    chartSeries: [
      {
        currency: 'NGN',
        points: [{ name: 'Monday, Jan 1', count: 100, volume: 1000000, average: 10000, currency: 'NGN' }],
      },
    ],
    summary: {
      totalCount: 100,
      totalVolume: 1000000,
      overallAverage: 10000,
    },
    message: 'Generated chart data with 31 data points from 100 transactions',
  };

  beforeEach(async () => {
    const mockSavedChartService = {
      saveChart: jest.fn(),
      getAllSavedCharts: jest.fn(),
      getSavedChartWithData: jest.fn(),
      updateSavedChart: jest.fn(),
      deleteSavedChart: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChartsController],
      providers: [
        {
          provide: SavedChartService,
          useValue: mockSavedChartService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest<{ user?: { userId: string } }>();
          request.user = { userId: mockUserId };
          return true;
        },
      })
      .compile();

    controller = module.get<ChartsController>(ChartsController);
    savedChartService = module.get(SavedChartService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /charts', () => {
    const saveChartDto: SaveChartDto = {
      name: 'Test Chart',
      description: 'Test Description',
      createdFromConversationId: 'conv_123',
      resourceType: ChartResourceType.TRANSACTION,
      aggregationType: AggregationType.BY_DAY,
      from: '2024-01-01',
      to: '2024-01-31',
      status: 'success',
      currency: 'NGN',
    };

    it('should save a chart successfully', async () => {
      savedChartService.saveChart.mockResolvedValue(mockSavedChartResponse);

      const result = await controller.createSavedChart(saveChartDto, mockUserId);

      expect(savedChartService.saveChart).toHaveBeenCalledWith(saveChartDto, mockUserId);
      expect(result).toEqual({
        status: true,
        message: 'Chart saved successfully',
        data: mockSavedChartResponse,
      });
    });

    it('should save a chart without conversation reference', async () => {
      const dtoWithoutConversation = { ...saveChartDto };
      delete dtoWithoutConversation.createdFromConversationId;

      const responseWithoutConversation = { ...mockSavedChartResponse, createdFromConversationId: undefined };
      savedChartService.saveChart.mockResolvedValue(responseWithoutConversation);

      const result = await controller.createSavedChart(dtoWithoutConversation, mockUserId);

      expect(savedChartService.saveChart).toHaveBeenCalledWith(dtoWithoutConversation, mockUserId);
      expect(result.data.createdFromConversationId).toBeUndefined();
    });

    it('should throw BadRequestException for invalid chart configuration', async () => {
      savedChartService.saveChart.mockRejectedValue(new BadRequestException('Invalid aggregation type'));

      await expect(controller.createSavedChart(saveChartDto, mockUserId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /charts', () => {
    it('should return all saved charts for the authenticated user', async () => {
      const charts = [mockSavedChartResponse];
      savedChartService.getAllSavedCharts.mockResolvedValue(charts);

      const result = await controller.getAllSavedCharts(mockUserId);

      expect(savedChartService.getAllSavedCharts).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual({
        status: true,
        message: 'Saved charts retrieved successfully',
        data: charts,
      });
    });

    it('should return empty array if no charts exist', async () => {
      savedChartService.getAllSavedCharts.mockResolvedValue([]);

      const result = await controller.getAllSavedCharts(mockUserId);

      expect(result.data).toEqual([]);
    });
  });

  describe('GET /charts/:id', () => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer jwt-token',
      },
    } as never;

    it('should return saved chart with fresh data', async () => {
      savedChartService.getSavedChartWithData.mockResolvedValue(mockSavedChartWithData);

      const result = await controller.getSavedChartWithData(mockChartId, {}, mockUserId, mockRequest);

      expect(savedChartService.getSavedChartWithData).toHaveBeenCalledWith(mockChartId, mockUserId, 'jwt-token', {});
      expect(result).toEqual({
        status: true,
        message: 'Chart data retrieved successfully',
        data: mockSavedChartWithData,
      });
    });

    it('should return saved chart with fresh data and query parameter overrides', async () => {
      savedChartService.getSavedChartWithData.mockResolvedValue(mockSavedChartWithData);

      const queryOverrides = {
        from: '2024-02-01',
        to: '2024-02-29',
        status: 'failed',
        currency: 'USD',
      };

      const result = await controller.getSavedChartWithData(mockChartId, queryOverrides, mockUserId, mockRequest);

      expect(savedChartService.getSavedChartWithData).toHaveBeenCalledWith(
        mockChartId,
        mockUserId,
        'jwt-token',
        queryOverrides,
      );
      expect(result).toEqual({
        status: true,
        message: 'Chart data retrieved successfully',
        data: mockSavedChartWithData,
      });
    });

    it('should return saved chart with partial query parameter overrides', async () => {
      savedChartService.getSavedChartWithData.mockResolvedValue(mockSavedChartWithData);

      const queryOverrides = {
        from: '2024-03-01',
        to: '2024-03-31',
      };

      const result = await controller.getSavedChartWithData(mockChartId, queryOverrides, mockUserId, mockRequest);

      expect(savedChartService.getSavedChartWithData).toHaveBeenCalledWith(
        mockChartId,
        mockUserId,
        'jwt-token',
        queryOverrides,
      );
      expect(result.status).toBe(true);
    });

    it('should throw UnauthorizedException if authorization header is missing', async () => {
      const requestWithoutAuth = {
        headers: {},
      } as never;

      await expect(controller.getSavedChartWithData(mockChartId, {}, mockUserId, requestWithoutAuth)).rejects.toThrow(
        'Authorization header missing or malformed',
      );
    });

    it('should throw UnauthorizedException if authorization header is malformed', async () => {
      const requestWithMalformedAuth = {
        headers: {
          authorization: 'InvalidFormat jwt-token',
        },
      } as never;

      await expect(
        controller.getSavedChartWithData(mockChartId, {}, mockUserId, requestWithMalformedAuth),
      ).rejects.toThrow('Authorization header missing or malformed');
    });

    it('should throw NotFoundException if chart does not exist', async () => {
      savedChartService.getSavedChartWithData.mockRejectedValue(new NotFoundException('Chart not found'));

      await expect(controller.getSavedChartWithData(mockChartId, {}, mockUserId, mockRequest)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if chart data generation fails', async () => {
      savedChartService.getSavedChartWithData.mockRejectedValue(
        new BadRequestException('Failed to generate chart data'),
      );

      await expect(controller.getSavedChartWithData(mockChartId, {}, mockUserId, mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('PUT /charts/:id', () => {
    const updateDto: UpdateChartDto = {
      name: 'Updated Chart Name',
      description: 'Updated Description',
    };

    it('should update chart metadata successfully', async () => {
      const updatedChart = { ...mockSavedChartResponse, ...updateDto };
      savedChartService.updateSavedChart.mockResolvedValue(updatedChart);

      const result = await controller.updateSavedChart(mockChartId, updateDto, mockUserId);

      expect(savedChartService.updateSavedChart).toHaveBeenCalledWith(mockChartId, mockUserId, updateDto);
      expect(result).toEqual({
        status: true,
        message: 'Chart updated successfully',
        data: updatedChart,
      });
    });

    it('should update only name if description not provided', async () => {
      const nameOnlyDto = { name: 'New Name' };
      const updatedChart = { ...mockSavedChartResponse, name: 'New Name' };
      savedChartService.updateSavedChart.mockResolvedValue(updatedChart);

      const result = await controller.updateSavedChart(mockChartId, nameOnlyDto, mockUserId);

      expect(result.data).toEqual(expect.objectContaining({ name: 'New Name' }));
    });

    it('should throw BadRequestException if no fields provided', async () => {
      savedChartService.updateSavedChart.mockRejectedValue(
        new BadRequestException('At least one field must be provided'),
      );

      await expect(controller.updateSavedChart(mockChartId, {}, mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if chart does not exist', async () => {
      savedChartService.updateSavedChart.mockRejectedValue(new NotFoundException('Chart not found'));

      await expect(controller.updateSavedChart(mockChartId, updateDto, mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('DELETE /charts/:id', () => {
    it('should delete a chart successfully', async () => {
      savedChartService.deleteSavedChart.mockResolvedValue();

      const result = await controller.deleteSavedChart(mockChartId, mockUserId);

      expect(savedChartService.deleteSavedChart).toHaveBeenCalledWith(mockChartId, mockUserId);
      expect(result).toEqual({
        status: true,
        message: 'Chart deleted successfully',
        data: null,
      });
    });

    it('should throw NotFoundException if chart does not exist', async () => {
      savedChartService.deleteSavedChart.mockRejectedValue(new NotFoundException('Chart not found'));

      await expect(controller.deleteSavedChart(mockChartId, mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Authorization', () => {
    it('should only allow users to access their own charts', async () => {
      const otherUserId = 'other_user';
      savedChartService.getAllSavedCharts.mockResolvedValue([]);

      const result = await controller.getAllSavedCharts(otherUserId);

      expect(savedChartService.getAllSavedCharts).toHaveBeenCalledWith(otherUserId);
      expect(result.data).toEqual([]);
    });

    it("should prevent users from updating charts they don't own", async () => {
      const updateDto = { name: 'Hacked Name' };
      savedChartService.updateSavedChart.mockRejectedValue(new NotFoundException('Chart not found'));

      await expect(controller.updateSavedChart(mockChartId, updateDto, 'other_user')).rejects.toThrow();
    });
  });
});
