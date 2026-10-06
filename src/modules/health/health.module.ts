import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DiscordModule } from '../discord/discord.module';

@Module({
  imports: [DiscordModule],
  controllers: [HealthController],
})
export class HealthModule {}
