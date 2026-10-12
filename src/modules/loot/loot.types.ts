export type LootCategory = 'WEAPON' | 'COMPANION' | 'RELIC';

export type LootRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';

export type LootCrateType =
  | 'STANDARD_CRATE'
  | 'DAILY_GOAL_CRATE'
  | 'WEEKLY_VAULT'
  | 'STREAK_CHEST'
  | 'BOSS_RAID_CHEST'
  | 'HARD_SOLVE_CACHE';

export interface LootRarityConfig {
  rarity: LootRarity;
  label: string;
  badge: string;
  color: number;
  basePower: number;
  bonusXp: number;
  sortOrder: number;
}

export const LOOT_RARITY_CONFIG: Record<LootRarity, LootRarityConfig> = {
  COMMON: {
    rarity: 'COMMON',
    label: 'Common',
    badge: '⚪ Common',
    color: 0x95a5a6,
    basePower: 15,
    bonusXp: 5,
    sortOrder: 1,
  },
  UNCOMMON: {
    rarity: 'UNCOMMON',
    label: 'Uncommon',
    badge: '🟢 Uncommon',
    color: 0x2ecc71,
    basePower: 35,
    bonusXp: 12,
    sortOrder: 2,
  },
  RARE: {
    rarity: 'RARE',
    label: 'Rare',
    badge: '🔵 Rare',
    color: 0x3498db,
    basePower: 85,
    bonusXp: 25,
    sortOrder: 3,
  },
  EPIC: {
    rarity: 'EPIC',
    label: 'Epic',
    badge: '🟣 Epic',
    color: 0x9b59b6,
    basePower: 220,
    bonusXp: 60,
    sortOrder: 4,
  },
  LEGENDARY: {
    rarity: 'LEGENDARY',
    label: 'Legendary',
    badge: '🟠 Legendary',
    color: 0xf39c12,
    basePower: 600,
    bonusXp: 150,
    sortOrder: 5,
  },
  MYTHIC: {
    rarity: 'MYTHIC',
    label: 'Mythic',
    badge: '🔴 Mythic',
    color: 0xe74c3c,
    basePower: 1800,
    bonusXp: 400,
    sortOrder: 6,
  },
};

export const CRATE_META: Record<
  LootCrateType,
  { name: string; emoji: string; weights: Record<LootRarity, number> }
> = {
  STANDARD_CRATE: {
    name: 'Algorithmic Supply Crate',
    emoji: '📦',
    weights: { COMMON: 48, UNCOMMON: 28, RARE: 14, EPIC: 7, LEGENDARY: 2.5, MYTHIC: 0.5 },
  },
  DAILY_GOAL_CRATE: {
    name: 'Daily Accountability Chest',
    emoji: '🎯',
    weights: { COMMON: 30, UNCOMMON: 34, RARE: 20, EPIC: 11, LEGENDARY: 4, MYTHIC: 1 },
  },
  WEEKLY_VAULT: {
    name: 'Weekly Sovereign Vault',
    emoji: '🏛️',
    weights: { COMMON: 0, UNCOMMON: 15, RARE: 45, EPIC: 26, LEGENDARY: 11, MYTHIC: 3 },
  },
  STREAK_CHEST: {
    name: 'Inferno Streak Reliquary',
    emoji: '🔥',
    weights: { COMMON: 10, UNCOMMON: 30, RARE: 35, EPIC: 16, LEGENDARY: 7, MYTHIC: 2 },
  },
  BOSS_RAID_CHEST: {
    name: 'Leviathan Raid Spoils',
    emoji: '👹',
    weights: { COMMON: 0, UNCOMMON: 10, RARE: 45, EPIC: 28, LEGENDARY: 13, MYTHIC: 4 },
  },
  HARD_SOLVE_CACHE: {
    name: 'Grandmaster Arcane Cache',
    emoji: '💎',
    weights: { COMMON: 15, UNCOMMON: 30, RARE: 30, EPIC: 16, LEGENDARY: 7, MYTHIC: 2 },
  },
};

export interface CollectibleItemDefinition {
  code: string;
  name: string;
  category: LootCategory;
  rarity: LootRarity;
  iconEmoji: string;
  iconUrl: string;
  passiveStat: string;
  lore: string;
}

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72';

export const COLLECTIBLE_CATALOG: CollectibleItemDefinition[] = [
  // ==========================================
  // WEAPONS (8 Items)
  // ==========================================
  {
    code: 'WPN_POINTER_DAGGER',
    name: 'Rusty Null-Pointer Dagger',
    category: 'WEAPON',
    rarity: 'COMMON',
    iconEmoji: '🗡️',
    iconUrl: `${TWEMOJI_BASE}/1f5e1.png`,
    passiveStat: '+15 Armory Power • +1% Easy Solve Crit',
    lore: 'Forged from dereferenced memory addresses. Sharp enough to slice through O(N²) loops.',
  },
  {
    code: 'WPN_TWO_POINTER_TWINBLADES',
    name: 'Two-Pointer Twinblades',
    category: 'WEAPON',
    rarity: 'UNCOMMON',
    iconEmoji: '⚔️',
    iconUrl: `${TWEMOJI_BASE}/2694.png`,
    passiveStat: '+35 Armory Power • Converges from both ends',
    lore: 'Left and Right blades that meet in the middle in linear O(N) time.',
  },
  {
    code: 'WPN_BINARY_KATANA',
    name: 'Binary Search Katana',
    category: 'WEAPON',
    rarity: 'RARE',
    iconEmoji: '🔪',
    iconUrl: `${TWEMOJI_BASE}/1f52a.png`,
    passiveStat: '+85 Armory Power • Halves Boss Armor in O(log N)',
    lore: 'Every swing eliminates half of the battlefield with surgical precision.',
  },
  {
    code: 'WPN_MONOTONIC_HALBERD',
    name: 'Monotonic Stack Halberd',
    category: 'WEAPON',
    rarity: 'RARE',
    iconEmoji: '🔱',
    iconUrl: `${TWEMOJI_BASE}/1f531.png`,
    passiveStat: '+85 Armory Power • Pops weaker foes instantly',
    lore: 'Maintains strict increasing order; anything smaller is popped into oblivion.',
  },
  {
    code: 'WPN_SEGFAULT_WARHAMMER',
    name: 'Segfault Core-Dump Warhammer',
    category: 'WEAPON',
    rarity: 'EPIC',
    iconEmoji: '🔨',
    iconUrl: `${TWEMOJI_BASE}/1f528.png`,
    passiveStat: '+220 Armory Power • Crushes stack frames on impact',
    lore: 'Deals massive blunt-force trauma to unprepared memory buffers.',
  },
  {
    code: 'WPN_DIJKSTRA_LONGBOW',
    name: "Dijkstra's Shortest-Path Longbow",
    category: 'WEAPON',
    rarity: 'EPIC',
    iconEmoji: '🏹',
    iconUrl: `${TWEMOJI_BASE}/1f3f9.png`,
    passiveStat: '+220 Armory Power • Never misses the optimal route',
    lore: 'Guided by a priority queue, its arrows always find the minimum-weight trajectory.',
  },
  {
    code: 'WPN_TARJAN_SCYTHE',
    name: "Tarjan's Strongly-Connected Scythe",
    category: 'WEAPON',
    rarity: 'LEGENDARY',
    iconEmoji: '⚡',
    iconUrl: `${TWEMOJI_BASE}/26a1.png`,
    passiveStat: '+600 Armory Power • Severs cyclic graph components',
    lore: 'Harvests entire strongly connected components in a single depth-first sweep.',
  },
  {
    code: 'WPN_INFINITY_BLADE_O1',
    name: 'The O(1) Sovereign Infinity Blade',
    category: 'WEAPON',
    rarity: 'MYTHIC',
    iconEmoji: '👑',
    iconUrl: `${TWEMOJI_BASE}/1f451.png`,
    passiveStat: '+1,800 Armory Power • Instant constant-time execution',
    lore: 'A mythic weapon whispered of in Grandmaster legends. Resolves any raid boss in constant time.',
  },

  // ==========================================
  // CODE COMPANIONS / ZOO PETS (8 Items)
  // ==========================================
  {
    code: 'PET_RUBBER_DUCK',
    name: 'Debugging Rubber Duckling',
    category: 'COMPANION',
    rarity: 'COMMON',
    iconEmoji: '🦆',
    iconUrl: `${TWEMOJI_BASE}/1f986.png`,
    passiveStat: '+15 Zoo Power • Silently judges your off-by-one errors',
    lore: 'Explain your code to it line by line and the bug magically reveals itself.',
  },
  {
    code: 'PET_GC_TURTLE',
    name: 'Garbage-Collector Tortoise',
    category: 'COMPANION',
    rarity: 'COMMON',
    iconEmoji: '🐢',
    iconUrl: `${TWEMOJI_BASE}/1f422.png`,
    passiveStat: '+15 Zoo Power • Sweeps unreferenced nodes',
    lore: 'Slow and steady, it frees leaked heap memory while you sleep.',
  },
  {
    code: 'PET_SLIDING_FERRET',
    name: 'Sliding-Window Ferret',
    category: 'COMPANION',
    rarity: 'UNCOMMON',
    iconEmoji: '🦦',
    iconUrl: `${TWEMOJI_BASE}/1f9a6.png`,
    passiveStat: '+35 Zoo Power • Darts across contiguous subarrays',
    lore: 'Expands its head and contracts its tail to capture optimal subarray loot.',
  },
  {
    code: 'PET_GREEDY_RACCOON',
    name: 'Greedy-Choice Trash Panda',
    category: 'COMPANION',
    rarity: 'UNCOMMON',
    iconEmoji: '🦝',
    iconUrl: `${TWEMOJI_BASE}/1f99d.png`,
    passiveStat: '+35 Zoo Power • Always grabs the local maximum',
    lore: 'Never looks back. Picks the shiniest immediate reward every single step.',
  },
  {
    code: 'PET_TRIE_OWL',
    name: 'Prefix-Trie Astral Owl',
    category: 'COMPANION',
    rarity: 'RARE',
    iconEmoji: '🦉',
    iconUrl: `${TWEMOJI_BASE}/1f989.png`,
    passiveStat: '+85 Zoo Power • Autocompletes ancient incantations',
    lore: 'Nested in a 26-branch canopy, it knows how every word in the universe ends.',
  },
  {
    code: 'PET_BACKTRACK_CHAMELEON',
    name: 'Backtracking Void Fox',
    category: 'COMPANION',
    rarity: 'EPIC',
    iconEmoji: '🦊',
    iconUrl: `${TWEMOJI_BASE}/1f98a.png`,
    passiveStat: '+220 Zoo Power • Reverts state when hitting dead ends',
    lore: 'Explores every permutation of reality, undoing its pawprints whenever a branch fails.',
  },
  {
    code: 'PET_RED_BLACK_DRAGON',
    name: 'Red-Black Self-Balancing Dragon',
    category: 'COMPANION',
    rarity: 'LEGENDARY',
    iconEmoji: '🐉',
    iconUrl: `${TWEMOJI_BASE}/1f409.png`,
    passiveStat: '+600 Zoo Power • Rotates subtrees in fiery harmony',
    lore: 'No path from root to leaf ever dares exceed twice the height of another under its gaze.',
  },
  {
    code: 'PET_QUANTUM_PHOENIX',
    name: 'NP-Complete Astral Phoenix',
    category: 'COMPANION',
    rarity: 'MYTHIC',
    iconEmoji: '🦅',
    iconUrl: `${TWEMOJI_BASE}/1f985.png`,
    passiveStat: '+1,800 Zoo Power • Resurrects streaks from ashes',
    lore: 'Born when P=NP briefly flickered in a cosmic supernova. Radiates pure algorithmic mastery.',
  },

  // ==========================================
  // ANCIENT RELICS & ARTIFACTS (8 Items)
  // ==========================================
  {
    code: 'REL_CAFFEINE_ELIXIR',
    name: 'Midnight Cold-Brew Vial',
    category: 'RELIC',
    rarity: 'COMMON',
    iconEmoji: '🧪',
    iconUrl: `${TWEMOJI_BASE}/1f9ea.png`,
    passiveStat: '+15 Relic Power • +10 Late-Night Focus',
    lore: 'Essential fuel for 2:00 AM contest debugging sessions.',
  },
  {
    code: 'REL_HASHMAP_COMPASS',
    name: 'Collision-Free Hash Compass',
    category: 'RELIC',
    rarity: 'UNCOMMON',
    iconEmoji: '🧭',
    iconUrl: `${TWEMOJI_BASE}/1f9ed.png`,
    passiveStat: '+35 Relic Power • Zero hash collisions',
    lore: 'Points directly to the bucket you need with zero chaining overhead.',
  },
  {
    code: 'REL_MEMO_SCROLL',
    name: 'Scroll of Top-Down Memoization',
    category: 'RELIC',
    rarity: 'RARE',
    iconEmoji: '📜',
    iconUrl: `${TWEMOJI_BASE}/1f4dc.png`,
    passiveStat: '+85 Relic Power • Caches overlapping subproblems',
    lore: 'Once a battle is fought, its outcome is inscribed forever—never recomputed twice.',
  },
  {
    code: 'REL_FENWICK_SHIELD',
    name: 'Fenwick Binary-Indexed Aegis',
    category: 'RELIC',
    rarity: 'RARE',
    iconEmoji: '🛡️',
    iconUrl: `${TWEMOJI_BASE}/1f6e1.png`,
    passiveStat: '+85 Relic Power • Absorbs prefix-sum shockwaves',
    lore: 'Harnesses least-significant bits (`i & -i`) to deflect incoming raid boss strikes.',
  },
  {
    code: 'REL_SEGMENT_GRIMOIRE',
    name: 'Lazy-Propagation Segment Grimoire',
    category: 'RELIC',
    rarity: 'EPIC',
    iconEmoji: '📘',
    iconUrl: `${TWEMOJI_BASE}/1f4d8.png`,
    passiveStat: '+220 Relic Power • Defers range updates until needed',
    lore: 'Why update a million nodes today when you can push a lazy tag tomorrow?',
  },
  {
    code: 'REL_UNION_FIND_CHALICE',
    name: 'Chalice of Disjoint-Set Union',
    category: 'RELIC',
    rarity: 'EPIC',
    iconEmoji: '🏆',
    iconUrl: `${TWEMOJI_BASE}/1f3c6.png`,
    passiveStat: '+220 Relic Power • Inverse-Ackermann path compression',
    lore: 'Unites fractured guilds in nearly constant α(N) time.',
  },
  {
    code: 'REL_TURING_HOURGLASS',
    name: "Turing's Halting Chronometer",
    category: 'RELIC',
    rarity: 'LEGENDARY',
    iconEmoji: '⏳',
    iconUrl: `${TWEMOJI_BASE}/23f3.png`,
    passiveStat: '+600 Relic Power • Foretells Time-Limit Exceeded (TLE)',
    lore: 'Bends execution time itself, turning TLE verdicts into 0ms Accepted runs.',
  },
  {
    code: 'REL_SINGULARITY_CORE',
    name: 'The Bell-Man-Ford Singularity Core',
    category: 'RELIC',
    rarity: 'MYTHIC',
    iconEmoji: '🔮',
    iconUrl: `${TWEMOJI_BASE}/1f52e.png`,
    passiveStat: '+1,800 Relic Power •Harnesses negative-weight cycles',
    lore: 'An orb of infinite negative-cycle energy recovered from the heart of the Monolithic Leviathan.',
  },
];
