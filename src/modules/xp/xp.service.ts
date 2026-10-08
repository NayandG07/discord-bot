import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProblemDifficulty, XpSource } from '@prisma/client';
import { CalculateXpParams, CalculatedXpResult } from './xp.types';

@Injectable()
export class XpService {
  private readonly logger = new Logger(XpService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getEffectiveXpConfig(guildId?: string) {
    if (guildId) {
      const guildConfig = await this.prisma.xpConfig.findUnique({
        where: { guildId },
      });
      if (guildConfig) return guildConfig;
    }

    // Default global fallback config
    let globalConfig = await this.prisma.xpConfig.findFirst({
      where: { guildId: null },
    });

    if (!globalConfig) {
      globalConfig = await this.prisma.xpConfig.create({
        data: {
          guildId: null,
          baseEasyXp: 25,
          baseMediumXp: 60,
          baseHardXp: 150,
          easyTier1Threshold: 10,
          easyTier2Threshold: 20,
          easyTier3Threshold: 30,
          easyFloorPercent: 50,
          streakBonusRate: 0.02,
          streakBonusCap: 0.50,
        },
      });
    }

    return globalConfig;
  }

  calculateDiminishingRate(easyCount: number, config: any): number {
    if (easyCount <= (config.easyTier1Threshold || 10)) {
      return 1.0;
    } else if (easyCount <= (config.easyTier2Threshold || 20)) {
      return 0.8;
    } else {
      return (config.easyFloorPercent || 50) / 100.0;
    }
  }

  async calculateProblemSolveXp(params: CalculateXpParams): Promise<CalculatedXpResult> {
    const config = await this.getEffectiveXpConfig(params.guildId);

    let baseAmount = 0;
    let diminishingRate = 1.0;

    switch (params.difficulty) {
      case ProblemDifficulty.EASY:
        baseAmount = config.baseEasyXp;
        // Count already includes prior solves; this is solve (prior + 1)
        diminishingRate = this.calculateDiminishingRate(params.easySolvesIn24h + 1, config);
        break;
      case ProblemDifficulty.MEDIUM:
        baseAmount = config.baseMediumXp;
        diminishingRate = 1.0; // Medium problems have no diminishing penalty
        break;
      case ProblemDifficulty.HARD:
        baseAmount = config.baseHardXp;
        diminishingRate = 1.0; // Hard problems have no diminishing penalty
        break;
    }

    // Streak bonus multiplier: 1.0 + min(streak * rate, cap)
    const streakRate = Number(config.streakBonusRate);
    const streakCap = Number(config.streakBonusCap);
    const streakMultiplier = 1.0 + Math.min(params.currentStreakDays * streakRate, streakCap);

    // Final combined multiplier
    const effectiveMultiplier = Number((diminishingRate * streakMultiplier).toFixed(2));
    const finalAmount = Math.max(1, Math.round(baseAmount * effectiveMultiplier));

    return {
      baseAmount,
      diminishingRate,
      multiplier: effectiveMultiplier,
      finalAmount,
      source: XpSource.PROBLEM_SOLVE,
      reason: `Solved ${params.difficulty} problem (Streak: ${params.currentStreakDays}d, Anti-Farming: ${(diminishingRate * 100).toFixed(0)}%)`,
    };
  }

  async recordXpTransaction(
    userId: string,
    guildId: string | null,
    calc: CalculatedXpResult,
    activityId?: string,
    challengeId?: string,
    bossBattleId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.xPTransactions.create({
        data: {
          userId,
          guildId,
          activityId,
          challengeId,
          bossBattleId,
          source: calc.source,
          baseAmount: calc.baseAmount,
          multiplier: calc.multiplier,
          diminishingRate: calc.diminishingRate,
          finalAmount: calc.finalAmount,
          reason: calc.reason,
        },
      });

      if (guildId) {
        await tx.guildMember.updateMany({
          where: { guildId, userId },
          data: {
            guildXp: { increment: calc.finalAmount },
          },
        });
      }

      return transaction;
    });
  }
}
