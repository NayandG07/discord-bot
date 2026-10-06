import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma/prisma.service';
import { LeetCodeService } from '../modules/leetcode/leetcode.service';
import { ActivityService } from '../modules/activity/activity.service';
import { RedisService } from '../common/redis/redis.service';
import { createLeetCodeSyncWorker } from './leetcode-sync.worker';
import { Queue } from 'bullmq';

async function bootstrapWorkers() {
  const logger = new Logger('MainWorkerBootstrap');
  logger.log('Bootstrapping DevGuild BullMQ Workers runtime...');

  const app = await NestFactory.createApplicationContext(AppModule);

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

  // Launch Workers
  createLeetCodeSyncWorker(prisma, leetcode, activity, connection);

  // Initialize Repeatable Scheduled Crons
  const syncQueue = new Queue('leetcode-sync-queue', { connection });
  await syncQueue.add(
    'poll-all-active-users',
    {},
    {
      repeat: {
        pattern: '*/15 * * * *', // every 15 minutes
      },
    },
  );

  logger.log('All DevGuild background workers and repeatable crons initialized.');
}

bootstrapWorkers().catch((err) => {
  console.error('Fatal error in worker bootstrap:', err);
  process.exit(1);
});
