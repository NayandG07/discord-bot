import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LeetCodeService } from '../leetcode/leetcode.service';
import { BossType, ContestType, ProblemDifficulty, XpSource } from '@prisma/client';

@Injectable()
export class ContestService {
  private readonly logger = new Logger(ContestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leetcode: LeetCodeService,
  ) {}

  /**
   * Computes the live official LeetCode contest timetable.
   * - Biweekly Contest: Alternate Saturdays @ 14:30 - 16:00 UTC (90 mins)
   * - Weekly Contest: Every Sunday @ 02:30 - 04:00 UTC (90 mins)
   */
  getContestSchedule(now = new Date()) {
    // 1. Biweekly Contest calculation (Alternate Saturday, 14:30 - 16:00 UTC)
    // Reference: Biweekly 141 started on 2024-10-12T14:30:00Z
    const refBiweekly = new Date('2024-10-12T14:30:00Z').getTime();
    const twoWeeks = 14 * 24 * 60 * 60 * 1000;
    const bDiff = now.getTime() - refBiweekly;
    const bCycle = Math.floor(bDiff / twoWeeks);
    const currentBiweeklyStart = new Date(refBiweekly + bCycle * twoWeeks);
    const currentBiweeklyEnd = new Date(currentBiweeklyStart.getTime() + 90 * 60 * 1000);
    const nextBiweeklyStart = new Date(refBiweekly + (bCycle + 1) * twoWeeks);
    const nextBiweeklyEnd = new Date(nextBiweeklyStart.getTime() + 90 * 60 * 1000);

    const isBiweeklyActive = now >= currentBiweeklyStart && now < currentBiweeklyEnd;
    const upcomingBiweekly = now < currentBiweeklyStart
      ? { start: currentBiweeklyStart, end: currentBiweeklyEnd, number: 141 + bCycle }
      : { start: nextBiweeklyStart, end: nextBiweeklyEnd, number: 141 + bCycle + 1 };

    // 2. Weekly Contest calculation (Every Sunday, 02:30 - 04:00 UTC)
    // Reference: Weekly 419 started on 2024-10-13T02:30:00Z
    const refWeekly = new Date('2024-10-13T02:30:00Z').getTime();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const wDiff = now.getTime() - refWeekly;
    const wCycle = Math.floor(wDiff / oneWeek);
    const currentWeeklyStart = new Date(refWeekly + wCycle * oneWeek);
    const currentWeeklyEnd = new Date(currentWeeklyStart.getTime() + 90 * 60 * 1000);
    const nextWeeklyStart = new Date(refWeekly + (wCycle + 1) * oneWeek);
    const nextWeeklyEnd = new Date(nextWeeklyStart.getTime() + 90 * 60 * 1000);

    const isWeeklyActive = now >= currentWeeklyStart && now < currentWeeklyEnd;
    const upcomingWeekly = now < currentWeeklyStart
      ? { start: currentWeeklyStart, end: currentWeeklyEnd, number: 419 + wCycle }
      : { start: nextWeeklyStart, end: nextWeeklyEnd, number: 419 + wCycle + 1 };

    let activeContest: {
      leetCodeContestId: string;
      title: string;
      type: ContestType;
      startTime: Date;
      endTime: Date;
      bossType: BossType;
      bossName: string;
      isCriticalActive: boolean;
    } | null = null;

    if (isBiweeklyActive) {
      activeContest = {
        leetCodeContestId: `biweekly-contest-${141 + bCycle}`,
        title: `Biweekly Contest ${141 + bCycle}`,
        type: ContestType.BIWEEKLY,
        startTime: currentBiweeklyStart,
        endTime: currentBiweeklyEnd,
        bossType: BossType.MEGA_BOSS,
        bossName: 'The Monolithic Leviathan',
        isCriticalActive: now.getTime() < currentBiweeklyStart.getTime() + 30 * 60 * 1000,
      };
    } else if (isWeeklyActive) {
      activeContest = {
        leetCodeContestId: `weekly-contest-${419 + wCycle}`,
        title: `Weekly Contest ${419 + wCycle}`,
        type: ContestType.WEEKLY,
        startTime: currentWeeklyStart,
        endTime: currentWeeklyEnd,
        bossType: BossType.WEEKLY_BOSS,
        bossName: 'The Recursion Dragon',
        isCriticalActive: now.getTime() < currentWeeklyStart.getTime() + 30 * 60 * 1000,
      };
    }

    return {
      activeContest,
      upcomingBiweekly,
      upcomingWeekly,
    };
  }

  calculateBossHp(bossType: BossType, activeMemberCount: number): number {
    const baseHP = bossType === BossType.WEEKLY_BOSS ? 1500 : 3500;
    const factor = bossType === BossType.WEEKLY_BOSS ? 350 : 750;
    return baseHP + Math.max(1, activeMemberCount) * factor;
  }

  calculateDamage(problemIndex: number, isCritical = false): number {
    let base = 0;
    let crit = 0;

    switch (problemIndex) {
      case 1:
        base = 100;
        crit = 25;
        break;
      case 2:
        base = 250;
        crit = 50;
        break;
      case 3:
        base = 600;
        crit = 150;
        break;
      case 4:
        base = 1500;
        crit = 500;
        break;
      default:
        base = 100;
        crit = 25;
    }

    return base + (isCritical ? crit : 0);
  }

  /**
   * Ensures an active Contest and BossBattle exist in the DB for the specified guild.
   * Returns the active BossBattle entity with contest and participants populated.
   */
  async ensureActiveBossBattle(guildId: string, now = new Date()) {
    const { activeContest } = this.getContestSchedule(now);
    if (!activeContest) {
      return null;
    }

    const contest = await this.prisma.contest.upsert({
      where: { leetCodeContestId: activeContest.leetCodeContestId },
      update: {
        startTime: activeContest.startTime,
        endTime: activeContest.endTime,
      },
      create: {
        leetCodeContestId: activeContest.leetCodeContestId,
        title: activeContest.title,
        type: activeContest.type,
        startTime: activeContest.startTime,
        endTime: activeContest.endTime,
      },
    });

    let bossBattle = await this.prisma.bossBattle.findUnique({
      where: { guildId_contestId: { guildId, contestId: contest.id } },
      include: {
        contest: true,
        participants: { include: { user: true } },
      },
    });

    if (!bossBattle) {
      const activeMembers = await this.prisma.guildMember.count({
        where: { guildId },
      });
      const bossHp = this.calculateBossHp(activeContest.bossType, activeMembers);

      bossBattle = await this.prisma.bossBattle.create({
        data: {
          guildId,
          contestId: contest.id,
          bossType: activeContest.bossType,
          bossName: activeContest.bossName,
          totalHealthPoints: bossHp,
          currentHealthPoints: bossHp,
        },
        include: {
          contest: true,
          participants: { include: { user: true } },
        },
      });
      this.logger.log(`Spawned new Boss Battle "${bossBattle.bossName}" for guild ${guildId} (Contest: ${contest.title}).`);
    }

    return bossBattle;
  }

  /**
   * Records raid damage dealt to the active boss if a problem was solved during an official contest.
   */
  async recordRaidDamage(
    userId: string,
    guildId: string,
    difficulty: ProblemDifficulty,
    submissionTimestamp: Date = new Date(),
  ) {
    const { activeContest } = this.getContestSchedule(submissionTimestamp);
    if (!activeContest) return null;

    const bossBattle = await this.ensureActiveBossBattle(guildId, submissionTimestamp);
    if (!bossBattle || bossBattle.isDefeated) return null;

    let problemIndex = 1;
    if (difficulty === ProblemDifficulty.MEDIUM) problemIndex = 2;
    if (difficulty === ProblemDifficulty.HARD) problemIndex = 4;

    const isCritical = submissionTimestamp.getTime() <= activeContest.startTime.getTime() + 30 * 60 * 1000;
    const dmg = this.calculateDamage(problemIndex, isCritical);

    await this.prisma.bossBattleParticipant.upsert({
      where: {
        bossBattleId_userId: {
          bossBattleId: bossBattle.id,
          userId,
        },
      },
      update: {
        damageDealt: { increment: dmg },
        problemsSolved: { increment: 1 },
      },
      create: {
        bossBattleId: bossBattle.id,
        userId,
        damageDealt: dmg,
        problemsSolved: 1,
      },
    });

    const newHp = Math.max(0, bossBattle.currentHealthPoints - dmg);
    const isDefeated = newHp === 0;

    const updatedBoss = await this.prisma.bossBattle.update({
      where: { id: bossBattle.id },
      data: {
        currentHealthPoints: newHp,
        isDefeated,
      },
      include: {
        contest: true,
        participants: { include: { user: true } },
      },
    });

    this.logger.log(
      `User ${userId} dealt ${dmg} DMG to ${updatedBoss.bossName} in guild ${guildId}. (HP: ${newHp}/${updatedBoss.totalHealthPoints})`,
    );

    return {
      bossBattle: updatedBoss,
      damageDealt: dmg,
      isCritical,
      isDefeated,
      newHp,
    };
  }

  async setupContestBossBattle(
    leetCodeContestId: string,
    title: string,
    type: ContestType,
    startTime: Date,
    endTime: Date,
  ) {
    const contest = await this.prisma.contest.upsert({
      where: { leetCodeContestId },
      update: { startTime, endTime },
      create: {
        leetCodeContestId,
        title,
        type,
        startTime,
        endTime,
      },
    });

    const guilds = await this.prisma.guild.findMany({ where: { isActive: true } });

    for (const guild of guilds) {
      const activeMembers = await this.prisma.guildMember.count({
        where: { guildId: guild.id },
      });

      const bossType = type === ContestType.WEEKLY ? BossType.WEEKLY_BOSS : BossType.MEGA_BOSS;
      const bossHp = this.calculateBossHp(bossType, activeMembers);
      const bossName =
        bossType === BossType.WEEKLY_BOSS ? 'The Recursion Dragon' : 'The Monolithic Leviathan';

      await this.prisma.bossBattle.upsert({
        where: { guildId_contestId: { guildId: guild.id, contestId: contest.id } },
        update: {},
        create: {
          guildId: guild.id,
          contestId: contest.id,
          bossType,
          bossName,
          totalHealthPoints: bossHp,
          currentHealthPoints: bossHp,
        },
      });
    }

    this.logger.log(`Initialized Boss Battles for contest ${leetCodeContestId} across ${guilds.length} guilds.`);
    return contest;
  }

  async checkAndFinalizeExpiredBossBattles(now = new Date()) {
    const expiredContests = await this.prisma.contest.findMany({
      where: {
        endTime: { lte: now },
        isProcessed: false,
      },
      include: {
        bossBattles: true,
      },
    });

    for (const contest of expiredContests) {
      for (const battle of contest.bossBattles) {
        await this.finalizeBossBattle(battle.id);
      }
      await this.prisma.contest.update({
        where: { id: contest.id },
        data: { isProcessed: true },
      });
      this.logger.log(`Finalized Boss Battles for expired contest ${contest.title}.`);
    }
  }

  async finalizeBossBattle(bossBattleId: string) {
    const bossBattle = await this.prisma.bossBattle.findUnique({
      where: { id: bossBattleId },
      include: {
        contest: true,
        guild: true,
        participants: { include: { user: true } },
      },
    });

    if (!bossBattle || bossBattle.isDefeated) return;

    let totalDamageDealt = 0;
    let mvpParticipantId: string | null = null;
    let maxDamage = -1;

    for (const p of bossBattle.participants) {
      totalDamageDealt += p.damageDealt;
      if (p.damageDealt > maxDamage) {
        maxDamage = p.damageDealt;
        mvpParticipantId = p.id;
      }
    }

    const remainingHp = Math.max(0, bossBattle.totalHealthPoints - totalDamageDealt);
    const isDefeated = remainingHp === 0;

    const baseRewardXp = bossBattle.bossType === BossType.WEEKLY_BOSS ? 250 : 500;

    await this.prisma.$transaction(async (tx) => {
      await tx.bossBattle.update({
        where: { id: bossBattleId },
        data: {
          currentHealthPoints: remainingHp,
          isDefeated,
        },
      });

      if (isDefeated) {
        for (const p of bossBattle.participants) {
          const isMvp = p.id === mvpParticipantId;
          const finalXp = isMvp ? baseRewardXp + 200 : baseRewardXp;

          await tx.xPTransactions.create({
            data: {
              userId: p.userId,
              guildId: bossBattle.guildId,
              bossBattleId: bossBattle.id,
              source: isMvp ? XpSource.BOSS_BATTLE_MVP : XpSource.BOSS_BATTLE,
              baseAmount: finalXp,
              finalAmount: finalXp,
              reason: isMvp ? 'Boss Battle Victory & MVP Raid Bonus' : 'Boss Battle Victory Bonus',
            },
          });

          await tx.guildMember.updateMany({
            where: { guildId: bossBattle.guildId, userId: p.userId },
            data: { guildXp: { increment: finalXp } },
          });
        }
      }
    });

    return {
      bossBattleId,
      isDefeated,
      remainingHp,
      totalDamageDealt,
      participantsCount: bossBattle.participants.length,
    };
  }
}

