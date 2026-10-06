import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logAction(
    adminUserId: string,
    action: string,
    targetEntity: string,
    targetId: string | null,
    beforeState: any,
    afterState: any,
    ipAddress?: string,
  ) {
    return this.prisma.auditLog.create({
      data: {
        adminUserId,
        action,
        targetEntity,
        targetId,
        beforeState,
        afterState,
        ipAddress,
      },
    });
  }

  async updateGuildXpConfig(
    adminUserId: string,
    guildId: string,
    updates: {
      baseEasyXp?: number;
      baseMediumXp?: number;
      baseHardXp?: number;
      easyTier1Threshold?: number;
      easyTier2Threshold?: number;
      easyTier3Threshold?: number;
      easyFloorPercent?: number;
    },
    ipAddress?: string,
  ) {
    const existing = await this.prisma.xpConfig.findUnique({ where: { guildId } });

    const updated = await this.prisma.xpConfig.upsert({
      where: { guildId },
      update: updates,
      create: { guildId, ...updates },
    });

    await this.logAction(
      adminUserId,
      'UPDATE_XP_CONFIG',
      'XpConfig',
      guildId,
      existing,
      updated,
      ipAddress,
    );

    return updated;
  }

  async getAuditLogs(limit = 50) {
    return this.prisma.auditLog.findMany({
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { adminUser: true },
    });
  }
}
