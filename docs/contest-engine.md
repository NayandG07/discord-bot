# DevGuild — Contest & Boss Battle Engine Architecture

## 1. Concept & Narrative Philosophy

Official LeetCode contests are typically solitary experiences. DevGuild transforms every official contest into a **Cooperative Guild Raid Boss**:

- **Weekly Contest** $\to$ **Weekly Boss Battle**: A formidable recurring adversary requiring steady guild coordination.
- **Biweekly Contest** $\to$ **Mega Boss Battle**: A high-stakes, server-wide event with enhanced Hit Points, greater XP rewards, and exclusive badges.

Rather than competing against teammates, guild members fight side-by-side to deplete the Boss's Hit Points ($HP_{boss}$) by solving contest problems during the official contest window.

---

## 2. Contest Synchronization Pipeline

```
+-----------------------------------------------------------------------------------+
|                        OFFICIAL LEETCODE CONTEST TIMETABLE                        |
|   • Biweekly Contest: Alternate Saturdays @ 14:30 - 16:00 UTC                     |
|   • Weekly Contest: Every Sunday @ 08:00 - 09:30 UTC                              |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                        BULLMQ CRON: contest-lifecycle-queue                       |
|   • T-24h: Seed Contest and BossBattle records across all active Guilds           |
|   • T-2h: Post Raid Assembly Embed with "Join Raid Party" interactive button     |
|   • T-0: Post "Contest Commenced" Raid alert                                      |
|   • T+90m: Contest concludes; enters official ranking buffer                      |
|   • T+4h: Fetch official ranking data via LeetCode GraphQL / Ranking API          |
|   • Finalize Boss HP, disburse XP, award badges, and post Raid Summary Embed      |
+-----------------------------------------------------------------------------------+
```

---

## 3. Mathematical Mechanics & Scaling

### 3.1. Dynamic Boss Health Points Formula ($HP_{boss}$)

To ensure that both 20-person university clubs and 5,000-member Discord communities experience a challenging yet attainable raid, $HP_{boss}$ scales with active guild size:

$$HP_{boss} = BaseHP + \left( N_{active} \times TierFactor \right)$$

Where:
- $N_{active}$: Guild members with verified LeetCode accounts who were active in the past 14 days.
- **Weekly Boss**:
  - $BaseHP = 1,500$
  - $TierFactor = 350$
- **Mega Boss**:
  - $BaseHP = 3,500$
  - $TierFactor = 750$

*Example*: For a guild with 20 active members:
- Weekly Boss HP = $1,500 + (20 \times 350) = 8,500\text{ HP}$.
- Mega Boss HP = $3,500 + (20 \times 750) = 18,500\text{ HP}$.

---

### 3.2. Player Damage Output Formula ($DMG_p$)

In official LeetCode contests, problems scale steeply in difficulty ($Q_1 \approx \text{Easy}$, $Q_2 \approx \text{Medium}$, $Q_3 \approx \text{Medium/Hard}$, $Q_4 \approx \text{Hard}$). Damage values reflect this exponential difficulty gradient:

| Problem Solved | Standard Damage | Critical Hit Bonus (Within first 15 mins) |
|---|---|---|
| **Question 1** | $100\text{ DMG}$ | $+25\text{ DMG}$ |
| **Question 2** | $250\text{ DMG}$ | $+50\text{ DMG}$ |
| **Question 3** | $600\text{ DMG}$ | $+150\text{ DMG}$ |
| **Question 4** | $1,500\text{ DMG}$ | $+500\text{ DMG}$ |

$$DMG_p = \sum_{q \in Solved} BaseDMG(q) + CritBonus(q)$$

A complete 4-problem solve yields between $2,450\text{ DMG}$ and $3,175\text{ DMG}$.

---

## 4. Contest Data Extraction Protocol

LeetCode final contest rankings are processed through the internal worker `ContestScraperWorker`:

1. **Target Identification**:
   Queries `https://leetcode.com/contest/api/ranking/{contest-slug}/?pagination=1&region=global`.
2. **Member Filtering**:
   Maps registered guild LeetCode usernames against the contest ranking payload.
3. **Extraction Metrics**:
   - `rank`: Global rank.
   - `score`: Total points ($0 - 18$).
   - `finish_time`: Timestamp of final submission.
   - `problems_solved`: Number of problems accepted ($0 - 4$).
4. **Idempotent Storage**:
   Inserts records into `BossBattleParticipant` with `damageDealt`, `problemsSolved`, and `contestRank`.

---

## 5. Raid Resolution & Rewards Matrix

Once all participant damages are tallied, the worker calculates remaining Boss HP:

$$HP_{remaining} = \max\left(0, HP_{boss} - \sum_{p \in Guild} DMG_p\right)$$

### 5.1. Victory Rewards (Boss Defeated: $HP_{remaining} = 0$)
- **Server Reward**: Every raid participant receives:
  - Weekly Boss: $+250\text{ Guild XP}$.
  - Mega Boss: $+500\text{ Guild XP}$.
- **Badge Unlocks**:
  - Weekly Boss: Unlocks `BOSS_SLAYER` achievement.
  - Mega Boss: Unlocks `MEGA_BOSS_SLAYER` achievement.
- **Top Damage Dealer (Raid MVP)**:
  - Receives $+200$ bonus seasonal XP and a dedicated MVP shoutout in the raid victory embed.

### 5.2. Defeat Rewards (Boss Survived: $HP_{remaining} > 0$)
- Even in defeat, players retain individual contest participation XP:
  - $+50\text{ XP}$ per question solved ($Q_1 \to Q_4$).
  - $+2.0\text{ Reliability}$ score for attending.
