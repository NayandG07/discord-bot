import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RankTier } from '@prisma/client';

@Injectable()
export class ReliabilityService {
  private readonly logger = new Logger(ReliabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  calculateBoundedScore(currentScore: number, delta: number): number {
    const updated = currentScore + delta;
    return Number(Math.min(100.0, Math.max(0.0, updated)).toFixed(2));
  }

  async updateReliability(userId: string, delta: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const newScore = this.calculateBoundedScore(Number(user.reliabilityScore), delta);

    return this.prisma.user.update({
      where: { id: userId },
      data: { reliabilityScore: newScore },
    });
  }

  determineRankTier(
    xp: number,
    reliabilityScore: number,
    contestsAttended: number,
    challengesWon: number,
  ): RankTier {
    // Grandmaster: 12000+ XP, Reliability >= 90, at least 5 contests, 5 challenge wins
    if (xp >= 12000 && reliabilityScore >= 90 && contestsAttended >= 5 && challengesWon >= 5) {
      return RankTier.GRANDMASTER;
    }
    // Master: 7500+ XP, Reliability >= 85, at least 3 contests
    if (xp >= 7500 && reliabilityScore >= 85 && contestsAttended >= 3) {
      return RankTier.MASTER;
    }
    // Diamond: 4500+ XP, Reliability >= 80
    if (xp >= 4500 && reliabilityScore >= 80) {
      return RankTier.DIAMOND;
    }
    // Platinum: 2500+ XP, Reliability >= 70
    if (xp >= 2500 && reliabilityScore >= 70) {
      return RankTier.PLATINUM;
    }
    // Gold: 1200+ XP
    if (xp >= 1200) {
      return RankTier.GOLD;
    }
    // Silver: 500+ XP
    if (xp >= 500) {
      return RankTier.SILVER;
    }
    return RankTier.BRONZE;
  }

  async refreshGuildMemberRank(guildId: string, userId: string) {
    const member = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
      include: { user: true },
    });
    if (!member) return;

    const contestsAttended = await this.prisma.bossBattleParticipant.count({
      where: { userId },
    });

    const challengesWon = await this.prisma.challengeParticipant.count({
      where: {
        userId,
        challenge: { winningTeamNumber: { not: null } },
      },
    });

    const tier = this.determineRankTier(
      Number(member.guildXp),
      Number(member.user.reliabilityScore),
      contestsAttended,
      challengesWon,
    );

    if (tier !== member.guildRank) {
      await this.prisma.guildMember.update({
        where: { id: member.id },
        data: { guildRank: tier },
      });
      this.logger.log(`User ${userId} rank updated to ${tier} in guild ${guildId}.`);
    }

    return tier;
  }
}
