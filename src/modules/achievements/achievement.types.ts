import { AchievementCategory, AchievementTier } from '@prisma/client';

export interface AchievementCriteriaDefinition {
  metric:
    | 'TOTAL_SOLVES'
    | 'HARD_SOLVES'
    | 'STREAK_DAYS'
    | 'CHALLENGES_WON'
    | 'CONTESTS_ENTERED'
    | 'BOSS_BATTLES_DEFEATED'
    | 'TOPIC_SOLVES'
    | 'IS_TEAM_LEADER';
  operator: 'GTE' | 'GT' | 'EQ';
  value: number | boolean;
  topic?: string;
}

export interface UserAggregates {
  totalSolves: number;
  hardSolves: number;
  streakDays: number;
  challengesWon: number;
  contestsEntered: number;
  bossBattlesDefeated: number;
  topicSolvesMap: Map<string, number>;
  isTeamLeader: boolean;
}
