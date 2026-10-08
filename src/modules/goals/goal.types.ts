import { GoalPeriod, GoalStatus } from '@prisma/client';

export const GOAL_PENALTIES = {
  DAY: {
    xp: 50,
    reliability: 5.0,
  },
  WEEK: {
    xp: 150,
    reliability: 10.0,
  },
};

export interface SetGoalParams {
  discordUserId: string;
  discordGuildId?: string;
  period: GoalPeriod;
  targetCount: number;
}

export interface GoalProgressInfo {
  id: string;
  period: GoalPeriod;
  targetCount: number;
  currentCount: number;
  remaining: number;
  isComplete: boolean;
  status: GoalStatus;
  startsAt: Date;
  endsAt: Date;
  penaltyXp: number;
  penaltyReliability: number;
}

export interface GoalReminderCandidate {
  goalId: string;
  userId: string;
  discordId: string;
  guildId?: string | null;
  discordGuildId?: string | null;
  activityChannelId?: string | null;
  period: GoalPeriod;
  targetCount: number;
  currentCount: number;
  remaining: number;
  endsAt: Date;
  penaltyXp: number;
  penaltyReliability: number;
}

export interface GoalEvaluationResult {
  evaluatedGoals: number;
  completedGoals: number;
  failedGoals: number;
  penalties: Array<{
    goalId: string;
    userId: string;
    discordId: string;
    discordGuildId?: string | null;
    activityChannelId?: string | null;
    period: GoalPeriod;
    targetCount: number;
    completedCount: number;
    penaltyXp: number;
    penaltyReliability: number;
  }>;
}
