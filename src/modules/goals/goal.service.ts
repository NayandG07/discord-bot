import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReliabilityService } from '../reliability/reliability.service';
import { GoalPeriod, GoalStatus, XpSource } from '@prisma/client';
import { ActivityCreatedEventPayload } from '../activity/activity.types';
import {
  GOAL_PENALTIES,
  SetGoalParams,
  GoalProgressInfo,
  GoalReminderCandidate,
  GoalEvaluationResult,
} from './goal.types';

@Injectable()
export class GoalService {
  private readonly logger = new Logger(GoalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reliabilityService: ReliabilityService,
  ) {}

  /**
   * Calculates the exact start and end boundaries for DAY and WEEK goals in UTC.
   */
  calculateGoalWindow(period: GoalPeriod, referenceDate: Date = new Date()): { startsAt: Date; endsAt: Date } {
    const d = new Date(referenceDate);

    if (period === GoalPeriod.DAY) {
      const startsAt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
      const endsAt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
      return { startsAt, endsAt };
    }

    // GoalPeriod.WEEK: Monday 00:00:00 UTC to Sunday 23:59:59 UTC
    const dayOfWeek = d.getUTCDay(); // 0 is Sunday, 1 is Monday, ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday, 0, 0, 0, 0));
    const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6, 23, 59, 59, 999));

    return { startsAt: monday, endsAt: sunday };
  }

  /**
   * Counts the distinct problems solved by a user in the given timestamp window.
   */
  async countSolvesInWindow(userId: string, startsAt: Date, endsAt: Date): Promise<number> {
    return this.prisma.activity.count({
      where: {
        userId,
        submissionTimestamp: {
          gte: startsAt,
          lte: endsAt,
        },
      },
    });
  }

  /**
   * Sets or updates a daily or weekly problem solving goal for a user.
   */
  async setGoal(params: SetGoalParams): Promise<GoalProgressInfo> {
    const { discordUserId, discordGuildId, period, targetCount } = params;

    if (!targetCount || targetCount < 1) {
      throw new BadRequestException('Goal target must be at least 1 problem.');
    }
    const maxTarget = period === GoalPeriod.DAY ? 50 : 200;
    if (targetCount > maxTarget) {
      throw new BadRequestException(`Target cannot exceed ${maxTarget} problems for a ${period.toLowerCase()} goal.`);
    }

    const user = await this.prisma.user.findUnique({
      where: { discordId: discordUserId },
    });
    if (!user) {
      throw new NotFoundException('Your user account is not registered. Please run `/link` first.');
    }

    let guildId: string | null = null;
    if (discordGuildId) {
      const guild = await this.prisma.guild.findUnique({
        where: { discordGuildId },
      });
      if (guild) guildId = guild.id;
    }

    const { startsAt, endsAt } = this.calculateGoalWindow(period);
    const existingSolves = await this.countSolvesInWindow(user.id, startsAt, endsAt);

    // Look for an existing ACTIVE goal in this exact window
    const existingGoal = await this.prisma.userGoal.findFirst({
      where: {
        userId: user.id,
        period,
        status: GoalStatus.ACTIVE,
        startsAt,
        endsAt,
      },
    });

    const isComplete = existingSolves >= targetCount;
    const initialStatus = isComplete ? GoalStatus.COMPLETED : GoalStatus.ACTIVE;

    let savedGoal;
    if (existingGoal) {
      savedGoal = await this.prisma.userGoal.update({
        where: { id: existingGoal.id },
        data: {
          targetCount,
          currentCount: existingSolves,
          status: initialStatus,
          completedAt: isComplete ? new Date() : null,
          guildId: guildId ?? existingGoal.guildId,
        },
      });
      this.logger.log(`Updated ${period} goal for user ${discordUserId} to target ${targetCount}.`);
    } else {
      savedGoal = await this.prisma.userGoal.create({
        data: {
          userId: user.id,
          guildId,
          period,
          targetCount,
          currentCount: existingSolves,
          status: initialStatus,
          startsAt,
          endsAt,
          completedAt: isComplete ? new Date() : null,
        },
      });
      this.logger.log(`Created new ${period} goal for user ${discordUserId} with target ${targetCount}.`);
    }

    const penalties = GOAL_PENALTIES[period];
    return {
      id: savedGoal.id,
      period: savedGoal.period,
      targetCount: savedGoal.targetCount,
      currentCount: savedGoal.currentCount,
      remaining: Math.max(0, savedGoal.targetCount - savedGoal.currentCount),
      isComplete: savedGoal.status === GoalStatus.COMPLETED,
      status: savedGoal.status,
      startsAt: savedGoal.startsAt,
      endsAt: savedGoal.endsAt,
      penaltyXp: penalties.xp,
      penaltyReliability: penalties.reliability,
    };
  }

  /**
   * Retrieves active goals and current live progress for a user.
   */
  async getUserActiveGoals(discordUserId: string): Promise<GoalProgressInfo[]> {
    const user = await this.prisma.user.findUnique({
      where: { discordId: discordUserId },
    });
    if (!user) return [];

    const now = new Date();
    const activeGoals = await this.prisma.userGoal.findMany({
      where: {
        userId: user.id,
        status: GoalStatus.ACTIVE,
        endsAt: { gte: now },
      },
      orderBy: { createdAt: 'asc' },
    });

    const results: GoalProgressInfo[] = [];
    for (const goal of activeGoals) {
      const liveSolves = await this.countSolvesInWindow(user.id, goal.startsAt, goal.endsAt);
      const isComplete = liveSolves >= goal.targetCount;
      const penalties = GOAL_PENALTIES[goal.period];

      // Auto-update if progress changed
      if (liveSolves !== goal.currentCount || (isComplete && goal.status === GoalStatus.ACTIVE)) {
        await this.prisma.userGoal.update({
          where: { id: goal.id },
          data: {
            currentCount: liveSolves,
            status: isComplete ? GoalStatus.COMPLETED : GoalStatus.ACTIVE,
            completedAt: isComplete ? new Date() : null,
          },
        });
      }

      results.push({
        id: goal.id,
        period: goal.period,
        targetCount: goal.targetCount,
        currentCount: liveSolves,
        remaining: Math.max(0, goal.targetCount - liveSolves),
        isComplete,
        status: isComplete ? GoalStatus.COMPLETED : GoalStatus.ACTIVE,
        startsAt: goal.startsAt,
        endsAt: goal.endsAt,
        penaltyXp: penalties.xp,
        penaltyReliability: penalties.reliability,
      });
    }

    return results;
  }

  /**
   * Cancels active goal(s) for a user.
   */
  async cancelGoal(discordUserId: string, period?: GoalPeriod): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { discordId: discordUserId },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const whereClause: any = {
      userId: user.id,
      status: GoalStatus.ACTIVE,
      endsAt: { gte: new Date() },
    };
    if (period) {
      whereClause.period = period;
    }

    const updateResult = await this.prisma.userGoal.updateMany({
      where: whereClause,
      data: { status: GoalStatus.CANCELLED },
    });

    return updateResult.count;
  }

  /**
   * Real-time listener for newly created problem solve activities.
   * Increments goal progress and marks goals complete if target met (NO BONUSES).
   */
  @OnEvent('activity.created')
  async handleActivityCreated(event: ActivityCreatedEventPayload): Promise<void> {
    try {
      const activeGoals = await this.prisma.userGoal.findMany({
        where: {
          userId: event.userId,
          status: GoalStatus.ACTIVE,
          startsAt: { lte: event.submissionTimestamp },
          endsAt: { gte: event.submissionTimestamp },
        },
      });

      if (activeGoals.length === 0) return;

      for (const goal of activeGoals) {
        const solves = await this.countSolvesInWindow(goal.userId, goal.startsAt, goal.endsAt);
        const reachedTarget = solves >= goal.targetCount;

        await this.prisma.userGoal.update({
          where: { id: goal.id },
          data: {
            currentCount: solves,
            status: reachedTarget ? GoalStatus.COMPLETED : GoalStatus.ACTIVE,
            completedAt: reachedTarget ? new Date() : null,
          },
        });

        if (reachedTarget) {
          this.logger.log(
            `User ${event.userId} completed ${goal.period} goal (target: ${goal.targetCount}, solved: ${solves}). No bonuses awarded as per rules.`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`Error updating goal progress on activity: ${err.message}`, err.stack);
    }
  }

  /**
   * Identifies active goals that need an automated reminder alert.
   * Rate limits reminders to avoid channel spam (max once every 6h for DAY, 24h for WEEK).
   */
  async getGoalsDueForReminder(): Promise<GoalReminderCandidate[]> {
    const now = new Date();
    const activeGoals = await this.prisma.userGoal.findMany({
      where: {
        status: GoalStatus.ACTIVE,
        endsAt: { gt: now },
      },
      include: {
        user: true,
        guild: {
          include: { notificationConfig: true },
        },
      },
    });

    const candidates: GoalReminderCandidate[] = [];

    for (const goal of activeGoals) {
      const solves = await this.countSolvesInWindow(goal.userId, goal.startsAt, goal.endsAt);
      if (solves >= goal.targetCount) {
        // Goal reached target! Auto mark complete
        await this.prisma.userGoal.update({
          where: { id: goal.id },
          data: {
            currentCount: solves,
            status: GoalStatus.COMPLETED,
            completedAt: now,
          },
        });
        continue;
      }

      const msUntilEnd = goal.endsAt.getTime() - now.getTime();
      const hoursUntilEnd = msUntilEnd / (1000 * 60 * 60);

      const msSinceLastReminder = goal.lastReminderAt
        ? now.getTime() - goal.lastReminderAt.getTime()
        : null;
      const hoursSinceLastReminder = msSinceLastReminder ? msSinceLastReminder / (1000 * 60 * 60) : null;

      let isDue = false;

      if (goal.period === GoalPeriod.DAY) {
        // Daily goal:
        // Remind if never reminded and <= 8 hours remain, OR >= 5 hours since last reminder and <= 8 hours remain
        if (hoursUntilEnd <= 8 && hoursUntilEnd >= 0.5) {
          if (hoursSinceLastReminder === null || hoursSinceLastReminder >= 5) {
            isDue = true;
          }
        }
      } else {
        // Weekly goal:
        // Remind if <= 48 hours remain and (never reminded or >= 20 hours since last reminder)
        if (hoursUntilEnd <= 48 && hoursUntilEnd >= 1) {
          if (hoursSinceLastReminder === null || hoursSinceLastReminder >= 20) {
            isDue = true;
          }
        }
      }

      if (isDue) {
        const penalties = GOAL_PENALTIES[goal.period];
        candidates.push({
          goalId: goal.id,
          userId: goal.userId,
          discordId: goal.user.discordId,
          guildId: goal.guildId,
          discordGuildId: goal.guild?.discordGuildId ?? null,
          activityChannelId: goal.guild?.notificationConfig?.activityChannelId ?? null,
          period: goal.period,
          targetCount: goal.targetCount,
          currentCount: solves,
          remaining: goal.targetCount - solves,
          endsAt: goal.endsAt,
          penaltyXp: penalties.xp,
          penaltyReliability: penalties.reliability,
        });
      }
    }

    return candidates;
  }

  /**
   * Marks a reminder as sent.
   */
  async recordReminderSent(goalId: string): Promise<void> {
    await this.prisma.userGoal.update({
      where: { id: goalId },
      data: { lastReminderAt: new Date() },
    });
  }

  /**
   * Evaluates all expired goals whose deadline (endsAt) has passed.
   * If target count was not met, marks FAILED and applies XP and Reliability penalties!
   */
  async evaluateExpiredGoals(): Promise<GoalEvaluationResult> {
    const now = new Date();
    const expiredGoals = await this.prisma.userGoal.findMany({
      where: {
        status: GoalStatus.ACTIVE,
        endsAt: { lte: now },
      },
      include: {
        user: true,
        guild: {
          include: { notificationConfig: true },
        },
      },
    });

    const result: GoalEvaluationResult = {
      evaluatedGoals: expiredGoals.length,
      completedGoals: 0,
      failedGoals: 0,
      penalties: [],
    };

    for (const goal of expiredGoals) {
      const solves = await this.countSolvesInWindow(goal.userId, goal.startsAt, goal.endsAt);

      if (solves >= goal.targetCount) {
        // Reached target
        await this.prisma.userGoal.update({
          where: { id: goal.id },
          data: {
            currentCount: solves,
            status: GoalStatus.COMPLETED,
            completedAt: goal.endsAt,
          },
        });
        result.completedGoals++;
        this.logger.log(`Expired ${goal.period} goal for user ${goal.user.username} COMPLETED (${solves}/${goal.targetCount}). No bonuses.`);
      } else {
        // Failed target -> PENALISE!
        const penalties = GOAL_PENALTIES[goal.period];
        const penaltyXp = penalties.xp;
        const penaltyReliability = penalties.reliability;

        await this.prisma.$transaction(async (tx) => {
          // 1. Mark goal as failed
          await tx.userGoal.update({
            where: { id: goal.id },
            data: {
              currentCount: solves,
              status: GoalStatus.FAILED,
              failedAt: now,
              penaltyApplied: true,
              penaltyXp,
              penaltyReliability,
            },
          });

          // 2. Insert negative XP transaction
          await tx.xPTransactions.create({
            data: {
              userId: goal.userId,
              guildId: goal.guildId,
              source: XpSource.GOAL_PENALTY,
              baseAmount: -penaltyXp,
              multiplier: 1.0,
              diminishingRate: 1.0,
              finalAmount: -penaltyXp,
              reason: `⚠️ Goal Failed Penalty: ${goal.period} goal (${solves}/${goal.targetCount} solved, -${penaltyXp} XP)`,
              createdAt: now,
            },
          });

          // 3. Deduct guild XP from member
          if (goal.guildId) {
            const member = await tx.guildMember.findUnique({
              where: { guildId_userId: { guildId: goal.guildId, userId: goal.userId } },
            });
            if (member) {
              const currentXp = Number(member.guildXp);
              const newXp = Math.max(0, currentXp - penaltyXp);
              await tx.guildMember.update({
                where: { id: member.id },
                data: { guildXp: BigInt(newXp) },
              });
            }
          }
        });

        // 4. Deduct reliability score and update rank tier
        await this.reliabilityService.updateReliability(goal.userId, -penaltyReliability);
        if (goal.guildId) {
          await this.reliabilityService.refreshGuildMemberRank(goal.guildId, goal.userId);
        }

        result.failedGoals++;
        result.penalties.push({
          goalId: goal.id,
          userId: goal.userId,
          discordId: goal.user.discordId,
          discordGuildId: goal.guild?.discordGuildId ?? null,
          activityChannelId: goal.guild?.notificationConfig?.activityChannelId ?? null,
          period: goal.period,
          targetCount: goal.targetCount,
          completedCount: solves,
          penaltyXp,
          penaltyReliability,
        });

        this.logger.warn(
          `Penalized user ${goal.user.username} for failing ${goal.period} goal (${solves}/${goal.targetCount}). Penalty: -${penaltyXp} XP, -${penaltyReliability}% Reliability.`,
        );
      }
    }

    return result;
  }
}
