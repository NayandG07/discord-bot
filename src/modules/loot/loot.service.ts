import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProblemDifficulty } from '@prisma/client';
import {
  COLLECTIBLE_CATALOG,
  CollectibleItemDefinition,
  CRATE_META,
  LOOT_RARITY_CONFIG,
  LootCategory,
  LootCrateType,
  LootRarity,
  LootRarityConfig,
} from './loot.types';

export interface LootDropResult {
  item: CollectibleItemDefinition;
  rarityConfig: LootRarityConfig;
  crateType: LootCrateType;
  crateName: string;
  crateEmoji: string;
  reasonLabel: string;
  isNewUnlock: boolean;
  newCount: number;
  stars: number;
  starDisplay: string;
  itemPower: number;
}

export interface UserInventorySummary {
  username: string;
  avatarUrl?: string | null;
  totalPower: number;
  uniqueUnlocked: number;
  totalCatalogSize: number;
  totalItemsCollected: number;
  rarityCounts: Record<LootRarity, number>;
  items: Array<{
    item: CollectibleItemDefinition;
    rarityConfig: LootRarityConfig;
    count: number;
    stars: number;
    starDisplay: string;
    power: number;
    obtainedAt: Date;
  }>;
}

@Injectable()
export class LootService {
  private readonly logger = new Logger(LootService.name);

  constructor(private readonly prisma: PrismaService) {}

  calculateStars(count: number): { stars: number; starDisplay: string } {
    const stars = Math.min(5, Math.max(1, count));
    const filled = '★'.repeat(stars);
    const empty = '☆'.repeat(5 - stars);
    return { stars, starDisplay: `${filled}${empty}` };
  }

  calculateItemPower(rarity: LootRarity, count: number): number {
    const base = LOOT_RARITY_CONFIG[rarity].basePower;
    const { stars } = this.calculateStars(count);
    // Each duplicate star adds +25% ascension power
    return Math.round(base * (1 + (stars - 1) * 0.25));
  }

  private rollRarity(crateType: LootCrateType): LootRarity {
    const weights = CRATE_META[crateType].weights;
    const entries = Object.entries(weights) as Array<[LootRarity, number]>;
    const totalWeight = entries.reduce((acc, [, w]) => acc + w, 0);
    let rand = Math.random() * totalWeight;

    for (const [rarity, weight] of entries) {
      if (weight <= 0) continue;
      if (rand < weight) {
        return rarity;
      }
      rand -= weight;
    }
    return 'COMMON';
  }

  private pickCollectible(rarity: LootRarity, preferredCategory?: LootCategory): CollectibleItemDefinition {
    let pool = COLLECTIBLE_CATALOG.filter((i) => i.rarity === rarity);
    if (preferredCategory) {
      const catPool = pool.filter((i) => i.category === preferredCategory);
      if (catPool.length > 0) pool = catPool;
    }
    if (pool.length === 0) {
      pool = COLLECTIBLE_CATALOG;
    }
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  }

  async rollAndGrantDrop(
    userId: string,
    crateType: LootCrateType,
    reasonLabel: string,
    preferredCategory?: LootCategory,
  ): Promise<LootDropResult> {
    const rarity = this.rollRarity(crateType);
    const item = this.pickCollectible(rarity, preferredCategory);
    const rarityConfig = LOOT_RARITY_CONFIG[item.rarity];
    const crateMeta = CRATE_META[crateType];

    const existing = await this.prisma.userLootDrop.findUnique({
      where: {
        userId_itemCode: {
          userId,
          itemCode: item.code,
        },
      },
    });

    const isNewUnlock = !existing;
    const saved = await this.prisma.userLootDrop.upsert({
      where: {
        userId_itemCode: {
          userId,
          itemCode: item.code,
        },
      },
      update: {
        count: { increment: 1 },
        source: reasonLabel,
      },
      create: {
        userId,
        itemCode: item.code,
        itemName: item.name,
        category: item.category,
        rarity: item.rarity,
        source: reasonLabel,
        count: 1,
      },
    });

    const { stars, starDisplay } = this.calculateStars(saved.count);
    const itemPower = this.calculateItemPower(item.rarity, saved.count);

    this.logger.log(
      `Granted loot drop [${item.rarity}] "${item.name}" (x${saved.count}, ${starDisplay}) to user ${userId} via ${crateType}`,
    );

    return {
      item,
      rarityConfig,
      crateType,
      crateName: crateMeta.name,
      crateEmoji: crateMeta.emoji,
      reasonLabel,
      isNewUnlock,
      newCount: saved.count,
      stars,
      starDisplay,
      itemPower,
    };
  }

  /**
   * Evaluates whether a newly ingested problem solve triggers a Loot Crate drop.
   */
  async evaluateSolveLootDrop(params: {
    userId: string;
    difficulty: ProblemDifficulty;
    currentStreak: number;
    isContestRaidHit: boolean;
  }): Promise<LootDropResult | null> {
    const { userId, difficulty, currentStreak, isContestRaidHit } = params;

    // 1. Contest Boss Raid hit -> 100% guaranteed Boss Raid Chest!
    if (isContestRaidHit) {
      return this.rollAndGrantDrop(userId, 'BOSS_RAID_CHEST', '👹 Contest Boss Raid Strike');
    }

    // 2. Check if this is the user's first solve of the UTC day
    const now = new Date();
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const solvesToday = await this.prisma.activity.count({
      where: {
        userId,
        submissionTimestamp: { gte: startOfTodayUtc },
      },
    });

    const isStreakMilestone = [3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 180, 365].includes(currentStreak);
    if (solvesToday <= 1 && isStreakMilestone) {
      return this.rollAndGrantDrop(
        userId,
        'STREAK_CHEST',
        `🔥 ${currentStreak}-Day Streak Milestone`,
        'COMPANION',
      );
    }

    // 3. Hard problem solve -> 80% chance for Grandmaster Arcane Cache
    if (difficulty === ProblemDifficulty.HARD && Math.random() < 0.8) {
      return this.rollAndGrantDrop(userId, 'HARD_SOLVE_CACHE', '🟥 Hard Algorithm Conquered');
    }

    // 4. First solve of the day -> 100% guaranteed Daily Supply Crate
    if (solvesToday <= 1) {
      return this.rollAndGrantDrop(userId, 'STANDARD_CRATE', '⚡ Daily First-Blood Supply Drop');
    }

    // 5. Medium (40%) or Easy (25%) random drop chance on additional solves
    const chance = difficulty === ProblemDifficulty.MEDIUM ? 0.4 : 0.25;
    if (Math.random() < chance) {
      return this.rollAndGrantDrop(userId, 'STANDARD_CRATE', '💻 Bonus Problem-Solve Loot Drop');
    }

    return null;
  }

  /**
   * Grants a guaranteed Loot Crate upon completing a Daily or Weekly Goal.
   */
  async grantGoalCompletionDrop(
    userId: string,
    period: 'DAY' | 'WEEK',
    targetCount: number,
  ): Promise<LootDropResult> {
    const crateType: LootCrateType = period === 'WEEK' ? 'WEEKLY_VAULT' : 'DAILY_GOAL_CRATE';
    const label =
      period === 'WEEK'
        ? `🏛️ Weekly Goal Completed (${targetCount}/${targetCount} Solved)`
        : `🎯 Daily Goal Completed (${targetCount}/${targetCount} Solved)`;
    return this.rollAndGrantDrop(userId, crateType, label);
  }

  /**
   * Retrieves a user's full Armory, Companion Zoo, and Relic inventory.
   */
  async getUserInventory(
    discordUserId: string,
    categoryFilter?: LootCategory,
  ): Promise<UserInventorySummary> {
    const user = await this.prisma.user.findUnique({
      where: { discordId: discordUserId },
      include: {
        lootDrops: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not registered. Please run `/link` first.');
    }

    const catalogMap = new Map<string, CollectibleItemDefinition>(
      COLLECTIBLE_CATALOG.map((item) => [item.code, item]),
    );

    const rarityCounts: Record<LootRarity, number> = {
      COMMON: 0,
      UNCOMMON: 0,
      RARE: 0,
      EPIC: 0,
      LEGENDARY: 0,
      MYTHIC: 0,
    };

    let totalPower = 0;
    let totalItemsCollected = 0;

    const mappedItems = user.lootDrops
      .map((drop) => {
        const def = catalogMap.get(drop.itemCode);
        if (!def) return null;
        const rarityConfig = LOOT_RARITY_CONFIG[def.rarity];
        const { stars, starDisplay } = this.calculateStars(drop.count);
        const power = this.calculateItemPower(def.rarity, drop.count);

        rarityCounts[def.rarity] = (rarityCounts[def.rarity] || 0) + 1;
        totalPower += power;
        totalItemsCollected += drop.count;

        return {
          item: def,
          rarityConfig,
          count: drop.count,
          stars,
          starDisplay,
          power,
          obtainedAt: drop.obtainedAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const filteredItems = categoryFilter
      ? mappedItems.filter((x) => x.item.category === categoryFilter)
      : mappedItems;

    // Sort by rarity descending, then power descending
    filteredItems.sort((a, b) => {
      const rDiff = b.rarityConfig.sortOrder - a.rarityConfig.sortOrder;
      if (rDiff !== 0) return rDiff;
      return b.power - a.power;
    });

    return {
      username: user.username,
      avatarUrl: user.avatarUrl,
      totalPower,
      uniqueUnlocked: mappedItems.length,
      totalCatalogSize: COLLECTIBLE_CATALOG.length,
      totalItemsCollected,
      rarityCounts,
      items: filteredItems,
    };
  }
}
