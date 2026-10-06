import { ProblemDifficulty, TopicCategory } from '@prisma/client';

export interface IngestSubmissionDto {
  userId: string;
  guildId?: string;
  leetCodeSubmissionId: string;
  problemTitle: string;
  problemSlug: string;
  difficulty: ProblemDifficulty;
  topicTags: string[];
  submissionTimestamp: Date;
  runtimeMs?: number;
  memoryBytes?: bigint;
}

export interface ActivityCreatedEventPayload {
  activityId: string;
  userId: string;
  guildId?: string;
  difficulty: ProblemDifficulty;
  primaryTopic: TopicCategory;
  problemSlug: string;
  problemTitle: string;
  submissionTimestamp: Date;
}
