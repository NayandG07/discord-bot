import { ProblemDifficulty, XpSource } from '@prisma/client';

export interface CalculateXpParams {
  userId: string;
  guildId?: string;
  difficulty: ProblemDifficulty;
  easySolvesIn24h: number;
  currentStreakDays: number;
}

export interface CalculatedXpResult {
  baseAmount: number;
  diminishingRate: number;
  multiplier: number;
  finalAmount: number;
  source: XpSource;
  reason: string;
}
