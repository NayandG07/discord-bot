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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`DevGuild REST API is running on http://localhost:${port}/api/v1`);
  logger.log(`Swagger OpenAPI Documentation available at http://localhost:${port}/docs`);

  // If COMBINED_MODE is enabled (default for single-instance free hosting like Render or Koyeb),
  // initialize background BullMQ workers and repeatable cron tasks inside the same process.
  const isCombined = process.env.COMBINED_MODE !== 'false';
  if (isCombined) {
    try {
      const { PrismaService } = await import('./common/prisma/prisma.service');
      const { LeetCodeService } = await import('./modules/leetcode/leetcode.service');
      const { ActivityService } = await import('./modules/activity/activity.service');
      const { RedisService } = await import('./common/redis/redis.service');
      const { createLeetCodeSyncWorker } = await import('./workers/leetcode-sync.worker');
      const { Queue } = await import('bullmq');

      const prisma = app.get(PrismaService);
      const leetcode = app.get(LeetCodeService);
      const activity = app.get(ActivityService);
      const redisService = app.get(RedisService);
      const redisClient = redisService.getClient();

      const connection = {
        host: redisClient.options.host || 'localhost',
        port: redisClient.options.port || 6379,
        password: redisClient.options.password,
      };

      createLeetCodeSyncWorker(prisma, leetcode, activity, connection);

      const syncQueue = new Queue('leetcode-sync-queue', { connection });
      await syncQueue.add(
        'poll-all-active-users',
        {},
        {
          repeat: {
            pattern: '*/15 * * * *',
          },
        },
      );
      logger.log('COMBINED_MODE active: In-process BullMQ workers and scheduled crons initialized successfully.');
    } catch (workerErr: any) {
      logger.warn(`Could not initialize in-process BullMQ worker: ${workerErr.message}`);
    }
  }
}

bootstrap().catch((err) => {
  console.error('Fatal error during application startup:', err);
  process.exit(1);
});
