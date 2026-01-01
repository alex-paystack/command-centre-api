import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedChartsController } from './saved-charts.controller';
import { SavedChartService } from './saved-chart.service';
import { SavedChartRepository } from './repositories/saved-chart.repository';
import { SavedChart } from './entities/saved-chart.entity';
import { PaystackModule } from '~/common/services/paystack.module';
import { CacheService } from '~/common/services/cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([SavedChart]), PaystackModule],
  controllers: [SavedChartsController],
  providers: [SavedChartService, SavedChartRepository, CacheService],
  exports: [SavedChartService],
})
export class ChartsModule {}
