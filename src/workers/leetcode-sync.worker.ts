import { Worker, Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaClient, ProblemDifficulty } from '@prisma/client';
import { LeetCodeService } from '../modules/leetcode/leetcode.service';
import { ActivityService } from '../modules/activity/activity.service';

export function createLeetCodeSyncWorker(
  prisma: PrismaClient,
  leetcode: LeetCodeService,
  activity: ActivityService,
  connection: any,
) {
  const logger = new Logger('LeetCodeSyncWorker');

  const worker = new Worker(
    'leetcode-sync-queue',
    async (job: Job) => {
      logger.log(`Processing LeetCode sync job: ${job.name} (ID: ${job.id})`);

      if (job.name === 'poll-all-active-users') {
        // Query active verified users
        const verifiedProfiles = await prisma.leetCodeProfile.findMany({
          where: { isVerified: true },
          take: 50,
          orderBy: { lastSyncedAt: 'asc' },
        });

        logger.log(`Found ${verifiedProfiles.length} verified LeetCode profiles to poll.`);

        for (const profile of verifiedProfiles) {
          try {
            const submissions = await leetcode.fetchRecentSubmissions(profile.username, 15);
            const accepted = submissions.filter((s) => s.statusDisplay === 'Accepted');

            for (const sub of accepted) {
              const details = await leetcode.fetchQuestionDetails(sub.titleSlug);
              if (!details) continue;

              const diff = details.difficulty.toUpperCase() as ProblemDifficulty;
              const tags = details.topicTags.map((t) => t.name);

              await activity.ingestSubmission({
                userId: profile.userId,
                leetCodeSubmissionId: sub.id,
                problemTitle: sub.title,
                problemSlug: sub.titleSlug,
                difficulty: diff,
                topicTags: tags,
                submissionTimestamp: new Date(Number(sub.timestamp) * 1000),
              });
            }

            await prisma.leetCodeProfile.update({
              where: { id: profile.id },
              data: { lastSyncedAt: new Date() },
            });
          } catch (err: any) {
            logger.error(`Failed to poll user ${profile.username}: ${err.message}`);
          }
        }
      }
    },
    {
      connection,
      concurrency: 2,
    },
  );

  worker.on('completed', (job) => logger.log(`Job ${job.id} completed.`));
  worker.on('failed', (job, err) => logger.error(`Job ${job?.id} failed: ${err.message}`));

  return worker;
}
