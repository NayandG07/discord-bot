import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TeamRole } from '@prisma/client';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createTeam(guildId: string, leaderId: string, name: string, tag: string) {
    const existing = await this.prisma.team.findFirst({
      where: {
        guildId,
        OR: [{ name }, { tag: tag.toUpperCase() }],
      },
    });

    if (existing) {
      throw new BadRequestException('A team with this name or tag already exists in this guild.');
    }

    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          guildId,
          leaderId,
          name,
          tag: tag.toUpperCase(),
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: leaderId,
          role: TeamRole.LEADER,
        },
      });

      return team;
    });
  }

  async addMember(teamId: string, userId: string, role = TeamRole.MEMBER) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found.');

    const alreadyMember = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (alreadyMember) throw new BadRequestException('User is already a member of this team.');

    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role,
      },
    });
  }

  async leaveTeam(teamId: string, userId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw new NotFoundException('User is not a member of this team.');

    if (member.role === TeamRole.LEADER) {
      throw new BadRequestException('Team leader cannot leave without transferring ownership or disbanding.');
    }

    return this.prisma.teamMember.delete({
      where: { id: member.id },
    });
  }

  async getTeamStats(teamIdOrTag: string, guildId?: string) {
    const team = await this.prisma.team.findFirst({
      where: {
        OR: [{ id: teamIdOrTag }, { tag: teamIdOrTag.toUpperCase() }],
        ...(guildId ? { guildId } : {}),
      },
      include: {
        leader: true,
        members: { include: { user: true } },
      },
    });

    if (!team) throw new NotFoundException('Team not found.');

    const totalMatches = team.wins + team.losses;
    const winRate = totalMatches > 0 ? Number(((team.wins / totalMatches) * 100).toFixed(1)) : 0;

    return {
      team,
      winRate,
      memberCount: team.members.length,
    };
  }
}
