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
        baseEasyXp: 10,
        baseMediumXp: 30,
        baseHardXp: 75,
        easyTier1Threshold: 3,
        easyTier2Threshold: 6,
        easyTier3Threshold: 10,
        easyFloorPercent: 25,
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
      easyTier1Threshold: 3,
      easyTier2Threshold: 6,
      easyTier3Threshold: 10,
      easyFloorPercent: 25,
    };

    it('should grant 100% XP for solves 1 to 3', () => {
      expect(service.calculateDiminishingRate(1, config)).toBe(1.0);
      expect(service.calculateDiminishingRate(2, config)).toBe(1.0);
      expect(service.calculateDiminishingRate(3, config)).toBe(1.0);
    });

    it('should grant 75% XP for solves 4 to 6', () => {
      expect(service.calculateDiminishingRate(4, config)).toBe(0.75);
      expect(service.calculateDiminishingRate(5, config)).toBe(0.75);
      expect(service.calculateDiminishingRate(6, config)).toBe(0.75);
    });

    it('should grant 50% XP for solves 7 to 10', () => {
      expect(service.calculateDiminishingRate(7, config)).toBe(0.50);
      expect(service.calculateDiminishingRate(8, config)).toBe(0.50);
      expect(service.calculateDiminishingRate(10, config)).toBe(0.50);
    });

    it('should grant 25% floor XP for solves > 10', () => {
      expect(service.calculateDiminishingRate(11, config)).toBe(0.25);
      expect(service.calculateDiminishingRate(25, config)).toBe(0.25);
    });
  });

  describe('Problem Solve XP Calculation', () => {
    it('should calculate Easy solve with zero streak and 0 prior solves (10 XP)', async () => {
      const result = await service.calculateProblemSolveXp({
        userId: 'user-1',
        difficulty: ProblemDifficulty.EASY,
        easySolvesIn24h: 0,
        currentStreakDays: 0,
      });

      expect(result.baseAmount).toBe(10);
      expect(result.diminishingRate).toBe(1.0);
      expect(result.finalAmount).toBe(10);
      expect(result.source).toBe(XpSource.PROBLEM_SOLVE);
    });

    it('should apply diminishing rate to Easy solve when 7 prior solves exist (5 XP)', async () => {
      const result = await service.calculateProblemSolveXp({
        userId: 'user-1',
        difficulty: ProblemDifficulty.EASY,
        easySolvesIn24h: 7, // 8th solve falls in Tier 3 (50%)
        currentStreakDays: 0,
      });

      expect(result.baseAmount).toBe(10);
      expect(result.diminishingRate).toBe(0.5);
      expect(result.finalAmount).toBe(5);
    });

    it('should not diminish Medium or Hard problems even with heavy solves', async () => {
      const medResult = await service.calculateProblemSolveXp({
        userId: 'user-1',
        difficulty: ProblemDifficulty.MEDIUM,
        easySolvesIn24h: 20,
        currentStreakDays: 0,
      });

      expect(medResult.baseAmount).toBe(30);
      expect(medResult.diminishingRate).toBe(1.0);
      expect(medResult.finalAmount).toBe(30);

      const hardResult = await service.calculateProblemSolveXp({
        userId: 'user-1',
        difficulty: ProblemDifficulty.HARD,
        easySolvesIn24h: 20,
        currentStreakDays: 0,
      });

      expect(hardResult.baseAmount).toBe(75);
      expect(hardResult.diminishingRate).toBe(1.0);
      expect(hardResult.finalAmount).toBe(75);
    });

    it('should grant streak multipliers capped at 50%', async () => {
      const result = await service.calculateProblemSolveXp({
        userId: 'user-1',
        difficulty: ProblemDifficulty.HARD,
        easySolvesIn24h: 0,
        currentStreakDays: 30, // 30 * 0.02 = 0.60, capped at 0.50 => 1.50 multiplier
      });

      expect(result.baseAmount).toBe(75);
      expect(result.multiplier).toBe(1.50);
      expect(result.finalAmount).toBe(Math.round(75 * 1.50));
    });
  });
});
