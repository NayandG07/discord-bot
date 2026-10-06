import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { XpService } from './xp.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProblemDifficulty } from '@prisma/client';

class SimulateXpDto {
  difficulty: ProblemDifficulty;
  easySolvesIn24h: number;
  currentStreakDays: number;
}

@ApiTags('XP & Anti-Farming')
@Controller('xp')
export class XpController {
  constructor(
    private readonly xpService: XpService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('simulate')
  @ApiOperation({ summary: 'Simulate XP calculation with anti-farming curves' })
  async simulate(@Body() dto: SimulateXpDto) {
    const calculation = await this.xpService.calculateProblemSolveXp({
      userId: 'simulation',
      difficulty: dto.difficulty,
      easySolvesIn24h: dto.easySolvesIn24h || 0,
      currentStreakDays: dto.currentStreakDays || 0,
    });
    return { success: true, calculation };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Query XP transaction audit ledger' })
  async getTransactions(
    @Query('userId') userId?: string,
    @Query('guildId') guildId?: string,
    @Query('limit') limit = 20,
  ) {
    const transactions = await this.prisma.xPTransactions.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(guildId ? { guildId } : {}),
      },
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    return { success: true, count: transactions.length, data: transactions };
  }
}
