import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { SeasonStatus, RankTier } from '@prisma/client';

@Injectable()
export class SeasonService {
  private readonly logger = new Logger(SeasonService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  calculateSoftResetXp(oldXp: number): number {
    const baseOffset = 500;
    const compressionFactor = 0.35;
    const compressed = baseOffset + (oldXp - baseOffset) * compressionFactor;
    return Math.max(0, Math.round(compressed));
  }

  async getActiveSeason() {
    let active = await this.prisma.season.findFirst({
      where: { status: SeasonStatus.ACTIVE },
    });

    if (!active) {
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days default
      active = await this.prisma.season.create({
        data: {
          number: 1,
          name: 'Season 1: Genesis of the Guild',
          status: SeasonStatus.ACTIVE,
          startsAt,
          endsAt,
        },
      });
      this.logger.log('Created and initialized Genesis Season 1.');
    }

    return active;
  }

  async executeSeasonReset(currentSeasonId: string) {
    const lock = await this.redis.acquireLock(`season:${currentSeasonId}:reset`, 60000);

    try {
      const season = await this.prisma.season.findUnique({
        where: { id: currentSeasonId },
      });
      if (!season || season.status !== SeasonStatus.ACTIVE) return;

      this.logger.log(`Beginning season ${season.number} finalization & snapshots...`);

      const guilds = await this.prisma.guild.findMany({ where: { isActive: true } });

      for (const guild of guilds) {
        // Fetch top guild members ordered by XP
        const members = await this.prisma.guildMember.findMany({
          where: { guildId: guild.id },
          orderBy: { guildXp: 'desc' },
          include: { user: { include: { activities: true } } },
        });

        // 1. Create permanent Hall of Fame snapshots
        for (let i = 0; i < members.length; i++) {
          const m = members[i];
          const rankPosition = i + 1;
          const problemsSolved = m.user.activities.length;

          const challengesWon = await this.prisma.challengeParticipant.count({
            where: {
              userId: m.userId,
              challenge: { guildId: guild.id, winningTeamNumber: { not: null } },
            },
          });

          await this.prisma.seasonLeaderboardSnapshot.upsert({
            where: {
              seasonId_guildId_userId: {
                seasonId: season.id,
                guildId: guild.id,
                userId: m.userId,
              },
            },
            update: {},
            create: {
              seasonId: season.id,
              guildId: guild.id,
              userId: m.userId,
              finalRankPosition: rankPosition,
              finalRankTier: m.guildRank,
              finalXp: m.guildXp,
              totalProblemsSolved: problemsSolved,
              challengesWon,
            },
          });

          // 2. Apply Soft Reset MMR compression to user's guildXp
          const resetXp = this.calculateSoftResetXp(Number(m.guildXp));
          await this.prisma.guildMember.update({
            where: { id: m.id },
            data: {
              guildXp: BigInt(resetXp),
              guildRank: resetXp >= 1200 ? RankTier.GOLD : resetXp >= 500 ? RankTier.SILVER : RankTier.BRONZE,
            },
          });
        }
      }

      // Mark current season as ARCHIVED
      await this.prisma.season.update({
        where: { id: season.id },
        data: { status: SeasonStatus.ARCHIVED },
      });

      // Launch next season automatically
      const nextNumber = season.number + 1;
      const nextStartsAt = new Date();
      const nextEndsAt = new Date(nextStartsAt.getTime() + 90 * 24 * 60 * 60 * 1000);

      const nextSeason = await this.prisma.season.create({
        data: {
          number: nextNumber,
          name: `Season ${nextNumber}: Guild Ascension`,
          status: SeasonStatus.ACTIVE,
          startsAt: nextStartsAt,
          endsAt: nextEndsAt,
        },
      });

      this.logger.log(`Season ${season.number} archived. Launched Season ${nextNumber}.`);
      return nextSeason;
    } finally {
      await lock.release();
    }
  }
}
