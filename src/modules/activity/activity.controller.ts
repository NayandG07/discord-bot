import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProblemDifficulty, TopicCategory } from '@prisma/client';

@ApiTags('Activities')
@Controller('activities')
export class ActivityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List verified activities with filtering and pagination' })
  async getActivities(
    @Query('userId') userId?: string,
    @Query('difficulty') difficulty?: ProblemDifficulty,
    @Query('topic') topic?: TopicCategory,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const where = {
      ...(userId ? { userId } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(topic ? { primaryTopic: topic } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        take,
        skip,
        orderBy: { submissionTimestamp: 'desc' },
        include: { user: true },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      meta: {
        page: Number(page),
        limit: take,
        totalItems: total,
        totalPages: Math.ceil(total / take),
      },
    };
  }
}
