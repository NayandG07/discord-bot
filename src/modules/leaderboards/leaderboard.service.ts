import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getCumulativeLeaderboard(guildId: string, limit = 10) {
    const members = await this.prisma.guildMember.findMany({
      where: { guildId },
      include: {
        user: {
          include: {
            leetCodeProfile: true,
            _count: { select: { activities: true } },
          },
        },
      },
      orderBy: { guildXp: 'desc' },
      take: limit,
    });

    return members.map((m, index) => {
      const profile = m.user.leetCodeProfile;
      return {
        rank: index + 1,
        userId: m.userId,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        metricLabel: 'Guild XP',
        metricValue: Number(m.guildXp),
        tier: m.guildRank,
        botSolved: m.user._count?.activities ?? 0,
        totalSolved: profile?.totalSolved ?? 0,
        easy: profile?.easySolved ?? 0,
        medium: profile?.mediumSolved ?? 0,
        hard: profile?.hardSolved ?? 0,
        streak: m.user.currentStreak,
        longestStreak: m.user.longestStreak,
        contestRating: profile?.contestRating ? Number(profile.contestRating) : undefined,
      };
    });
  }

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
        const user = await this.prisma.user.findUnique({
          where: { id: row.userId },
          include: {
            leetCodeProfile: true,
            guildMemberships: { where: { guildId } },
          },
        });
        const member = user?.guildMemberships?.[0];
        const profile = user?.leetCodeProfile;
        const weeklySolvesCount = await this.prisma.activity.count({
          where: {
            userId: row.userId,
            submissionTimestamp: { gte: oneWeekAgo },
          },
        });

        return {
          rank: index + 1,
          userId: row.userId,
          username: user?.username || 'Unknown',
          avatarUrl: user?.avatarUrl,
          metricLabel: 'Weekly XP',
          metricValue: row._sum.finalAmount || 0,
          tier: member?.guildRank,
          botSolved: weeklySolvesCount,
          totalSolved: profile?.totalSolved,
          easy: profile?.easySolved,
          medium: profile?.mediumSolved,
          hard: profile?.hardSolved,
          streak: user?.currentStreak,
          longestStreak: user?.longestStreak,
          contestRating: profile?.contestRating ? Number(profile.contestRating) : undefined,
        };
      }),
    );

    return populated;
  }

  async getStreakLeaderboard(guildId: string, limit = 10) {
    const members = await this.prisma.guildMember.findMany({
      where: { guildId },
      include: {
        user: {
          include: {
            leetCodeProfile: true,
            _count: { select: { activities: true } },
          },
        },
      },
      orderBy: { user: { currentStreak: 'desc' } },
      take: limit,
    });

    return members.map((m, index) => {
      const profile = m.user.leetCodeProfile;
      return {
        rank: index + 1,
        userId: m.userId,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        metricLabel: 'Day Streak',
        metricValue: m.user.currentStreak,
        tier: m.guildRank,
        botSolved: m.user._count?.activities ?? 0,
        totalSolved: profile?.totalSolved,
        easy: profile?.easySolved,
        medium: profile?.mediumSolved,
        hard: profile?.hardSolved,
        streak: m.user.currentStreak,
        longestStreak: m.user.longestStreak,
        contestRating: profile?.contestRating ? Number(profile.contestRating) : undefined,
      };
    });
  }

  async getConsistencyLeaderboard(guildId: string, limit = 10) {
    const members = await this.prisma.guildMember.findMany({
      where: { guildId },
      include: {
        user: {
          include: {
            leetCodeProfile: true,
            _count: { select: { activities: true } },
          },
        },
      },
      orderBy: { user: { reliabilityScore: 'desc' } },
      take: limit,
    });

    return members.map((m, index) => {
      const profile = m.user.leetCodeProfile;
      return {
        rank: index + 1,
        userId: m.userId,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        metricLabel: 'Reliability %',
        metricValue: Number(m.user.reliabilityScore),
        tier: m.guildRank,
        botSolved: m.user._count?.activities ?? 0,
        totalSolved: profile?.totalSolved,
        easy: profile?.easySolved,
        medium: profile?.mediumSolved,
        hard: profile?.hardSolved,
        streak: m.user.currentStreak,
        longestStreak: m.user.longestStreak,
        contestRating: profile?.contestRating ? Number(profile.contestRating) : undefined,
      };
    });
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
