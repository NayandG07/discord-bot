import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AchievementCriteriaDefinition,
  UserAggregates,
} from './achievement.types';
import { ActivityCreatedEventPayload } from '../activity/activity.types';
import { ProblemDifficulty, TopicCategory, XpSource } from '@prisma/client';

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('activity.created')
  async handleActivityCreated(event: ActivityCreatedEventPayload) {
    await this.evaluateUserAchievements(event.userId, event.guildId);
  }

  evaluateCriteria(rule: AchievementCriteriaDefinition, stats: UserAggregates): boolean {
    let statVal: number | boolean = 0;

    switch (rule.metric) {
      case 'TOTAL_SOLVES':
        statVal = stats.totalSolves;
        break;
      case 'HARD_SOLVES':
        statVal = stats.hardSolves;
        break;
      case 'STREAK_DAYS':
        statVal = stats.streakDays;
        break;
      case 'CHALLENGES_WON':
        statVal = stats.challengesWon;
        break;
      case 'CONTESTS_ENTERED':
        statVal = stats.contestsEntered;
        break;
      case 'BOSS_BATTLES_DEFEATED':
        statVal = stats.bossBattlesDefeated;
        break;
      case 'IS_TEAM_LEADER':
        statVal = stats.isTeamLeader;
        break;
      case 'TOPIC_SOLVES':
        statVal = rule.topic ? stats.topicSolvesMap.get(rule.topic) || 0 : 0;
        break;
      default:
        return false;
    }

    if (rule.operator === 'EQ') return statVal === rule.value;
    if (typeof statVal === 'number' && typeof rule.value === 'number') {
      if (rule.operator === 'GTE') return statVal >= rule.value;
      if (rule.operator === 'GT') return statVal > rule.value;
    }

    return false;
  }

  async compileUserAggregates(userId: string): Promise<UserAggregates> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        activities: true,
        ledTeams: true,
        bossBattleParticipations: { include: { bossBattle: true } },
      },
    });

    if (!user) throw new Error(`User not found: ${userId}`);

    let totalSolves = user.activities.length;
    let hardSolves = 0;
    const topicMap = new Map<string, number>();

    for (const act of user.activities) {
      if (act.difficulty === ProblemDifficulty.HARD) hardSolves++;
      const current = topicMap.get(act.primaryTopic) || 0;
      topicMap.set(act.primaryTopic, current + 1);
    }

    const challengesWon = await this.prisma.challengeParticipant.count({
      where: {
        userId,
        challenge: { winningTeamNumber: { not: null } },
      },
    });

    const bossBattlesDefeated = user.bossBattleParticipations.filter(
      (p) => p.bossBattle.isDefeated,
    ).length;

    return {
      totalSolves,
      hardSolves,
      streakDays: user.currentStreak,
      challengesWon,
      contestsEntered: user.bossBattleParticipations.length,
      bossBattlesDefeated,
      topicSolvesMap: topicMap,
      isTeamLeader: user.ledTeams.length > 0,
    };
  }

  async evaluateUserAchievements(userId: string, guildId?: string) {
    const stats = await this.compileUserAggregates(userId);

    // Fetch achievements user hasn't unlocked yet
    const unlocked = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });
    const unlockedIds = new Set(unlocked.map((u) => u.achievementId));

    const candidates = await this.prisma.achievement.findMany({
      where: { id: { notIn: Array.from(unlockedIds) } },
    });

    const toUnlock: typeof candidates = [];

    for (const ach of candidates) {
      try {
        const criteria = ach.criteriaJson as unknown as AchievementCriteriaDefinition;
        if (this.evaluateCriteria(criteria, stats)) {
          toUnlock.push(ach);
        }
      } catch (err: any) {
        this.logger.error(`Error parsing criteria for achievement ${ach.code}: ${err.message}`);
      }
    }

    if (toUnlock.length === 0) return [];

    // Atomic persistence of unlocks and bonus XP
    await this.prisma.$transaction(async (tx) => {
      for (const ach of toUnlock) {
        await tx.userAchievement.create({
          data: {
            userId,
            achievementId: ach.id,
          },
        });

        await tx.xPTransactions.create({
          data: {
            userId,
            guildId,
            source: XpSource.ACHIEVEMENT_UNLOCK,
            baseAmount: ach.xpReward,
            finalAmount: ach.xpReward,
            reason: `Unlocked Achievement: ${ach.name}`,
          },
        });

        if (guildId) {
          await tx.guildMember.updateMany({
            where: { guildId, userId },
            data: { guildXp: { increment: ach.xpReward } },
          });
        }
      }
    });

    this.logger.log(`Unlocked ${toUnlock.length} achievements for user ${userId}.`);
    return toUnlock;
  }
}
