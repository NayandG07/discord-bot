import { GoalPeriod, GoalStatus } from '@prisma/client';

export const GOAL_PENALTIES = {
  DAY: {
    xpRate: 0.05, // 5% of current Guild XP
    minXp: 3,
    xp: 50, // fallback reference
    reliability: 5.0,
  },
  WEEK: {
    xpRate: 0.10, // 10% of current Guild XP
    minXp: 5,
    xp: 150, // fallback reference
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
