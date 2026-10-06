import { Controller, Get, Post, Body, Param, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LeetCodeService } from './leetcode.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as crypto from 'crypto';

class LinkInitDto {
  discordId: string;
  leetCodeUsername: string;
}

class VerifyDto {
  discordId: string;
  leetCodeUsername: string;
}

@ApiTags('LeetCode')
@Controller('leetcode')
export class LeetCodeController {
  constructor(
    private readonly leetCodeService: LeetCodeService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('link-init')
  @ApiOperation({ summary: 'Generate verification token to link LeetCode account' })
  async initLink(@Body() dto: LinkInitDto) {
    const profile = await this.leetCodeService.fetchUserProfile(dto.leetCodeUsername);
    const token = `dg-verify-${crypto.randomBytes(4).toString('hex')}`;

    // Ensure user exists
    const user = await this.prisma.user.upsert({
      where: { discordId: dto.discordId },
      update: {},
      create: {
        discordId: dto.discordId,
        username: dto.discordId,
      },
    });

    // Save pending verification token
    await this.prisma.leetCodeProfile.upsert({
      where: { userId: user.id },
      update: {
        username: profile.username,
        verificationToken: token,
        isVerified: false,
      },
      create: {
        userId: user.id,
        username: profile.username,
        verificationToken: token,
        isVerified: false,
      },
    });

    return {
      success: true,
      verificationToken: token,
      instructions: `Place this token '${token}' inside your LeetCode profile 'About Me' bio, then run verification.`,
    };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm cryptographic token in LeetCode profile bio' })
  async verifyAccount(@Body() dto: VerifyDto) {
    const user = await this.prisma.user.findUnique({
      where: { discordId: dto.discordId },
      include: { leetCodeProfile: true },
    });

    if (!user || !user.leetCodeProfile || !user.leetCodeProfile.verificationToken) {
      return { success: false, message: 'No pending verification found. Run link-init first.' };
    }

    const liveProfile = await this.leetCodeService.fetchUserProfile(dto.leetCodeUsername);
    const token = user.leetCodeProfile.verificationToken;

    const aboutMe = liveProfile.aboutMe || '';
    if (!aboutMe.includes(token)) {
      return {
        success: false,
        message: `Token '${token}' was not detected in your LeetCode profile bio. Current bio preview: '${aboutMe.slice(0, 40)}...'`,
      };
    }

    // Parse question stats
    let easy = 0, medium = 0, hard = 0, total = 0;
    liveProfile.submitStats.acSubmissionNum.forEach((stat) => {
      if (stat.difficulty === 'All') total = stat.count;
      if (stat.difficulty === 'Easy') easy = stat.count;
      if (stat.difficulty === 'Medium') medium = stat.count;
      if (stat.difficulty === 'Hard') hard = stat.count;
    });

    const contestInfo = await this.leetCodeService.fetchContestRanking(dto.leetCodeUsername);

    const updated = await this.prisma.leetCodeProfile.update({
      where: { id: user.leetCodeProfile.id },
      data: {
        isVerified: true,
        verificationToken: null,
        totalSolved: total,
        easySolved: easy,
        mediumSolved: medium,
        hardSolved: hard,
        ranking: liveProfile.ranking,
        contestRating: contestInfo?.rating ? Number(contestInfo.rating) : null,
        contestGlobalRank: contestInfo?.globalRanking || null,
        lastSyncedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'LeetCode profile successfully verified and linked!',
      profile: updated,
    };
  }

  @Get('profile/:username')
  @ApiOperation({ summary: 'Get live LeetCode stats for username' })
  async getProfile(@Param('username') username: string) {
    const profile = await this.leetCodeService.fetchUserProfile(username);
    const contest = await this.leetCodeService.fetchContestRanking(username);
    return { success: true, profile, contest };
  }
}
