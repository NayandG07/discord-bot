import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { RedisService } from '../../common/redis/redis.service';
import {
  LeetCodeSubmissionItem,
  LeetCodeUserProfile,
  LeetCodeContestRanking,
  QuestionDetails,
} from './leetcode.types';

@Injectable()
export class LeetCodeService {
  private readonly logger = new Logger(LeetCodeService.name);
  private readonly client: AxiosInstance;
  private readonly endpoint = 'https://leetcode.com/graphql';

  constructor(private readonly redisService: RedisService) {
    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 DevGuildBot/1.0',
        Referer: 'https://leetcode.com',
      },
    });
  }

  async checkRateLimit(key: string, limit = 10, windowSec = 60): Promise<boolean> {
    try {
      const redis = this.redisService.getClient();
      if (!redis) return true;
      const redisKey = `devguild:rate:leetcode:${key}`;
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.expire(redisKey, windowSec);
      }
      return count <= limit;
    } catch (err: any) {
      this.logger.warn(`Redis rate limit check error (failing open): ${err.message}`);
      return true;
    }
  }

  async fetchUserProfile(username: string): Promise<LeetCodeUserProfile> {
    const allowed = await this.checkRateLimit(`profile:${username}`);
    if (!allowed) {
      throw new HttpException(
        'LeetCode rate limit reached. Please retry in a few moments.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            realName
            aboutMe
            userAvatar
            ranking
          }
          submitStats {
            acSubmissionNum {
              difficulty
              count
              submissions
            }
          }
        }
        allQuestionsCount {
          difficulty
          count
        }
      }
    `;

    try {
      const response = await this.client.post('', {
        query,
        variables: { username },
      });

      const data = response.data?.data;
      if (!data || !data.matchedUser) {
        throw new HttpException(
          `LeetCode user '${username}' not found.`,
          HttpStatus.NOT_FOUND,
        );
      }

      const user = data.matchedUser;
      return {
        username: user.username,
        realName: user.profile?.realName || null,
        aboutMe: user.profile?.aboutMe || null,
        userAvatar: user.profile?.userAvatar || null,
        ranking: user.profile?.ranking || null,
        allQuestionsCount: data.allQuestionsCount || [],
        submitStats: user.submitStats || { acSubmissionNum: [] },
      };
    } catch (err: any) {
      this.logger.error(`Error querying profile for ${username}: ${err.message}`);
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        'Failed to connect to LeetCode service.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async fetchRecentSubmissions(username: string, limit = 20): Promise<LeetCodeSubmissionItem[]> {
    const query = `
      query getRecentSubmissions($username: String!, $limit: Int!) {
        recentSubmissionList(username: $username, limit: $limit) {
          id
          title
          titleSlug
          timestamp
          statusDisplay
          lang
        }
      }
    `;

    try {
      const response = await this.client.post('', {
        query,
        variables: { username, limit },
      });

      const list = response.data?.data?.recentSubmissionList;
      return list || [];
    } catch (err: any) {
      this.logger.error(`Error fetching submissions for ${username}: ${err.message}`);
      return [];
    }
  }

  async fetchContestRanking(username: string): Promise<LeetCodeContestRanking['userContestRanking']> {
    const query = `
      query getUserContestRanking($username: String!) {
        userContestRanking(username: $username) {
          attendedContestsCount
          rating
          globalRanking
          totalParticipants
          topPercentage
        }
      }
    `;

    try {
      const response = await this.client.post('', {
        query,
        variables: { username },
      });

      return response.data?.data?.userContestRanking || null;
    } catch (err: any) {
      this.logger.error(`Error fetching contest rankings for ${username}: ${err.message}`);
      return null;
    }
  }

  async fetchQuestionDetails(titleSlug: string): Promise<QuestionDetails | null> {
    const cacheKey = `devguild:cache:question:${titleSlug}`;
    const cached = await this.redisService.get<QuestionDetails>(cacheKey);
    if (cached) return cached;

    const query = `
      query getQuestionDetails($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
          title
          titleSlug
          difficulty
          topicTags {
            name
            slug
          }
        }
      }
    `;

    try {
      const response = await this.client.post('', {
        query,
        variables: { titleSlug },
      });

      const q = response.data?.data?.question;
      if (!q) return null;

      const details: QuestionDetails = {
        questionId: q.questionId,
        title: q.title,
        titleSlug: q.titleSlug,
        difficulty: q.difficulty,
        topicTags: q.topicTags || [],
      };

      // Cache problem details for 7 days (problems rarely change difficulty/tags)
      await this.redisService.set(cacheKey, details, 604800);
      return details;
    } catch (err: any) {
      this.logger.error(`Error fetching details for question ${titleSlug}: ${err.message}`);
      return null;
    }
  }
}
