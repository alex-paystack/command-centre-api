import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LangfuseService } from './langfuse.service';

/**
 * Langfuse observability module
 * Provides global LangfuseService for AI tracing and metrics
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [LangfuseService],
  exports: [LangfuseService],
})
export class LangfuseModule {}
