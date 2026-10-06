import { Module } from '@nestjs/common';
import { LeetCodeService } from './leetcode.service';
import { LeetCodeController } from './leetcode.controller';

@Module({
  controllers: [LeetCodeController],
  providers: [LeetCodeService],
  exports: [LeetCodeService],
})
export class LeetCodeModule {}
