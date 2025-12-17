import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PaystackApiService } from './paystack-api.service';

/**
 * Shared module that provides a single PaystackApiService instance.
 * Import this module wherever Paystack API access is required to avoid
 * duplicate providers with separate Http/Config instances.
 */
@Module({
  imports: [ConfigModule, HttpModule],
  providers: [PaystackApiService],
  exports: [PaystackApiService],
})
export class PaystackModule {}
