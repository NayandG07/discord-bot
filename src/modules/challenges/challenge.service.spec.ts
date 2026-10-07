import { Test, TestingModule } from '@nestjs/testing';
import { ChallengeService } from './challenge.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ProblemDifficulty, TopicCategory, ChallengeIntensity } from '@prisma/client';

describe('ChallengeService (Scoring & Normalization)', () => {
  let service: ChallengeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengeService,
        { provide: PrismaService, useValue: {} },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    service = module.get<ChallengeService>(ChallengeService);
  });

  describe('Point Calculation Formula', () => {
    it('should award base points for non-matching topic on Casual intensity', () => {
      const easyPts = service.calculateProblemPoints(
        ProblemDifficulty.EASY,
        TopicCategory.ARRAYS,
        TopicCategory.DYNAMIC_PROGRAMMING,
        ChallengeIntensity.CASUAL,
      );
      expect(easyPts).toBe(10);

      const medPts = service.calculateProblemPoints(
        ProblemDifficulty.MEDIUM,
        TopicCategory.ARRAYS,
        TopicCategory.DYNAMIC_PROGRAMMING,
        ChallengeIntensity.CASUAL,
      );
      expect(medPts).toBe(30);

      const hardPts = service.calculateProblemPoints(
        ProblemDifficulty.HARD,
        TopicCategory.ARRAYS,
        TopicCategory.DYNAMIC_PROGRAMMING,
        ChallengeIntensity.CASUAL,
      );
      expect(hardPts).toBe(75);
    });

    it('should award 1.5x bonus for matching topic category', () => {
      const medPts = service.calculateProblemPoints(
        ProblemDifficulty.MEDIUM,
        TopicCategory.DYNAMIC_PROGRAMMING,
        TopicCategory.DYNAMIC_PROGRAMMING,
        ChallengeIntensity.CASUAL,
      );
      expect(medPts).toBe(45); // 30 * 1.5 = 45
    });

    it('should award 0 points for Easy problems on Hardcore intensity', () => {
      const easyHardcore = service.calculateProblemPoints(
        ProblemDifficulty.EASY,
        TopicCategory.ARRAYS,
        TopicCategory.ARRAYS,
        ChallengeIntensity.HARDCORE,
      );
      expect(easyHardcore).toBe(0);
    });

    it('should apply 1.5x multiplier for Hard problems on Hardcore intensity with matching topic', () => {
      const hardHardcore = service.calculateProblemPoints(
        ProblemDifficulty.HARD,
        TopicCategory.TREES,
        TopicCategory.TREES,
        ChallengeIntensity.HARDCORE,
      );
      // Base: 75, Topic: 1.5 -> 112.5, Intensity: 1.5 -> 168.75
      expect(hardHardcore).toBe(168.75);
    });
  });

  describe('Uneven Team Normalization Formula', () => {
    it('should return identical raw scores when team sizes are equal (2v2)', () => {
      const { team1Final, team2Final } = service.normalizeTeamScores(100, 2, 80, 2);
      expect(team1Final).toBe(100);
      expect(team2Final).toBe(80);
    });

    it('should fairly balance a 3v2 match using sub-linear elastic power 0.75', () => {
      // Team 1 has 3 players with raw 150 (avg 50/player)
      // Team 2 has 2 players with raw 100 (avg 50/player)
      const { team1Final, team2Final } = service.normalizeTeamScores(150, 3, 100, 2);
      // Both teams performed at identical per-player efficiency (50 pts/player).
      // With power 0.75 normalization, team 1 final should equal team 2 final closely within 15 points.
      expect(Math.abs(team1Final - team2Final)).toBeLessThan(15);
    });
  });
});
