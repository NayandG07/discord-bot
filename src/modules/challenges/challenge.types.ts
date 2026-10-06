import {
  ChallengeFormat,
  ChallengeStatus,
  ChallengeIntensity,
  TopicCategory,
  ParticipantStatus,
} from '@prisma/client';

export interface CreateChallengeDto {
  guildId: string;
  creatorId: string;
  format: ChallengeFormat;
  durationHours?: number;
  intensity?: ChallengeIntensity;
  team1UserIds: string[];
  team2UserIds: string[];
}

export interface CastVoteDto {
  challengeId: string;
  userId: string;
  topicVote?: TopicCategory;
  durationVoteHours?: number;
  intensityVote?: ChallengeIntensity;
}

export interface ChallengeEvaluationResult {
  challengeId: string;
  winningTeam: number | null; // 1, 2, or null (draw)
  team1RawScore: number;
  team1FinalScore: number;
  team2RawScore: number;
  team2FinalScore: number;
  mvpUserId: string | null;
  intensity: ChallengeIntensity;
}
