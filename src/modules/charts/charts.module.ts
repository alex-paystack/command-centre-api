import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChartsController } from './charts.controller';
import { SavedChartService } from './saved-chart.service';
import { SavedChartRepository } from './repositories/saved-chart.repository';
import { SavedChart } from './entities/saved-chart.entity';
import { PaystackModule } from '~/common/services/paystack.module';

@Module({
  imports: [TypeOrmModule.forFeature([SavedChart]), PaystackModule],
  controllers: [ChartsController],
  providers: [SavedChartService, SavedChartRepository],
  exports: [SavedChartService],
})
export class ChartsModule {}
