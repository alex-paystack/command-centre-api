import { Injectable } from '@nestjs/common';
import { DataSource, MongoRepository } from 'typeorm';
import { SavedChart } from '../entities/saved-chart.entity';

@Injectable()
export class SavedChartRepository extends MongoRepository<SavedChart> {
  constructor(private dataSource: DataSource) {
    super(SavedChart, dataSource.createEntityManager());
  }

  /**
   * Find a saved chart by its ID
   */
  async findById(id: string) {
    return this.findOneBy({ id });
  }

  /**
   * Find a saved chart by ID and verify ownership
   * This ensures users can only access their own charts
   */
  async findByIdAndUserId(id: string, userId: string) {
    return this.findOneBy({ id, userId });
  }

  /**
   * Find all saved charts for a user
   * Sorted by creation date (newest first)
   */
  async findAllByUserId(userId: string) {
    return this.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Create a new saved chart
   */
  async createSavedChart(data: Partial<SavedChart>) {
    const savedChart = this.create(data);
    return this.save(savedChart);
  }

  /**
   * Find a chart by name for a specific user (case-insensitive)
   */
  async findByNameForUser(name: string, userId: string) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.findOne({
      where: {
        userId,
        name: { $regex: new RegExp(`^${escaped}$`, 'i') },
      },
    });
  }

  /**
   * Update a saved chart's metadata (name and/or description)
   * Only the owner can update
   */
  async updateSavedChart(id: string, userId: string, updates: Partial<Pick<SavedChart, 'name' | 'description'>>) {
    const chart = await this.findByIdAndUserId(id, userId);

    if (!chart) {
      return null;
    }

    if (updates.name) {
      chart.name = updates.name;
    }

    if (updates.description) {
      chart.description = updates.description;
    }

    return this.save(chart);
  }

  /**
   * Delete a saved chart by ID (with ownership verification)
   * Returns true if deleted, false if not found or not owned by user
   */
  async deleteByIdForUser(id: string, userId: string) {
    const result = await this.deleteMany({ id, userId });
    return (result.deletedCount ?? 0) > 0;
  }
}
