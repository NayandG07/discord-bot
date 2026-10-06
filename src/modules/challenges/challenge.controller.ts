import { Controller, Post, Get, Body, Param, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChallengeService } from './challenge.service';
import { CreateChallengeDto, CastVoteDto } from './challenge.types';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('Challenges')
@Controller('challenges')
export class ChallengeController {
  constructor(
    private readonly challengeService: ChallengeService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new challenge lobby' })
  async createChallenge(@Body() dto: CreateChallengeDto) {
    const challenge = await this.challengeService.createChallenge(dto);
    return { success: true, challenge };
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a challenge invitation' })
  async acceptInvite(@Param('id') id: string, @Body('userId') userId: string) {
    return this.challengeService.acceptInvite(id, userId);
  }

  @Post(':id/vote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cast participant vote during voting period' })
  async castVote(@Param('id') id: string, @Body() dto: Omit<CastVoteDto, 'challengeId'>) {
    return this.challengeService.castVote({ ...dto, challengeId: id });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get live challenge state and scorecard' })
  async getChallenge(@Param('id') id: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id },
      include: {
        participants: { include: { user: true } },
        votes: true,
      },
    });
    return { success: true, challenge };
  }
}
