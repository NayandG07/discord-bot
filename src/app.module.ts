import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/users/user.module';
import { LeetCodeModule } from './modules/leetcode/leetcode.module';
import { ActivityModule } from './modules/activity/activity.module';
import { XpModule } from './modules/xp/xp.module';
import { ChallengeModule } from './modules/challenges/challenge.module';
import { ContestModule } from './modules/contests/contest.module';
import { AchievementModule } from './modules/achievements/achievement.module';
import { ReliabilityModule } from './modules/reliability/reliability.module';
import { LeaderboardModule } from './modules/leaderboards/leaderboard.module';
import { RecapModule } from './modules/recaps/recap.module';
import { SeasonModule } from './modules/seasons/season.module';
import { TeamModule } from './modules/teams/team.module';
import { DiscordModule } from './modules/discord/discord.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { GoalModule } from './modules/goals/goal.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UserModule,
    LeetCodeModule,
    ActivityModule,
    XpModule,
    ChallengeModule,
    ContestModule,
    AchievementModule,
    ReliabilityModule,
    LeaderboardModule,
    RecapModule,
    SeasonModule,
    TeamModule,
    DiscordModule,
    AdminModule,
    HealthModule,
    GoalModule,
  ],
})
export class AppModule {}
