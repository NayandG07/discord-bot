export interface LeetCodeSubmissionItem {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
  statusDisplay: string;
  lang: string;
}

export interface LeetCodeUserProfile {
  username: string;
  realName: string | null;
  aboutMe: string | null;
  userAvatar: string | null;
  ranking: number | null;
  allQuestionsCount: {
    difficulty: string;
    count: number;
  }[];
  submitStats: {
    acSubmissionNum: {
      difficulty: string;
      count: number;
      submissions: number;
    }[];
  };
  streak?: number;
  totalActiveDays?: number;
}

export interface LeetCodeContestRanking {
  userContestRanking: {
    attendedContestsCount: number;
    rating: number;
    globalRanking: number;
    totalParticipants: number;
    topPercentage: number;
  } | null;
}

export interface QuestionDetails {
  questionId: string;
  title: string;
  titleSlug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topicTags: {
    name: string;
    slug: string;
  }[];
}
