import { Module } from '@nestjs/common';
import { GoalService } from './goal.service';
import { ReliabilityModule } from '../reliability/reliability.module';

@Module({
  imports: [ReliabilityModule],
  providers: [GoalService],
  exports: [GoalService],
})
export class GoalModule {}
