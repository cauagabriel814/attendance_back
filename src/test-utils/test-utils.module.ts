import { Module } from '@nestjs/common';
import { TestUtilsController } from './test-utils.controller';

@Module({
  controllers: [TestUtilsController],
})
export class TestUtilsModule {}
