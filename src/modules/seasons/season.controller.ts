import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SeasonService } from './season.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('Seasons')
@Controller('seasons')
export class SeasonController {
  constructor(
    private readonly seasonService: SeasonService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current active season details' })
  async getCurrentSeason() {
    const season = await this.seasonService.getActiveSeason();
    return { success: true, season };
  }

  @Get(':id/snapshots')
  @ApiOperation({ summary: 'Get historical Hall of Fame snapshots for a season' })
  async getSnapshots(@Param('id') id: string) {
    const snapshots = await this.prisma.seasonLeaderboardSnapshot.findMany({
      where: { seasonId: id },
      orderBy: { finalRankPosition: 'asc' },
      take: 50,
      include: { user: true },
    });
    return { success: true, count: snapshots.length, data: snapshots };
  }
}
