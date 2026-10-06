# DevGuild — Redis Architecture, Caching & Distributed Locking

## 1. Role in System Architecture

Redis 7 serves three critical roles in the DevGuild infrastructure:
1. **High-Throughput Caching Layer**: Caches LeetCode user summaries, active guild settings, and live leaderboard rankings with short TTLs to protect PostgreSQL from repetitive read queries.
2. **Distributed Queue Backend**: Powers BullMQ queues for scheduled cron jobs, background LeetCode scraping, recap generation, and notification broadcasts.
3. **Distributed Locking (Redlock)**: Guarantees concurrency control and single-execution constraints across sharded bot nodes during challenge evaluations, season resets, and contest raid HP tallies.
4. **Pub/Sub Notification Bus**: Bridges background workers with Discord Gateway shards so that background task completions immediately trigger bot channel announcements without direct inter-process HTTP coupling.

---

## 2. Keyspace Design & Conventions

All Redis keys adhere to structured namespace prefixes: `devguild:{domain}:{entity}:{id}:{attribute}`.

| Key Pattern | Data Structure | TTL | Purpose |
|---|---|---|---|
| `devguild:cache:user:{discordId}:profile` | String (JSON) | 300s (5m) | Cached user profile and stats |
| `devguild:cache:guild:{guildId}:config` | String (JSON) | 600s (10m) | Cached guild XP and notification rules |
| `devguild:cache:leaderboard:{guildId}:{type}` | String (JSON) | 60s (1m) | Cached leaderboard ranking payloads |
| `devguild:rate:leetcode:{username}` | String (Count) | 60s (1m) | LeetCode query rate limit counter |
| `devguild:lock:challenge:{challengeId}:eval` | String (UUID) | 30s | Redlock mutex for challenge score evaluation |
| `devguild:lock:contest:{contestId}:eval` | String (UUID) | 120s | Redlock mutex for contest raid calculation |
| `devguild:lock:season:{seasonId}:reset` | String (UUID) | 300s | Redlock mutex for 90-day season reset |
| `devguild:pubsub:discord:notifications` | Channel | N/A | Pub/Sub channel for outgoing Discord messages |

---

## 3. Distributed Locking Architecture (Redlock)

To prevent race conditions where two concurrent BullMQ workers evaluate the same challenge at the deadline, DevGuild utilizes the **Redlock** distributed locking algorithm:

```typescript
import Redlock from 'redlock';
import Redis from 'ioredis';

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

export const redlock = new Redlock([redisClient], {
  driftFactor: 0.01,
  retryCount: 3,
  retryDelay: 200, // ms
  retryJitter: 100, // ms
  automaticExtensionThreshold: 500, // ms
});
```

### Locking Workflow:
1. Worker receives `eval-challenge` job for challenge `id`.
2. Worker attempts to acquire lock: `devguild:lock:challenge:${id}:eval` with TTL of 30,000ms.
3. If lock fails (already acquired by another worker), job is safely released or requeued.
4. If lock succeeds, worker executes evaluation in a database transaction, unlocks the mutex, and posts Discord summary.

---

## 4. Cache Invalidation & Event Hooks

DevGuild adopts a **Cache-Aside with Reactive Invalidation** pattern:
- **Write-Through Invalidation**: When a user links an account or solves a problem, `devguild:cache:user:{discordId}:profile` and `devguild:cache:leaderboard:{guildId}:*` keys are explicitly purged via `redis.del()`.
- **Sliding Window Rate Limiting**: Uses Redis sorted sets (`ZADD`, `ZREMRANGEBYSCORE`, `ZCARD`) for high-precision sliding-window API rate limiting on LeetCode scraper jobs.

---

## 5. Production `redis.conf` Settings

```conf
# Memory Management
maxmemory 1gb
maxmemory-policy volatile-lru

# Persistence (Append Only File)
appendonly yes
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Networking & Security
bind 0.0.0.0
protected-mode yes
timeout 0
tcp-keepalive 300
```
