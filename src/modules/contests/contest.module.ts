import { Module } from '@nestjs/common';
import { ContestService } from './contest.service';
import { ContestController } from './contest.controller';
import { LeetCodeModule } from '../leetcode/leetcode.module';

@Module({
  imports: [LeetCodeModule],
  controllers: [ContestController],
  providers: [ContestService],
  exports: [ContestService],
})
export class ContestModule {}
