import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LeetCodeService } from '../leetcode/leetcode.service';
import { BossType, ContestType, XpSource } from '@prisma/client';

@Injectable()
export class ContestService {
  private readonly logger = new Logger(ContestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leetcode: LeetCodeService,
  ) {}

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
        base = 0;
    }

    return base + (isCritical ? crit : 0);
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
