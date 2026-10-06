import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('Leaderboards')
@Controller('leaderboards')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get(':type')
  @ApiOperation({ summary: 'Get guild leaderboard by type (weekly, streak, consistency, contests)' })
  async getLeaderboard(
    @Param('type') type: string,
    @Query('guildId') guildId: string,
    @Query('limit') limit = 10,
  ) {
    let data = [];
    if (type === 'weekly') data = await this.leaderboardService.getWeeklyLeaderboard(guildId, Number(limit));
    else if (type === 'streak') data = await this.leaderboardService.getStreakLeaderboard(guildId, Number(limit));
    else if (type === 'consistency') data = await this.leaderboardService.getConsistencyLeaderboard(guildId, Number(limit));
    else if (type === 'contests') data = await this.leaderboardService.getContestLeaderboard(guildId, Number(limit));

    return { success: true, type, count: data.length, data };
  }
}
