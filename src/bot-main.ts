import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DiscordService } from './modules/discord/discord.service';

async function bootstrapBot() {
  const logger = new Logger('DiscordBotBootstrap');
  logger.log('Starting standalone DevGuild Discord Bot process...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const discordService = app.get(DiscordService);

  logger.log('DevGuild Discord Bot process running and connected to Gateway.');
}

bootstrapBot().catch((err) => {
  console.error('Fatal error in Discord bot bootstrap:', err);
  process.exit(1);
});
