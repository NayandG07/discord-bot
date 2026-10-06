import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('Achievements')
@Controller('achievements')
export class AchievementController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all available achievements in the catalog' })
  async getCatalog() {
    const list = await this.prisma.achievement.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, count: list.length, data: list };
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get unlocked achievements for a user' })
  async getUserAchievements(@Param('userId') userId: string) {
    const list = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    });
    return { success: true, count: list.length, data: list };
  }
}
