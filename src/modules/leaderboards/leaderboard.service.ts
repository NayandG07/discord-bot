import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getWeeklyLeaderboard(guildId: string, limit = 10) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const results = await this.prisma.xPTransactions.groupBy({
      by: ['userId'],
      where: {
        guildId,
        createdAt: { gte: oneWeekAgo },
      },
      _sum: { finalAmount: true },
      orderBy: {
        _sum: { finalAmount: 'desc' },
      },
      take: limit,
    });

    const populated = await Promise.all(
      results.map(async (row, index) => {
        const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
        return {
          rank: index + 1,
          userId: row.userId,
          username: user?.username || 'Unknown',
          avatarUrl: user?.avatarUrl,
          metricLabel: 'Weekly XP',
          metricValue: row._sum.finalAmount || 0,
        };
      }),
    );

    return populated;
  }

  async getStreakLeaderboard(guildId: string, limit = 10) {
    const members = await this.prisma.guildMember.findMany({
      where: { guildId },
      include: { user: true },
      orderBy: { user: { currentStreak: 'desc' } },
      take: limit,
    });

    return members.map((m, index) => ({
      rank: index + 1,
      userId: m.userId,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl,
      metricLabel: 'Day Streak',
      metricValue: m.user.currentStreak,
      tier: m.guildRank,
    }));
  }

  async getConsistencyLeaderboard(guildId: string, limit = 10) {
    const members = await this.prisma.guildMember.findMany({
      where: { guildId },
      include: { user: true },
      orderBy: { user: { reliabilityScore: 'desc' } },
      take: limit,
    });

    return members.map((m, index) => ({
      rank: index + 1,
      userId: m.userId,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl,
      metricLabel: 'Reliability %',
      metricValue: Number(m.user.reliabilityScore),
      tier: m.guildRank,
    }));
  }

  async getContestLeaderboard(guildId: string, limit = 10) {
    const participants = await this.prisma.bossBattleParticipant.groupBy({
      by: ['userId'],
      where: {
        bossBattle: { guildId },
      },
      _sum: { damageDealt: true, problemsSolved: true },
      orderBy: { _sum: { damageDealt: 'desc' } },
      take: limit,
    });

    return Promise.all(
      participants.map(async (p, idx) => {
        const user = await this.prisma.user.findUnique({ where: { id: p.userId } });
        return {
          rank: idx + 1,
          userId: p.userId,
          username: user?.username || 'Unknown',
          metricLabel: 'Raid Damage',
          metricValue: p._sum.damageDealt || 0,
          problemsSolved: p._sum.problemsSolved || 0,
        };
      }),
    );
  }
}
