import { Module } from '@nestjs/common';
import { RecapService } from './recap.service';
import { RecapController } from './recap.controller';

@Module({
  controllers: [RecapController],
  providers: [RecapService],
  exports: [RecapService],
})
export class RecapModule {}
