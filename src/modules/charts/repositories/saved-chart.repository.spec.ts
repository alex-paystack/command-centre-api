/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { SavedChartRepository } from './saved-chart.repository';
import { SavedChart } from '../entities/saved-chart.entity';
import { ChartResourceType, AggregationType } from '~/common/ai/chart-config';

describe('SavedChartRepository', () => {
  let repository: SavedChartRepository;
  let dataSource: jest.Mocked<DataSource>;
  let entityManager: jest.Mocked<EntityManager>;

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
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    generateId: jest.fn(),
  };

  beforeEach(async () => {
    entityManager = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      countBy: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    dataSource = {
      createEntityManager: jest.fn().mockReturnValue(entityManager),
    } as unknown as jest.Mocked<DataSource>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedChartRepository,
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    repository = module.get<SavedChartRepository>(SavedChartRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should find a chart by ID', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockSavedChart);

      const result = await repository.findById('chart-123');

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'chart-123' });
      expect(result).toEqual(mockSavedChart);
    });

    it('should return null if chart not found', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdAndUserId', () => {
    it('should find a chart by ID and userId', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockSavedChart);

      const result = await repository.findByIdAndUserId('chart-123', 'user-123');

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'chart-123', userId: 'user-123' });
      expect(result).toEqual(mockSavedChart);
    });

    it('should return null if chart does not belong to user', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(null);

      const result = await repository.findByIdAndUserId('chart-123', 'other-user');

      expect(result).toBeNull();
    });
  });

  describe('findAllByUserId', () => {
    it('should find all charts for a user', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([mockSavedChart]);

      const result = await repository.findAllByUserId('user-123');

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockSavedChart]);
    });

    it('should return empty array if no charts exist', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([]);

      const result = await repository.findAllByUserId('user-123');

      expect(result).toEqual([]);
    });

    it('should order charts by creation date descending', async () => {
      const chart1 = { ...mockSavedChart, id: 'chart-1', createdAt: new Date('2024-01-01'), generateId: jest.fn() };
      const chart2 = { ...mockSavedChart, id: 'chart-2', createdAt: new Date('2024-01-02'), generateId: jest.fn() };
      jest.spyOn(repository, 'find').mockResolvedValue([chart2, chart1]);

      const result = await repository.findAllByUserId('user-123');

      expect(result[0].id).toBe('chart-2'); // Most recent first
    });
  });

  describe('createSavedChart', () => {
    it('should create a new saved chart', async () => {
      jest.spyOn(repository, 'create').mockReturnValue(mockSavedChart);
      jest.spyOn(repository, 'save').mockResolvedValue(mockSavedChart);

      const chartData = {
        userId: 'user-123',
        name: 'Test Chart',
        resourceType: ChartResourceType.TRANSACTION,
        aggregationType: AggregationType.BY_DAY,
      };

      const result = await repository.createSavedChart(chartData);

      expect(repository.create).toHaveBeenCalledWith(chartData);
      expect(repository.save).toHaveBeenCalledWith(mockSavedChart);
      expect(result).toEqual(mockSavedChart);
    });

    it('should create a chart with optional conversation reference', async () => {
      const chartWithConversation = { ...mockSavedChart, createdFromConversationId: 'conv-123', generateId: jest.fn() };
      jest.spyOn(repository, 'create').mockReturnValue(chartWithConversation);
      jest.spyOn(repository, 'save').mockResolvedValue(chartWithConversation);

      const chartData = {
        userId: 'user-123',
        createdFromConversationId: 'conv-123',
        name: 'Test Chart',
        resourceType: ChartResourceType.TRANSACTION,
        aggregationType: AggregationType.BY_DAY,
      };

      const result = await repository.createSavedChart(chartData);

      expect(result.createdFromConversationId).toBe('conv-123');
    });
  });

  describe('updateSavedChart', () => {
    it('should update chart name and description', async () => {
      const updates = { name: 'Updated Name', description: 'Updated Description' };
      const updatedChart = { ...mockSavedChart, ...updates, generateId: jest.fn() };

      jest.spyOn(repository, 'findByIdAndUserId').mockResolvedValue(mockSavedChart);
      jest.spyOn(repository, 'save').mockResolvedValue(updatedChart);

      const result = await repository.updateSavedChart('chart-123', 'user-123', updates);

      expect(repository.findByIdAndUserId).toHaveBeenCalledWith('chart-123', 'user-123');
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedChart);
    });

    it('should update only name if description not provided', async () => {
      const updates = { name: 'Updated Name' };
      const updatedChart = { ...mockSavedChart, name: 'Updated Name', generateId: jest.fn() };

      jest.spyOn(repository, 'findByIdAndUserId').mockResolvedValue(mockSavedChart);
      jest.spyOn(repository, 'save').mockResolvedValue(updatedChart);

      const result = await repository.updateSavedChart('chart-123', 'user-123', updates);

      expect(result?.name).toBe('Updated Name');
      expect(result?.description).toBe(mockSavedChart.description);
    });

    it('should return null if chart not found', async () => {
      jest.spyOn(repository, 'findByIdAndUserId').mockResolvedValue(null);
      const saveSpy = jest.spyOn(repository, 'save');

      const result = await repository.updateSavedChart('chart-123', 'user-123', { name: 'Updated' });

      expect(result).toBeNull();
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('deleteByIdForUser', () => {
    it('should delete a chart and return true', async () => {
      jest.spyOn(repository, 'deleteMany').mockResolvedValue({ deletedCount: 1 } as never);

      const result = await repository.deleteByIdForUser('chart-123', 'user-123');

      expect(repository.deleteMany).toHaveBeenCalledWith({ id: 'chart-123', userId: 'user-123' });
      expect(result).toBe(true);
    });

    it('should return false if chart not found', async () => {
      jest.spyOn(repository, 'deleteMany').mockResolvedValue({ deletedCount: 0 } as never);

      const result = await repository.deleteByIdForUser('non-existent', 'user-123');

      expect(result).toBe(false);
    });

    it('should return false if chart belongs to different user', async () => {
      jest.spyOn(repository, 'deleteMany').mockResolvedValue({ deletedCount: 0 } as never);

      const result = await repository.deleteByIdForUser('chart-123', 'other-user');

      expect(result).toBe(false);
    });
  });
});
