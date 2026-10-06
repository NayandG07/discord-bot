import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createCanvas } from '@napi-rs/canvas';
import { RecapType, ProblemDifficulty } from '@prisma/client';

@Injectable()
export class RecapService {
  private readonly logger = new Logger(RecapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateDailyGuildRecap(guildId: string) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activities = await this.prisma.activity.findMany({
      where: {
        submissionTimestamp: { gte: yesterday },
        user: { guildMemberships: { some: { guildId } } },
      },
      include: { user: true },
    });

    let easy = 0, medium = 0, hard = 0;
    const solvers = new Set<string>();

    activities.forEach((a) => {
      solvers.add(a.userId);
      if (a.difficulty === ProblemDifficulty.EASY) easy++;
      if (a.difficulty === ProblemDifficulty.MEDIUM) medium++;
      if (a.difficulty === ProblemDifficulty.HARD) hard++;
    });

    const xpSum = await this.prisma.xPTransactions.aggregate({
      where: {
        guildId,
        createdAt: { gte: yesterday },
      },
      _sum: { finalAmount: true },
    });

    const summary = {
      totalSolves: activities.length,
      activeSolversCount: solvers.size,
      difficultyDistribution: { easy, medium, hard },
      totalXpEarned: xpSum._sum.finalAmount || 0,
      timestamp: new Date(),
    };

    return summary;
  }

  async generateMonthlyWrappedCard(userId: string, year: number, month: number): Promise<Buffer> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        activities: {
          where: { submissionTimestamp: { gte: startDate, lte: endDate } },
        },
      },
    });

    if (!user) throw new Error('User not found.');

    const totalSolves = user.activities.length;
    let easy = 0, medium = 0, hard = 0;
    const topicCount = new Map<string, number>();

    user.activities.forEach((act) => {
      if (act.difficulty === ProblemDifficulty.EASY) easy++;
      if (act.difficulty === ProblemDifficulty.MEDIUM) medium++;
      if (act.difficulty === ProblemDifficulty.HARD) hard++;
      topicCount.set(act.primaryTopic, (topicCount.get(act.primaryTopic) || 0) + 1);
    });

    let favoriteTopic = 'Algorithms';
    let maxTopicSolves = 0;
    topicCount.forEach((count, topic) => {
      if (count > maxTopicSolves) {
        maxTopicSolves = count;
        favoriteTopic = topic;
      }
    });

    // 1200x630 Canvas generation
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Gradient background
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#0F172A');
    bg.addColorStop(0.5, '#1E1B4B');
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Decorative frame
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    // Header Title
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText('DEVGUILD MONTHLY WRAPPED', 70, 95);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(user.username, 70, 160);

    // Metrics Grid
    const drawTile = (x: number, y: number, w: number, h: number, title: string, value: string, sub: string) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '22px sans-serif';
      ctx.fillText(title, x + 25, y + 45);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 42px sans-serif';
      ctx.fillText(value, x + 25, y + 105);

      ctx.fillStyle = '#38BDF8';
      ctx.font = '20px sans-serif';
      ctx.fillText(sub, x + 25, y + 145);
    };

    drawTile(70, 210, 500, 175, 'TOTAL PROBLEMS SOLVED', `${totalSolves}`, `Easy: ${easy} | Med: ${medium} | Hard: ${hard}`);
    drawTile(620, 210, 500, 175, 'FAVORITE FOCUS TOPIC', favoriteTopic.replace('_', ' '), `${maxTopicSolves} Submissions`);
    drawTile(70, 415, 500, 175, 'RELIABILITY & STREAK', `${user.currentStreak} Days`, `Reliability: ${Number(user.reliabilityScore).toFixed(1)}%`);
    drawTile(620, 415, 500, 175, 'COMMUNITY GUILD STATUS', 'ACTIVE SOLVER', 'DevGuild Competitive League');

    return canvas.toBuffer('image/png');
  }
}
