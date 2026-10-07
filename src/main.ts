import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('DevGuildBootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('DevGuild REST API')
    .setDescription(
      'Enterprise REST API documentation for DevGuild — Discord-native competitive LeetCode community platform.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('LeetCode')
    .addTag('Activities')
    .addTag('XP & Anti-Farming')
    .addTag('Challenges')
    .addTag('Contests & Boss Battles')
    .addTag('Achievements')
    .addTag('Leaderboards')
    .addTag('Recaps')
    .addTag('Seasons')
    .addTag('Teams')
    .addTag('Admin Panel')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`DevGuild REST API is running on http://0.0.0.0:${port}/api/v1`);
  logger.log(`Swagger OpenAPI Documentation available at http://localhost:${port}/docs`);

  // If COMBINED_MODE is enabled (default for single-instance free hosting like Render or Koyeb),
  // initialize background BullMQ workers and repeatable cron tasks inside the same process.
  const isCombined = process.env.COMBINED_MODE !== 'false';
  if (isCombined) {
    try {
      const { PrismaService } = await import('./common/prisma/prisma.service');
      const { LeetCodeService } = await import('./modules/leetcode/leetcode.service');
      const { ActivityService } = await import('./modules/activity/activity.service');
      const { DiscordService } = await import('./modules/discord/discord.service');
      const { RedisService } = await import('./common/redis/redis.service');
      const { createLeetCodeSyncWorker } = await import('./workers/leetcode-sync.worker');
      const { Queue } = await import('bullmq');

      const prisma = app.get(PrismaService);
      const leetcode = app.get(LeetCodeService);
      const activity = app.get(ActivityService);
      const discord = app.get(DiscordService);
      const redisService = app.get(RedisService);
      const redisClient = redisService.getClient();

      const connection = {
        host: redisClient.options.host || 'localhost',
        port: redisClient.options.port || 6379,
        password: redisClient.options.password,
      };

      createLeetCodeSyncWorker(prisma, leetcode, activity, connection, discord);

      const syncQueue = new Queue('leetcode-sync-queue', { connection });

      // Remove ALL stale repeatable jobs before re-registering to prevent duplicates on restart
      const existingRepeatableJobs = await syncQueue.getRepeatableJobs();
      for (const job of existingRepeatableJobs) {
        await syncQueue.removeRepeatableByKey(job.key);
        logger.log(`Removed stale repeatable job: ${job.name} (key: ${job.key})`);
      }

      await syncQueue.add(
        'poll-all-active-users',
        {},
        {
          repeat: {
            pattern: '*/5 * * * *', // Poll every 5 minutes
          },
        },
      );
      await syncQueue.add(
        'broadcast-daily-recaps',
        {},
        {
          repeat: {
            pattern: '0 0 * * *', // Midnight UTC daily recap
          },
        },
      );
      logger.log('COMBINED_MODE active: In-process BullMQ workers and scheduled crons initialized successfully.');
    } catch (workerErr: any) {
      logger.warn(`Could not initialize in-process BullMQ worker: ${workerErr.message}`);
    }
  }
}

process.on('unhandledRejection', (reason: any) => {
  console.error('[Process] Unhandled Rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err: any) => {
  console.error('[Process] Uncaught Exception:', err?.message || err);
});

bootstrap().catch((err) => {
  console.error('Fatal error during application startup:', err);
  process.exit(1);
});
