import { Module } from '@nestjs/common';
import { DummyController } from './dummy.controller';

@Module({
  controllers: [DummyController],
})
export class DummyModule {}

