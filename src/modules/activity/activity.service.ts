import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { XpService } from '../xp/xp.service';
import { IngestSubmissionDto, ActivityCreatedEventPayload } from './activity.types';
import { ProblemDifficulty, TopicCategory } from '@prisma/client';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly xpService: XpService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  classifyPrimaryTopic(tags: string[]): TopicCategory {
    const lowerTags = tags.map((t) => t.toLowerCase());

    if (lowerTags.some((t) => t.includes('array') || t.includes('matrix'))) return TopicCategory.ARRAYS;
    if (lowerTags.some((t) => t.includes('string'))) return TopicCategory.STRINGS;
    if (lowerTags.some((t) => t.includes('tree') || t.includes('binary tree') || t.includes('trie')))
      return TopicCategory.TREES;
    if (lowerTags.some((t) => t.includes('graph') || t.includes('topological') || t.includes('shortest path')))
      return TopicCategory.GRAPHS;
    if (lowerTags.some((t) => t.includes('dynamic programming') || t.includes('dp') || t.includes('memoization')))
      return TopicCategory.DYNAMIC_PROGRAMMING;
    if (lowerTags.some((t) => t.includes('greedy'))) return TopicCategory.GREEDY;
    if (lowerTags.some((t) => t.includes('binary search'))) return TopicCategory.BINARY_SEARCH;
    if (lowerTags.some((t) => t.includes('backtracking'))) return TopicCategory.BACKTRACKING;

    return TopicCategory.OTHER;
  }

  async countRecentEasySolves(userId: string, windowHours = 24): Promise<number> {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    return this.prisma.activity.count({
      where: {
        userId,
        difficulty: ProblemDifficulty.EASY,
        submissionTimestamp: { gte: since },
      },
    });
  }

  calculateUpdatedStreak(lastActiveAt: Date | null, currentStreak: number, submissionDate: Date): number {
    if (!lastActiveAt) return 1;

    const startOfSub = new Date(submissionDate);
    startOfSub.setHours(0, 0, 0, 0);

    const startOfLast = new Date(lastActiveAt);
    startOfLast.setHours(0, 0, 0, 0);

    const diffDays = Math.round((startOfSub.getTime() - startOfLast.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Solved same calendar day
      return currentStreak > 0 ? currentStreak : 1;
    } else if (diffDays === 1) {
      // Solved consecutive day
      return currentStreak + 1;
    } else {
      // Streak lapsed
      return 1;
    }
  }

  async ingestSubmission(dto: IngestSubmissionDto) {
    // 1. Duplicate check (idempotency)
    const existing = await this.prisma.activity.findUnique({
      where: {
        userId_leetCodeSubmissionId: {
          userId: dto.userId,
          leetCodeSubmissionId: dto.leetCodeSubmissionId,
        },
      },
    });

    if (existing) {
      this.logger.debug(`Submission ${dto.leetCodeSubmissionId} already processed for user ${dto.userId}.`);
      return existing;
    }

    const primaryTopic = this.classifyPrimaryTopic(dto.topicTags);

    // 2. Fetch user state for streak & anti-farming calculation
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new Error(`User with ID ${dto.userId} not found.`);
    }

    const easySolves24h = await this.countRecentEasySolves(dto.userId, 24);
    const updatedStreak = this.calculateUpdatedStreak(user.lastActiveAt, user.currentStreak, dto.submissionTimestamp);
    const newLongestStreak = Math.max(updatedStreak, user.longestStreak);

    // 3. Compute XP
    const xpCalc = await this.xpService.calculateProblemSolveXp({
      userId: dto.userId,
      guildId: dto.guildId,
      difficulty: dto.difficulty,
      easySolvesIn24h: easySolves24h,
      currentStreakDays: updatedStreak,
    });

    // 4. Atomic persistence
    const result = await this.prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          userId: dto.userId,
          leetCodeSubmissionId: dto.leetCodeSubmissionId,
          problemTitle: dto.problemTitle,
          problemSlug: dto.problemSlug,
          difficulty: dto.difficulty,
          topicTags: dto.topicTags,
          primaryTopic,
          submissionTimestamp: dto.submissionTimestamp,
          runtimeMs: dto.runtimeMs,
          memoryBytes: dto.memoryBytes,
        },
      });

      await tx.user.update({
        where: { id: dto.userId },
        data: {
          currentStreak: updatedStreak,
          longestStreak: newLongestStreak,
          lastActiveAt: dto.submissionTimestamp,
        },
      });

      await tx.xPTransactions.create({
        data: {
          userId: dto.userId,
          guildId: dto.guildId,
          activityId: activity.id,
          source: xpCalc.source,
          baseAmount: xpCalc.baseAmount,
          multiplier: xpCalc.multiplier,
          diminishingRate: xpCalc.diminishingRate,
          finalAmount: xpCalc.finalAmount,
          reason: xpCalc.reason,
        },
      });

      if (dto.guildId) {
        await tx.guildMember.updateMany({
          where: { guildId: dto.guildId, userId: dto.userId },
          data: { guildXp: { increment: xpCalc.finalAmount } },
        });
      }

      return activity;
    });

    // 5. Emit Event for downstream processors (Achievements, Challenges, Notifications)
    const eventPayload: ActivityCreatedEventPayload = {
      activityId: result.id,
      userId: dto.userId,
      guildId: dto.guildId,
      difficulty: dto.difficulty,
      primaryTopic,
      problemSlug: dto.problemSlug,
      problemTitle: dto.problemTitle,
      submissionTimestamp: dto.submissionTimestamp,
    };

    this.eventEmitter.emit('activity.created', eventPayload);
    this.logger.log(`Ingested activity: '${dto.problemTitle}' for user ${dto.userId} (+${xpCalc.finalAmount} XP).`);

    return result;
  }
}
