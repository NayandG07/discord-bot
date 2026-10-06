import { Test, TestingModule } from '@nestjs/testing';
import { ReliabilityService } from './reliability.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RankTier } from '@prisma/client';

describe('ReliabilityService (Rank & Bounds)', () => {
  let service: ReliabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReliabilityService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<ReliabilityService>(ReliabilityService);
  });

  describe('Bounded Score Clamping', () => {
    it('should clamp score at maximum 100.00', () => {
      expect(service.calculateBoundedScore(98.5, 5.0)).toBe(100.0);
    });

    it('should clamp score at minimum 0.00', () => {
      expect(service.calculateBoundedScore(10.0, -25.0)).toBe(0.0);
    });

    it('should correctly increment within bounds', () => {
      expect(service.calculateBoundedScore(75.5, 3.0)).toBe(78.5);
    });
  });

  describe('Multi-Factor Rank Calculation', () => {
    it('should return BRONZE for 200 XP', () => {
      expect(service.determineRankTier(200, 100, 0, 0)).toBe(RankTier.BRONZE);
    });

    it('should return SILVER for 600 XP', () => {
      expect(service.determineRankTier(600, 100, 0, 0)).toBe(RankTier.SILVER);
    });

    it('should return GOLD for 1500 XP', () => {
      expect(service.determineRankTier(1500, 100, 0, 0)).toBe(RankTier.GOLD);
    });

    it('should return PLATINUM for 2800 XP with reliability >= 70', () => {
      expect(service.determineRankTier(2800, 75, 1, 1)).toBe(RankTier.PLATINUM);
    });

    it('should demote from DIAMOND to PLATINUM if reliability drops below 80 despite 5000 XP', () => {
      expect(service.determineRankTier(5000, 75, 2, 2)).toBe(RankTier.PLATINUM);
    });

    it('should award GRANDMASTER only when XP >= 12000, reliability >= 90, and contests/challenges criteria met', () => {
      expect(service.determineRankTier(13000, 95, 6, 8)).toBe(RankTier.GRANDMASTER);
    });

    it('should withhold GRANDMASTER if contest count is less than 5 despite 15000 XP', () => {
      // Falls back to Master
      expect(service.determineRankTier(15000, 95, 3, 8)).toBe(RankTier.MASTER);
    });
  });
});
