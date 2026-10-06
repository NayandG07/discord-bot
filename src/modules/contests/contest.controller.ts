import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ContestService } from './contest.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('Contests & Boss Battles')
@Controller('boss-battles')
export class ContestController {
  constructor(
    private readonly contestService: ContestService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('active')
  @ApiOperation({ summary: 'Get active Boss Battle for a guild' })
  async getActiveBossBattle(@Query('guildId') guildId: string) {
    const battle = await this.prisma.bossBattle.findFirst({
      where: {
        guildId,
        contest: { endTime: { gte: new Date() } },
      },
      include: {
        contest: true,
        participants: { include: { user: true }, take: 10, orderBy: { damageDealt: 'desc' } },
      },
    });

    return { success: true, battle };
  }
}
