# DevGuild — Achievement Engine Architecture & Catalog

## 1. Engine Design & Reactive Processing

The Achievement Engine functions as an asynchronous, event-driven progression system. Rather than running slow database-wide polling jobs, the system subscribes to domain events dispatched during typical user actions:

```
[ Domain Action ] 
       │
       ▼
[ Event Bus ] ──▶ • ActivityCreatedEvent
                  • StreakUpdatedEvent
                  • ChallengeCompletedEvent
                  • BossBattleFinalizedEvent
                  • TeamCreatedEvent
       │
       ▼
[ BullMQ: achievement-processor ]
       │
       ▼
[ Achievement Evaluator Worker ] ──▶ Evaluates criteriaJson against User Aggregates
       │
       ▼ (Condition Met & Not Unlocked)
[ Database Transaction ]
   • Insert UserAchievement
   • Insert XPTransaction (Bonus XP)
   • Dispatch Discord Notification & Unlock Embed
```

---

## 2. Dynamic JSON Criteria Expression Model

Achievements are not hardcoded in TypeScript. They are defined in the database via the `Achievement.criteriaJson` field, enabling dynamic additions without code deployment.

### Criteria Grammar Schema
```typescript
interface AchievementCriteria {
  metric: 
    | 'TOTAL_SOLVES'
    | 'EASY_SOLVES'
    | 'MEDIUM_SOLVES'
    | 'HARD_SOLVES'
    | 'TOPIC_SOLVES'
    | 'STREAK_DAYS'
    | 'CHALLENGES_WON'
    | 'BOSS_BATTLES_DEFEATED'
    | 'CONTESTS_ENTERED'
    | 'CONTEST_TOP_PERCENT'
    | 'IS_TEAM_LEADER';
  operator: 'GTE' | 'GT' | 'EQ' | 'LTE' | 'IN';
  value: number | string | string[];
  parameters?: {
    topic?: string;
    contestType?: 'WEEKLY' | 'BIWEEKLY';
    minIntensity?: string;
  };
}
```

---

## 3. Comprehensive Built-in Achievement Catalog

| Code | Name | Category | Tier | Criteria Rule | XP Reward |
|---|---|---|---|---|---|
| `FIRST_SOLVE` | **First Blood** | `PROGRESSION` | `BRONZE` | `TOTAL_SOLVES GTE 1` | 50 XP |
| `SOLVES_50` | **Apprentice Solver** | `PROGRESSION` | `SILVER` | `TOTAL_SOLVES GTE 50` | 150 XP |
| `SOLVES_100` | **Centurion** | `PROGRESSION` | `GOLD` | `TOTAL_SOLVES GTE 100` | 300 XP |
| `SOLVES_500` | **Algorithm Grandmaster** | `PROGRESSION` | `PLATINUM` | `TOTAL_SOLVES GTE 500` | 1,000 XP |
| `STREAK_7` | **Consistent Habit** | `CONSISTENCY` | `BRONZE` | `STREAK_DAYS GTE 7` | 100 XP |
| `STREAK_30` | **Iron Will** | `CONSISTENCY` | `SILVER` | `STREAK_DAYS GTE 30` | 400 XP |
| `STREAK_100` | **Unstoppable Force** | `CONSISTENCY` | `PLATINUM` | `STREAK_DAYS GTE 100` | 1,500 XP |
| `HARD_HUNTER` | **Hard Hunter** | `DIFFICULTY` | `SILVER` | `HARD_SOLVES GTE 10` | 250 XP |
| `HARD_MASTER` | **Titan Slayer** | `DIFFICULTY` | `PLATINUM` | `HARD_SOLVES GTE 50` | 750 XP |
| `TREE_SPECIALIST` | **Arborist** | `TOPICS` | `SILVER` | `TOPIC_SOLVES(TREES) GTE 25` | 200 XP |
| `GRAPH_SPECIALIST` | **Pathfinder** | `TOPICS` | `SILVER` | `TOPIC_SOLVES(GRAPHS) GTE 25` | 200 XP |
| `DP_SPECIALIST` | **Subproblem Sorcerer**| `TOPICS` | `GOLD` | `TOPIC_SOLVES(DP) GTE 30` | 350 XP |
| `BIN_SEARCH_SPEC` | **Logarithmic Precision**| `TOPICS` | `BRONZE` | `TOPIC_SOLVES(BINARY_SEARCH) GTE 20` | 150 XP |
| `CHALLENGE_FIRST` | **Gladiator's Entry** | `CHALLENGES` | `BRONZE` | `CHALLENGES_WON GTE 1` | 100 XP |
| `CHALLENGE_CHAMP` | **Challenge Champion** | `CHALLENGES` | `GOLD` | `CHALLENGES_WON GTE 10` | 500 XP |
| `TEAM_CAPTAIN` | **Vanguard Commander** | `CHALLENGES` | `SILVER` | `IS_TEAM_LEADER EQ true` | 150 XP |
| `CONTEST_ENTRY` | **Arena Challenger** | `CONTESTS` | `BRONZE` | `CONTESTS_ENTERED GTE 1` | 100 XP |
| `CONTEST_WINNER` | **Podium Champion** | `CONTESTS` | `PLATINUM` | `CONTEST_TOP_PERCENT LTE 1.0` | 1,000 XP |
| `BOSS_SLAYER` | **Dragon Slayer** | `CONTESTS` | `GOLD` | `BOSS_BATTLES_DEFEATED GTE 1` | 400 XP |
| `MEGA_BOSS_SLAYER`| **Leviathan Slayer** | `CONTESTS` | `PLATINUM` | `MEGA_BOSS_DEFEATED GTE 1` | 800 XP |

---

## 4. Evaluation Engine Implementation Logic

When the worker handles an incoming event for `userId`:
1. **Query Unearned Achievements**:
   Fetch all achievements from the database whose `id` is NOT present in `UserAchievement` for `userId`.
2. **Compile User Context**:
   Aggregate the user's statistics in a single optimized query:
   - Solve totals by difficulty and primary topic.
   - Current daily streak.
   - Challenge win count and team memberships.
   - Contest attendance and boss battle participation.
3. **Execute Rule Validation**:
   Iterate over pending achievements and evaluate `criteriaJson` against the aggregated context.
4. **Atomic Granting**:
   Wrap newly unlocked achievements in a single Prisma transaction:
   ```typescript
   await prisma.$transaction([
     prisma.userAchievement.createMany({
       data: unlocks.map(a => ({ userId, achievementId: a.id }))
     }),
     prisma.xPTransaction.createMany({
       data: unlocks.map(a => ({
         userId,
         source: 'ACHIEVEMENT_UNLOCK',
         baseAmount: a.xpReward,
         finalAmount: a.xpReward,
         reason: `Unlocked achievement: ${a.name}`
       }))
     }),
     prisma.guildMember.updateMany({
       where: { userId },
       data: { guildXp: { increment: totalBonusXp } }
     })
   ]);
   ```
5. **Notification Dispatch**:
   Emits an event to `notification-dispatch-queue` to post a celebratory embed in the guild's activity channel.
