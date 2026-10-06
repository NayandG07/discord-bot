import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RecapService } from './recap.service';
import { Response } from 'express';

@ApiTags('Recaps')
@Controller('recaps')
export class RecapController {
  constructor(private readonly recapService: RecapService) {}

  @Get('daily')
  @ApiOperation({ summary: 'Get daily recap summary for a guild' })
  async getDailyRecap(@Query('guildId') guildId: string) {
    const recap = await this.recapService.generateDailyGuildRecap(guildId);
    return { success: true, recap };
  }

  @Get('monthly-wrapped/:userId')
  @ApiOperation({ summary: 'Generate PNG image buffer for user Monthly Wrapped' })
  async getMonthlyWrappedCard(
    @Param('userId') userId: string,
    @Query('year') year: number,
    @Query('month') month: number,
    @Res() res: Response,
  ) {
    const y = year ? Number(year) : new Date().getFullYear();
    const m = month ? Number(month) : new Date().getMonth() + 1;

    const buffer = await this.recapService.generateMonthlyWrappedCard(userId, y, m);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="wrapped-${userId}-${y}-${m}.png"`);
    res.send(buffer);
  }
}
