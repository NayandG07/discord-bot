import { Test, TestingModule } from '@nestjs/testing';
import { AchievementService } from './achievement.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserAggregates } from './achievement.types';

describe('AchievementService (Criteria Evaluation)', () => {
  let service: AchievementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<AchievementService>(AchievementService);
  });

  const mockAggregates: UserAggregates = {
    totalSolves: 105,
    hardSolves: 12,
    streakDays: 8,
    challengesWon: 3,
    contestsEntered: 2,
    bossBattlesDefeated: 1,
    topicSolvesMap: new Map([
      ['TREES', 26],
      ['DYNAMIC_PROGRAMMING', 15],
    ]),
    isTeamLeader: true,
  };

  it('should unlock FIRST_SOLVE when total solves >= 1', () => {
    const result = service.evaluateCriteria(
      { metric: 'TOTAL_SOLVES', operator: 'GTE', value: 1 },
      mockAggregates,
    );
    expect(result).toBe(true);
  });

  it('should unlock 7_DAY_STREAK when streak >= 7', () => {
    const result = service.evaluateCriteria(
      { metric: 'STREAK_DAYS', operator: 'GTE', value: 7 },
      mockAggregates,
    );
    expect(result).toBe(true);
  });

  it('should fail 30_DAY_STREAK when streak is only 8', () => {
    const result = service.evaluateCriteria(
      { metric: 'STREAK_DAYS', operator: 'GTE', value: 30 },
      mockAggregates,
    );
    expect(result).toBe(false);
  });

  it('should unlock HARD_HUNTER when hard solves >= 10', () => {
    const result = service.evaluateCriteria(
      { metric: 'HARD_SOLVES', operator: 'GTE', value: 10 },
      mockAggregates,
    );
    expect(result).toBe(true);
  });

  it('should unlock TREE_SPECIALIST when tree solves >= 25', () => {
    const result = service.evaluateCriteria(
      { metric: 'TOPIC_SOLVES', operator: 'GTE', value: 25, topic: 'TREES' },
      mockAggregates,
    );
    expect(result).toBe(true);
  });

  it('should unlock TEAM_CAPTAIN when isTeamLeader == true', () => {
    const result = service.evaluateCriteria(
      { metric: 'IS_TEAM_LEADER', operator: 'EQ', value: true },
      mockAggregates,
    );
    expect(result).toBe(true);
  });
});
