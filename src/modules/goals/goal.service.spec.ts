import { Test, TestingModule } from '@nestjs/testing';
import { GoalService } from './goal.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReliabilityService } from '../reliability/reliability.service';
import { GoalPeriod, GoalStatus, XpSource, ProblemDifficulty } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('GoalService', () => {
  let service: GoalService;
  let prisma: any;
  let reliability: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      guild: {
        findUnique: jest.fn(),
      },
      guildMember: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      activity: {
        count: jest.fn(),
      },
      userGoal: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      xPTransactions: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    reliability = {
      updateReliability: jest.fn().mockResolvedValue(true),
      refreshGuildMemberRank: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReliabilityService, useValue: reliability },
      ],
    }).compile();

    service = module.get<GoalService>(GoalService);
  });

  describe('calculateGoalWindow', () => {
    it('calculates daily window covering 00:00:00 to 23:59:59 UTC', () => {
      const refDate = new Date('2026-10-08T14:30:00Z');
      const { startsAt, endsAt } = service.calculateGoalWindow(GoalPeriod.DAY, refDate);

      expect(startsAt.toISOString()).toBe('2026-10-08T00:00:00.000Z');
      expect(endsAt.toISOString()).toBe('2026-10-08T23:59:59.999Z');
    });

    it('calculates weekly window covering Monday to Sunday UTC', () => {
      // 2026-10-08 is Thursday
      const refDate = new Date('2026-10-08T14:30:00Z');
      const { startsAt, endsAt } = service.calculateGoalWindow(GoalPeriod.WEEK, refDate);

      expect(startsAt.toISOString()).toBe('2026-10-05T00:00:00.000Z'); // Monday
      expect(endsAt.toISOString()).toBe('2026-10-11T23:59:59.999Z'); // Sunday
    });
  });

  describe('setGoal', () => {
    it('throws BadRequestException if targetCount is less than 1', async () => {
      await expect(
        service.setGoal({
          discordUserId: 'user-123',
          period: GoalPeriod.DAY,
          targetCount: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if targetCount exceeds max for period', async () => {
      await expect(
        service.setGoal({
          discordUserId: 'user-123',
          period: GoalPeriod.DAY,
          targetCount: 60,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if user is not registered', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.setGoal({
          discordUserId: 'non-existent',
          period: GoalPeriod.DAY,
          targetCount: 3,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a new active daily goal when user exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', discordId: 'user-123' });
      prisma.activity.count.mockResolvedValue(1);
      prisma.userGoal.findFirst.mockResolvedValue(null);
      prisma.userGoal.create.mockImplementation(({ data }: any) => ({
        id: 'goal-uuid',
        ...data,
      }));

      const result = await service.setGoal({
        discordUserId: 'user-123',
        period: GoalPeriod.DAY,
        targetCount: 3,
      });

      expect(result.targetCount).toBe(3);
      expect(result.currentCount).toBe(1);
      expect(result.remaining).toBe(2);
      expect(result.status).toBe(GoalStatus.ACTIVE);
      expect(result.penaltyXp).toBe(50);
      expect(result.penaltyReliability).toBe(5.0);
    });
  });

  describe('cancelGoal', () => {
    it('cancels active goals for user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', discordId: 'user-123' });
      prisma.userGoal.updateMany.mockResolvedValue({ count: 1 });

      const count = await service.cancelGoal('user-123', GoalPeriod.DAY);
      expect(count).toBe(1);
      expect(prisma.userGoal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: GoalStatus.CANCELLED },
        }),
      );
    });
  });

  describe('evaluateExpiredGoals & Penalties', () => {
    it('marks goal COMPLETED with no bonuses if target was reached before expiration', async () => {
      const expiredGoal = {
        id: 'goal-1',
        userId: 'user-1',
        period: GoalPeriod.DAY,
        targetCount: 3,
        startsAt: new Date(Date.now() - 24 * 3600 * 1000),
        endsAt: new Date(Date.now() - 1000),
        user: { username: 'suraj', discordId: 'discord-suraj' },
      };

      prisma.userGoal.findMany.mockResolvedValue([expiredGoal]);
      prisma.activity.count.mockResolvedValue(3); // target met

      const evalResult = await service.evaluateExpiredGoals();

      expect(evalResult.completedGoals).toBe(1);
      expect(evalResult.failedGoals).toBe(0);
      expect(prisma.userGoal.update).toHaveBeenCalledWith({
        where: { id: 'goal-1' },
        data: expect.objectContaining({ status: GoalStatus.COMPLETED }),
      });
      // No bonus transactions
      expect(prisma.xPTransactions.create).not.toHaveBeenCalled();
    });

    it('enforces penalties when target is missed upon expiration (penalises XP and reliability)', async () => {
      const expiredGoal = {
        id: 'goal-2',
        userId: 'user-1',
        guildId: 'guild-1',
        period: GoalPeriod.DAY,
        targetCount: 5,
        startsAt: new Date(Date.now() - 24 * 3600 * 1000),
        endsAt: new Date(Date.now() - 1000),
        user: { username: 'nayan', discordId: 'discord-nayan' },
        guild: { discordGuildId: 'guild-discord', notificationConfig: { activityChannelId: 'alert-chan' } },
      };

      prisma.userGoal.findMany.mockResolvedValue([expiredGoal]);
      prisma.activity.count.mockResolvedValue(2); // missed target (2/5)
      prisma.guildMember.findUnique.mockResolvedValue({ id: 'member-1', guildXp: BigInt(500) });

      const evalResult = await service.evaluateExpiredGoals();

      expect(evalResult.failedGoals).toBe(1);
      expect(evalResult.penalties).toHaveLength(1);
      expect(evalResult.penalties[0].penaltyXp).toBe(50);
      expect(evalResult.penalties[0].penaltyReliability).toBe(5.0);

      // Verify negative XP transaction
      expect(prisma.xPTransactions.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: XpSource.GOAL_PENALTY,
          baseAmount: -50,
          finalAmount: -50,
        }),
      });

      // Verify guild member XP deduction
      expect(prisma.guildMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { guildXp: BigInt(450) },
      });

      // Verify reliability deduction
      expect(reliability.updateReliability).toHaveBeenCalledWith('user-1', -5.0);
      expect(reliability.refreshGuildMemberRank).toHaveBeenCalledWith('guild-1', 'user-1');
    });
  });

  describe('handleActivityCreated event listener', () => {
    it('updates live goal progress and marks completed when target reached (no bonuses)', async () => {
      const activeGoal = {
        id: 'goal-3',
        userId: 'user-1',
        period: GoalPeriod.DAY,
        targetCount: 2,
        startsAt: new Date(Date.now() - 3600 * 1000),
        endsAt: new Date(Date.now() + 3600 * 1000),
      };

      prisma.userGoal.findMany.mockResolvedValue([activeGoal]);
      prisma.activity.count.mockResolvedValue(2); // just hit 2

      await service.handleActivityCreated({
        activityId: 'act-1',
        userId: 'user-1',
        difficulty: ProblemDifficulty.MEDIUM,
        primaryTopic: 'ARRAYS' as any,
        problemSlug: 'two-sum',
        problemTitle: 'Two Sum',
        submissionTimestamp: new Date(),
        xpAwarded: 60,
      });

      expect(prisma.userGoal.update).toHaveBeenCalledWith({
        where: { id: 'goal-3' },
        data: expect.objectContaining({
          currentCount: 2,
          status: GoalStatus.COMPLETED,
        }),
      });
      // Verified: no bonus XP awarded!
      expect(prisma.xPTransactions.create).not.toHaveBeenCalled();
    });
  });
});
