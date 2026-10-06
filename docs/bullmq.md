# DevGuild — BullMQ Distributed Jobs & Scheduling Architecture

## 1. Overview & Queue Topography

All background tasks, scheduled crons, and heavy compute pipelines in DevGuild are coordinated using **BullMQ** running atop Redis 7.

### Queue Matrix
| Queue Identifier | Priority | Default Concurrency | Retry Strategy | Backoff Type |
|---|---|---|---|---|
| `leetcode-sync-queue` | Medium | 5 | 3 retries | Exponential (10s, 30s, 60s) |
| `activity-processor-queue` | High | 10 | 3 retries | Fixed (5s) |
| `challenge-lifecycle-queue` | High | 5 | 2 retries | Fixed (3s) |
| `contest-lifecycle-queue` | High | 2 | 4 retries | Exponential (30s, 60s, 120s, 300s) |
| `recap-generator-queue` | Low | 3 | 2 retries | Fixed (10s) |
| `notification-dispatch-queue` | High | 10 | 3 retries | Fixed (2s) |
| `season-lifecycle-queue` | Critical | 1 | 5 retries | Exponential (60s, 300s) |

---

## 2. Scheduled Cron Jobs Matrix

BullMQ repeatable jobs are scheduled at application startup:

```typescript
// Recurring Cron Job Definitions
export const SCHEDULED_CRONS = [
  {
    name: 'poll-all-active-users',
    queue: 'leetcode-sync-queue',
    cron: '*/15 * * * *', // Every 15 minutes
    data: { batchSize: 50 },
  },
  {
    name: 'generate-daily-recaps',
    queue: 'recap-generator-queue',
    cron: '0 0 * * *', // Every midnight UTC
    data: { type: 'DAILY' },
  },
  {
    name: 'generate-weekly-recaps',
    queue: 'recap-generator-queue',
    cron: '0 0 * * 0', // Every Sunday midnight UTC
    data: { type: 'WEEKLY' },
  },
  {
    name: 'weekly-contest-rally',
    queue: 'contest-lifecycle-queue',
    cron: '0 6 * * 0', // Sunday 06:00 UTC (T-2h before Weekly Contest)
    data: { contestType: 'WEEKLY', phase: 'RALLY' },
  },
  {
    name: 'weekly-contest-scrape-rankings',
    queue: 'contest-lifecycle-queue',
    cron: '0 12 * * 0', // Sunday 12:00 UTC (T+4h post contest)
    data: { contestType: 'WEEKLY', phase: 'SCRAPE_AND_FINALIZE' },
  },
  {
    name: 'check-season-transitions',
    queue: 'season-lifecycle-queue',
    cron: '0 1 * * *', // Every day at 01:00 UTC
    data: {},
  },
];
```

---

## 3. Detailed Job Payloads & Worker Contracts

### 3.1. `leetcode-sync-queue`
- **Job Name**: `sync-user-profile`
- **Payload Schema**:
```typescript
interface SyncUserProfileJobData {
  userId: string;
  leetCodeUsername: string;
  forceFullHistory?: boolean;
}
```
- **Execution Flow**:
  1. Queries LeetCode GraphQL `recentSubmissionList(username, limit: 20)`.
  2. Compares submission IDs against existing `Activity` records in PostgreSQL.
  3. For each new `Accepted` submission, queues a job into `activity-processor-queue`.
  4. Updates `LeetCodeProfile.lastSyncedAt`.

### 3.2. `activity-processor-queue`
- **Job Name**: `process-new-submission`
- **Payload Schema**:
```typescript
interface ProcessSubmissionJobData {
  userId: string;
  leetCodeSubmissionId: string;
  problemTitle: string;
  problemSlug: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topicTags: string[];
  submissionTimestamp: string;
}
```
- **Execution Flow**:
  1. Classifies primary topic bucket (e.g. `DYNAMIC_PROGRAMMING`).
  2. Applies anti-farming diminishing return formula for Easy problems.
  3. Computes daily solve streak.
  4. Inserts `Activity` and `XPTransaction` in a single transaction.
  5. Updates `User.currentStreak`, `User.lastActiveAt`, and `GuildMember.guildXp`.
  6. Emits `ActivityCreatedEvent` for the Achievement and Challenge engines.

### 3.3. `challenge-lifecycle-queue`
- **Job Names**:
  - `start-voting-timer`: Delays 5 minutes, closes voting, calculates winning parameters, sets state to `ACTIVE`, schedules `evaluate-challenge`.
  - `evaluate-challenge`: Executes at challenge deadline. Acquires Redlock, tallies points, applies uneven team normalization, awards XP, updates reliability, posts summary.

### 3.4. `recap-generator-queue`
- **Job Name**: `generate-monthly-wrapped`
- **Payload Schema**:
```typescript
interface GenerateMonthlyWrappedJobData {
  userId: string;
  guildId: string;
  year: number;
  month: number;
}
```
- **Execution Flow**:
  1. Compiles monthly aggregates: total solves, difficulty distribution, favorite topic, best streak.
  2. Invokes `@napi-rs/canvas` service to render the high-resolution 1200x630 share card.
  3. Writes image buffer to CDN / local public storage.
  4. Dispatches Discord embed with image attachment to user or server channel.
