# DevGuild — Production System Architecture

## 1. System Overview & Philosophy

DevGuild is an enterprise-grade, Discord-native competitive programming and accountability platform engineered specifically for developer communities, university clubs, and interview preparation cohorts.

Unlike conventional coding bots that merely scrape LeetCode submission counters, DevGuild is designed as an interactive **Guild Operating System**. It gamifies consistency, team rivalry, topic mastery, and contest participation, while actively disincentivizing burnout and problem-farming.

### Core Architectural Principles
1. **Decoupled Asynchronous Processing**: Discord Gateway interactions must remain sub-second responsive. All heavy external network operations (LeetCode GraphQL scraping, image rendering, XP balance computations) are offloaded to BullMQ queues backed by Redis.
2. **Event-Driven Domain Modeling**: Domain transitions (e.g., submission detected, streak updated, challenge concluded, contest finalized) emit strongly-typed events to drive XP attribution, badge unlocks, and notification dispatches in real time.
3. **Strict Concurrency & Idempotency**: Prevents race conditions during submission polling, vote tallying, challenge resolution, and XP granting via distributed locking (Redlock) and database-level unique constraints.
4. **Configurable Balancing Over Hardcoding**: Multipliers, diminishing return thresholds, rank tier ceilings, and streak bonuses are stored in database configuration tables rather than static code constants.
5. **High-Availability & Extensibility**: Built on a modular monolith foundation in NestJS with clean domain boundaries, facilitating future platform adapters (e.g., Codeforces, GitHub) without modifying core guild, challenge, or XP systems.

---

## 2. High-Level Architecture Topology

```
+-----------------------------------------------------------------------------------+
|                                  DISCORD CLIENT                                   |
|   Slash Commands (/link, /profile, /challenge, /team, /leaderboard, /recap, etc.)  |
|   Interactive Buttons | Select Menus | Modal Submissions | Scheduled Broadcasts   |
+-----------------------------------------------------------------------------------+
                                       ▲   │
                                       │   │ Discord Gateway / REST API
                                       │   ▼
+-----------------------------------------------------------------------------------+
|                             DISCORD BOT SERVICE                                   |
|   - Discord.js v14 Client & Gateway Sharding Manager                              |
|   - Interaction Dispatcher & Autocomplete Router                                  |
|   - Premium Embed & Canvas Card Builder (@napi-rs/canvas)                         |
|   - Ephemeral Response & Error Filter                                             |
+-----------------------------------------------------------------------------------+
                                       ▲   │
                                       │   │ Internal Event Bus / Redis PubSub
                                       │   ▼
+-----------------------------------------------------------------------------------+
|                           NESTJS APPLICATION SERVER                               |
|   +-------------------+  +--------------------+  +----------------------------+   |
|   |  REST API & DTOs  |  |  Auth & RBAC Guard |  |   Swagger Documentation    |   |
|   +-------------------+  +--------------------+  +----------------------------+   |
|   +---------------------------------------------------------------------------+   |
|   |                              DOMAIN ENGINES                               |   |
|   |   • Activity Engine       • XP & Anti-Farming Engine   • Challenge Engine |   |
|   |   • Contest Engine        • Reliability Engine         • Achievement Eng  |   |
|   |   • Team Engine           • Season Engine              • Notification Eng |   |
|   +---------------------------------------------------------------------------+   |
|   +-------------------+  +--------------------+  +----------------------------+   |
|   | Prisma Client ORM |  | Redis Client (Io)  |  | BullMQ Producers (Queues)  |   |
|   +-------------------+  +--------------------+  +----------------------------+   |
+-----------------------------------------------------------------------------------+
       │                         │                               │
       │ PostgreSQL Wire         │ Redis Command Wire            │ Redis Queue Wire
       ▼                         ▼                               ▼
+--------------+          +--------------+             +--------------------+
|  POSTGRESQL  |          |   REDIS 7    |             |  BULLMQ WORKERS    |
|  DATABASE    |          |  Distributed |             |  • LeetCode Poll   |
|  16 (ALPIN)  |          |  Cache & Lock|             |  • Activity Worker |
|              |          |  & Pub/Sub   |             |  • Challenge Worker|
| • Users      |          +--------------+             |  • Contest Scraper |
| • Profiles   |                 ▲                     |  • Recap Worker    |
| • Activities |                 │                     |  • Season Worker   |
| • Challenges |                 └─────────────────────┤  • Image Generator |
| • Contests   |                                       +--------------------+
| • Seasons    |                                                 │
| • Audit Logs |                                                 ▼
+--------------+                                       +--------------------+
                                                       | LEETCODE GRAPHQL   |
                                                       | https://leetcode   |
                                                       | .com/graphql       |
                                                       +--------------------+
```

---

## 3. Core Component Breakdown

### 3.1. Discord Gateway Client (`src/modules/discord/`)
- Built using `discord.js` v14 with gateway intent optimization (`Guilds`, `GuildMessages`, `GuildMembers`).
- Implements interaction routing:
  - **Slash Commands**: Parses user commands and defer replies within 2,500ms to guarantee zero timeout errors.
  - **Component Handlers**: Handles button clicks and string select menus for challenge creation lobbies and voting.
  - **Modal Submit Handlers**: Captures user text inputs for team creation and custom challenge duration.
- Employs an internal message broadcaster connected to Redis Pub/Sub so workers can push notifications across sharded bot processes without circular dependencies.

### 3.2. LeetCode Integration Layer (`src/modules/leetcode/`)
- Responsible for querying LeetCode's public GraphQL gateway (`https://leetcode.com/graphql`).
- Features:
  - **GraphQL Client**: Queries `matchedUser`, `recentSubmissionList`, `userContestRankingInfo`, and `skillStats`.
  - **Anti-Ban Protection**: Exponential backoff with jitter on HTTP 429 / 503, user-agent rotation, and distributed rate limiting (max 10 requests/minute per worker IP).
  - **Account Verification Protocol**: Generates a cryptographically secure token (e.g. `dg-verify-a9f82c`). The user temporarily pastes this token into their LeetCode profile "About Me" or GitHub handle, verified via a single GraphQL fetch.
  - **Submission Deduplication**: Leverages a submission unique key (`${username}-${submissionId}-${timestamp}`) to prevent double-counting.

### 3.3. Activity Detection Engine (`src/modules/activity/`)
- Orchestrates polling schedules and ingests raw LeetCode submission feeds.
- Filters out non-`Accepted` submissions (e.g., `Wrong Answer`, `Time Limit Exceeded`).
- Classifies problem difficulty (`Easy`, `Medium`, `Hard`) and maps problem tags to standardized domain topic buckets (`Arrays`, `Strings`, `Trees`, `Graphs`, `Dynamic Programming`, `Greedy`, `Binary Search`, `Backtracking`, `Other`).
- Emits `ActivityCreatedEvent` to the NestJS EventBus.

### 3.4. XP & Anti-Farming Engine (`src/modules/xp/`)
- Manages player progression through mathematically balanced formulas.
- **Base Values**:
  - `Easy`: Configurable (default 10 XP)
  - `Medium`: Configurable (default 30 XP)
  - `Hard`: Configurable (default 75 XP)
- **Anti-Farming Multiplier**: Calculates daily easy solve count $N_{easy}$ in a rolling 24-hour window:
  $$M_{easy}(N) = \begin{cases} 
  1.00 & 1 \le N \le 3 \\ 
  0.75 & 4 \le N \le 6 \\ 
  0.50 & 7 \le N \le 10 \\ 
  0.25 & N > 10 
  \end{cases}$$
- **Streak Multipliers**: Adds a daily streak bonus multiplier up to a maximum cap (e.g., $1.0 + \min(\text{streak} \times 0.02, 0.50)$).
- **Auditability**: Every XP change generates an immutable `XPTransaction` record linking to the source activity, challenge, or contest.

### 3.5. Challenge & Voting Engine (`src/modules/challenges/`)
- State Machine managing match formats: 1v1, 2v2, 3v3, and asymmetric $N \text{ v } M$.
- Lifecycle phases:
  1. `CREATED`: Host sets format, max players per team, and targets.
  2. `INVITED`: Invites sent via Discord mentions/buttons.
  3. `LOBBY_READY`: All player slots filled.
  4. `VOTING`: 5-minute interactive voting period on Topic, Duration, and Intensity.
  5. `ACTIVE`: Timed solving window. Submissions matching the chosen topic yield bonus contribution points.
  6. `EVALUATING`: Worker locks score state, tallies team contributions with size normalization, declares winner.
  7. `COMPLETED`: Awards challenge XP, updates reliability scores, unlocks achievements, and renders results embed.

### 3.6. Contest Engine (Boss Battle & Mega Boss Battle) (`src/modules/contests/`)
- Automatically tracks official LeetCode contests:
  - **Weekly Boss Battle**: Weekly Contest (Sundays 08:00 UTC).
  - **Mega Boss Battle**: Biweekly Contest (Saturdays 14:30 UTC every two weeks).
- Community Raid Boss Mechanics:
  - The contest translates into a Guild Raid Boss with total Hit Points ($HP_{boss}$) scaled to participating guild member count.
  - Each solved contest problem inflicts boss damage proportional to problem index ($Q_1 = 100 \text{ DMG}, Q_2 = 250 \text{ DMG}, Q_3 = 600 \text{ DMG}, Q_4 = 1500 \text{ DMG}$).
  - Finishers receive individual contest XP, seasonal leaderboard points, and the server defeats the Boss if damage threshold is reached.

### 3.7. Reliability Engine (`src/modules/reliability/`)
- Measures participant dependability on a scale of $0 - 100$.
- Formula:
  $$R = \text{clamp}\left(100 - (P_{drop} \times 15) - (P_{afk} \times 20) + (C_{finish} \times 3) + (B_{contest} \times 5), 0, 100\right)$$
- If a user accepts a challenge invite but produces 0 submissions during the challenge duration, their reliability is penalized. High reliability scores grant access to elite matchmaking and seasonal bonus multipliers.

### 3.8. Achievement Engine (`src/modules/achievements/`)
- Reactive, event-driven pattern evaluating custom condition trees against user metrics.
- Unlocks progress badges, streak crowns, difficulty masteries, and topic specialist badges with atomic database transactions.

### 3.9. Season & Rank Engine (`src/modules/seasons/`)
- Implements 90-day competitive seasons.
- Maintains 7 discrete rank tiers:
  - Bronze ($0 - 499$ MMR)
  - Silver ($500 - 1,199$ MMR)
  - Gold ($1,200 - 2,499$ MMR)
  - Platinum ($2,500 - 4,499$ MMR)
  - Diamond ($4,500 - 7,499$ MMR)
  - Master ($7,500 - 11,999$ MMR)
  - Grandmaster ($12,000+$ MMR)
- At season transition, seasonal XP and ranks compress using a soft MMR reset formula, while achievements and trophy records persist in the Hall of Fame.

---

## 4. BullMQ Distributed Queue Topology

To guarantee horizontal scalability across multiple container instances, workload is distributed across specialized queues:

| Queue Name | Concurrency | Retry Backoff | Job Purpose |
|------------|-------------|---------------|-------------|
| `leetcode-sync-queue` | 5 | Exponential (10s, 30s, 60s) | Periodic LeetCode profile & submission scraping |
| `activity-processor-queue` | 10 | Fixed (5s, 3 retries) | Ingests raw submissions, computes XP, applies anti-farming, emits events |
| `challenge-lifecycle-queue` | 5 | Fixed (3s, 2 retries) | Manages voting countdowns, challenge start, and challenge evaluation |
| `contest-lifecycle-queue` | 2 | Exponential (30s, 60s, 120s) | Polls official LeetCode contest rankings and tallies boss battle raid results |
| `recap-generator-queue` | 3 | Exponential (15s, 45s) | Gathers analytics and invokes canvas renderer for Daily/Weekly/Monthly cards |
| `notification-dispatch-queue` | 10 | Fixed (2s, 3 retries) | Sends formatted Discord embeds, webhooks, and DM notifications |
| `season-lifecycle-queue` | 1 | Manual review / 3 retries | Executes season freeze, leaderboard archiving, and soft reset computation |

---

## 5. Security & Authentication Model

1. **Discord OAuth2 & JWT**:
   - Web Admin Dashboard authenticates administrators via Discord OAuth2 (`identify`, `guilds`).
   - Issues short-lived JWT access tokens (15 minutes) and rotating refresh tokens (7 days) stored in HttpOnly cookies.
2. **Role-Based Access Control (RBAC)**:
   - Three distinct authority levels: `SUPER_ADMIN`, `GUILD_ADMIN`, `GUILD_MODERATOR`.
   - Discord server owners and users with `Administrator` permission automatically inherit `GUILD_ADMIN` privileges.
3. **Discord Interaction HMAC Verification**:
   - All incoming Discord interactions are verified using public key ED25519 cryptography if operating over HTTP interaction endpoints.
4. **Input Sanitization & Rate Limiting**:
   - REST endpoints protected with `@nestjs/throttler` (default: 60 requests/minute per IP, 10 requests/minute for sensitive sync endpoints).
   - Validation via `class-validator` with strict `whitelist: true` and `forbidNonWhitelisted: true`.

---

## 6. Fault Tolerance & Resilience

- **LeetCode GraphQL Outages / Cloudflare Challenges**:
  - The LeetCode worker catches 403 / 503 HTTP responses and enters a degraded fallback mode with randomized backoff.
  - Active challenges gracefully extend evaluation grace periods if external scraping fails during the final evaluation window.
- **Redis Crash Recovery**:
  - Redis runs in persistent AOF (Append-Only File) mode with `appendfsync everysec`.
  - In the event of a restart, BullMQ seamlessly resumes pending jobs without task duplication.
- **PostgreSQL Connection Pooling**:
  - Managed via Prisma with PgBouncer compatibility. Max connections capped according to container sizing.
