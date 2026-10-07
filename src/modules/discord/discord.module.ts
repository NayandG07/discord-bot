import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscordService } from './discord.service';
import { DiscordInteractionsController } from './discord-interactions.controller';
import { LeetCodeModule } from '../leetcode/leetcode.module';
import { ReliabilityModule } from '../reliability/reliability.module';
import { RecapModule } from '../recaps/recap.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [ConfigModule, LeetCodeModule, ReliabilityModule, RecapModule, ActivityModule],
  controllers: [DiscordInteractionsController],
  providers: [DiscordService],
  exports: [DiscordService],
})
export class DiscordModule {}
