import { PrismaClient, AchievementCategory, AchievementTier, SeasonStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding DevGuild initial configurations and achievements...');

  // 1. Global Default XP Config
  await prisma.xpConfig.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
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
    },
  });

  // 2. Initial Built-in Achievements
  const achievements = [
    {
      code: 'FIRST_SOLVE',
      name: 'First Blood',
      description: 'Solve your first LeetCode problem as a guild member.',
      category: AchievementCategory.PROGRESSION,
      tier: AchievementTier.BRONZE,
      xpReward: 50,
      criteriaJson: { metric: 'TOTAL_SOLVES', operator: 'GTE', value: 1 },
    },
    {
      code: 'SOLVES_50',
      name: 'Apprentice Solver',
      description: 'Reach 50 verified solved problems.',
      category: AchievementCategory.PROGRESSION,
      tier: AchievementTier.SILVER,
      xpReward: 150,
      criteriaJson: { metric: 'TOTAL_SOLVES', operator: 'GTE', value: 50 },
    },
    {
      code: 'SOLVES_100',
      name: 'Centurion',
      description: 'Reach 100 verified solved problems.',
      category: AchievementCategory.PROGRESSION,
      tier: AchievementTier.GOLD,
      xpReward: 300,
      criteriaJson: { metric: 'TOTAL_SOLVES', operator: 'GTE', value: 100 },
    },
    {
      code: 'STREAK_7',
      name: 'Consistent Habit',
      description: 'Maintain a 7-day daily solve streak.',
      category: AchievementCategory.CONSISTENCY,
      tier: AchievementTier.BRONZE,
      xpReward: 100,
      criteriaJson: { metric: 'STREAK_DAYS', operator: 'GTE', value: 7 },
    },
    {
      code: 'STREAK_30',
      name: 'Iron Will',
      description: 'Maintain a 30-day daily solve streak.',
      category: AchievementCategory.CONSISTENCY,
      tier: AchievementTier.SILVER,
      xpReward: 400,
      criteriaJson: { metric: 'STREAK_DAYS', operator: 'GTE', value: 30 },
    },
    {
      code: 'HARD_HUNTER',
      name: 'Hard Hunter',
      description: 'Solve 10 Hard-difficulty problems.',
      category: AchievementCategory.DIFFICULTY,
      tier: AchievementTier.SILVER,
      xpReward: 250,
      criteriaJson: { metric: 'HARD_SOLVES', operator: 'GTE', value: 10 },
    },
    {
      code: 'TREE_SPECIALIST',
      name: 'Arborist',
      description: 'Solve 25 Tree-related algorithmic problems.',
      category: AchievementCategory.TOPICS,
      tier: AchievementTier.SILVER,
      xpReward: 200,
      criteriaJson: { metric: 'TOPIC_SOLVES', operator: 'GTE', value: 25, topic: 'TREES' },
    },
    {
      code: 'DP_SPECIALIST',
      name: 'Subproblem Sorcerer',
      description: 'Solve 30 Dynamic Programming problems.',
      category: AchievementCategory.TOPICS,
      tier: AchievementTier.GOLD,
      xpReward: 350,
      criteriaJson: { metric: 'TOPIC_SOLVES', operator: 'GTE', value: 30, topic: 'DYNAMIC_PROGRAMMING' },
    },
    {
      code: 'BOSS_SLAYER',
      name: 'Dragon Slayer',
      description: 'Participate in defeating a Weekly Contest Boss Battle.',
      category: AchievementCategory.CONTESTS,
      tier: AchievementTier.GOLD,
      xpReward: 400,
      criteriaJson: { metric: 'BOSS_BATTLES_DEFEATED', operator: 'GTE', value: 1 },
    },
    {
      code: 'TEAM_CAPTAIN',
      name: 'Vanguard Commander',
      description: 'Found and lead a guild squad.',
      category: AchievementCategory.CHALLENGES,
      tier: AchievementTier.SILVER,
      xpReward: 150,
      criteriaJson: { metric: 'IS_TEAM_LEADER', operator: 'EQ', value: true },
    },
  ];

  for (const ach of achievements) {
    await prisma.achievement.upsert({
      where: { code: ach.code },
      update: ach,
      create: ach,
    });
  }

  // 3. Genesis Season 1
  const seasonStarts = new Date();
  const seasonEnds = new Date(seasonStarts.getTime() + 90 * 24 * 60 * 60 * 1000);

  await prisma.season.upsert({
    where: { number: 1 },
    update: {},
    create: {
      number: 1,
      name: 'Season 1: Genesis of the Guild',
      status: SeasonStatus.ACTIVE,
      startsAt: seasonStarts,
      endsAt: seasonEnds,
    },
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
