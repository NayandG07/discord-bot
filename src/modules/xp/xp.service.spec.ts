import { Test, TestingModule } from '@nestjs/testing';
import { XpService } from './xp.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProblemDifficulty, XpSource } from '@prisma/client';

describe('XpService (Anti-Farming & XP Engine)', () => {
  let service: XpService;

  const mockPrismaService = {
    xpConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue({
        id: 'global-xp-config',
        guildId: null,
        baseEasyXp: 25,
        baseMediumXp: 60,
        baseHardXp: 150,
        easyTier1Threshold: 10,
        easyTier2Threshold: 20,
        easyTier3Threshold: 30,
        easyFloorPercent: 50,
        streakBonusRate: 0.02,
        streakBonusCap: 0.50,
      }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XpService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<XpService>(XpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Anti-Farming Diminishing Returns Curve', () => {
    const config = {
      easyTier1Threshold: 10,
      easyTier2Threshold: 20,
      easyTier3Threshold: 30,
      easyFloorPercent: 50,
    };

    it('should grant 100% XP for solves 1 to 10', () => {
      expect(service.calculateDiminishingRate(1, config)).toBe(1.0);
      expect(service.calculateDiminishingRate(5, config)).toBe(1.0);
      expect(service.calculateDiminishingRate(10, config)).toBe(1.0);
    });

    it('should grant 80% XP for solves 11 to 20', () => {
      expect(service.calculateDiminishingRate(11, config)).toBe(0.80);
      expect(service.calculateDiminishingRate(15, config)).toBe(0.80);
      expect(service.calculateDiminishingRate(20, config)).toBe(0.80);
    });

    it('should grant 50% floor XP for solves > 20', () => {
      expect(service.calculateDiminishingRate(21, config)).toBe(0.50);
      expect(service.calculateDiminishingRate(35, config)).toBe(0.50);
    });
  });

  describe('Problem Solve XP Calculation', () => {
    it('should calculate Easy solve with zero streak and 0 prior solves (25 XP)', async () => {
      const result = await service.calculateProblemSolveXp({
        userId: 'user-1',
        difficulty: ProblemDifficulty.EASY,
        easySolvesIn24h: 0,
        currentStreakDays: 0,
      });

      expect(result.baseAmount).toBe(25);
      expect(result.diminishingRate).toBe(1.0);
      expect(result.finalAmount).toBe(25);
      expect(result.source).toBe(XpSource.PROBLEM_SOLVE);
    });

    it('should apply diminishing rate to Easy solve when 15 prior solves exist (20 XP)', async () => {
      const result = await service.calculateProblemSolveXp({
        userId: 'user-1',
        difficulty: ProblemDifficulty.EASY,
        easySolvesIn24h: 15, // 16th solve falls in Tier 2 (80%)
        currentStreakDays: 0,
      });

      expect(result.baseAmount).toBe(25);
      expect(result.diminishingRate).toBe(0.8);
      expect(result.finalAmount).toBe(20);
    });

    it('should not diminish Medium or Hard problems even with heavy solves', async () => {
      const medResult = await service.calculateProblemSolveXp({
        userId: 'user-1',
        difficulty: ProblemDifficulty.MEDIUM,
        easySolvesIn24h: 20,
        currentStreakDays: 0,
      });

      expect(medResult.baseAmount).toBe(60);
      expect(medResult.diminishingRate).toBe(1.0);
      expect(medResult.finalAmount).toBe(60);

      const hardResult = await service.calculateProblemSolveXp({
        userId: 'user-1',
        difficulty: ProblemDifficulty.HARD,
        easySolvesIn24h: 20,
        currentStreakDays: 0,
      });

      expect(hardResult.baseAmount).toBe(150);
      expect(hardResult.diminishingRate).toBe(1.0);
      expect(hardResult.finalAmount).toBe(150);
    });

    it('should grant streak multipliers capped at 50%', async () => {
      const result = await service.calculateProblemSolveXp({
        userId: 'user-1',
        difficulty: ProblemDifficulty.HARD,
        easySolvesIn24h: 0,
        currentStreakDays: 30, // 30 * 0.02 = 0.60, capped at 0.50 => 1.50 multiplier
      });

      expect(result.baseAmount).toBe(150);
      expect(result.multiplier).toBe(1.50);
      expect(result.finalAmount).toBe(Math.round(150 * 1.50));
    });
  });
});
