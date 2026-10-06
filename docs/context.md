
# DevGuild — Project Context

## Project Overview

DevGuild is a Discord-native competitive LeetCode community platform.

The purpose is NOT to be another LeetCode statistics dashboard.

The purpose is to create a coding guild experience inside Discord that encourages:

- Consistency
- Accountability
- Friendly competition
- Community engagement
- Contest participation
- Long-term improvement

The platform should feel like a mixture of:

- Discord
- Gaming guilds
- Competitive coding
- Achievement systems
- Seasonal progression

Users should feel like they belong to a coding community rather than simply tracking solved problems.

---

# Core Product Philosophy

Traditional coding trackers focus on:

- Total solved questions
- Rankings
- Statistics

DevGuild focuses on:

- Participation
- Consistency
- Improvement
- Community

The platform should never encourage unhealthy grinding.

The platform should reward:

- Showing up
- Participating
- Improving
- Collaborating

more than raw question volume.

---

# Scope

V1 only supports:

- Discord
- LeetCode

No integrations with:

- Codeforces
- CodeChef
- GitHub
- GeeksForGeeks
- HackerRank

Architecture should remain extensible for future integrations, but V1 must only implement LeetCode.

---

# Target Audience

Primary:

- College coding clubs
- University coding communities
- Placement preparation groups
- LeetCode friend circles

Secondary:

- Discord coding servers
- DSA communities
- Interview preparation groups

---

# Core User Journey

User joins Discord server.

User runs:

/link

User links LeetCode account.

System validates profile.

System begins tracking activity automatically.

No manual entry should ever be required.

Users naturally enter:

- Challenges
- Guild rankings
- Contests
- Achievements
- Seasons

---

# Product Pillars

## Pillar 1 — Activity Visibility

Users should feel their efforts are recognized.

Every meaningful activity should be visible.

Examples:

- Problem solved
- Challenge victory
- Contest participation
- Achievement unlock
- Streak milestones

---

## Pillar 2 — Friendly Competition

Competition should be encouraged.

Toxicity should be discouraged.

Examples:

- Leaderboards
- Challenges
- Rankings
- Team events

---

## Pillar 3 — Community

The strongest motivation should come from peers.

Examples:

- Team challenges
- Boss battles
- Guild rankings
- Shared achievements

---

## Pillar 4 — Consistency

Reward showing up.

Do not reward spam solving.

Reward:

- Streaks
- Regular participation
- Contest attendance
- Challenge completion

---

# Core Systems

## 1. LeetCode Linking

Users link LeetCode accounts.

Requirements:

- Unique linking
- Validation
- Ownership verification
- Duplicate prevention

---

## 2. Activity Tracking

Track:

- Accepted submissions
- Solved problems
- Problem difficulty
- Problem topics
- Contest participation

System must avoid duplicate activity creation.

All activity should be timestamped.

---

## 3. XP Engine

XP should reward:

- Difficulty
- Consistency
- Participation

XP values must be configurable.

No hardcoded balancing.

---

## 4. Anti-Farming System

Easy problem spam must not dominate rankings.

Use configurable diminishing returns.

Example:

Easy Problem XP

1–3:
100%

4–6:
75%

7–10:
50%

10+:
25%

Implementation must remain configurable.

---

# Challenges

Challenges are one of the most important systems.

---

## Supported Formats

- 1v1
- 2v2
- 3v3
- Custom Team Sizes
- Uneven Teams (optional)

Examples:

- 1v1
- 2v1
- 3v2
- 5v5

System should not assume equal team sizes.

---

## Challenge Creation Flow

Challenge Created

↓

Invite Players

↓

Players Accept

↓

Challenge Lobby

↓

Voting Phase

↓

Challenge Starts

↓

Challenge Ends

↓

Results Generated

---

## Voting Phase

Challenge participants vote on:

### Topic

Available:

- Arrays
- Strings
- Trees
- Graphs
- Dynamic Programming
- Greedy
- Binary Search
- Backtracking
- Mixed

Winning topic determines challenge focus.

---

### Duration

Options:

- 24 Hours
- 48 Hours
- 72 Hours
- 7 Days
- Custom

---

### Intensity

Options:

- Casual
- Competitive
- Hardcore

Intensity affects XP multipliers and challenge scoring.

---

## Challenge Philosophy

Challenges should NEVER require a fixed number of questions.

Bad:

"Solve 20 questions."

Good:

"Solve naturally and earn contribution."

Users should work at their own pace.

---

## Challenge Scoring

Factors:

- Difficulty
- Topic Match
- Consistency
- Participation

Not:

- Raw question count

---

# Boss Battles

Boss Battles are server-wide events.

---

## Weekly Boss Battle

Automatically generated from:

LeetCode Weekly Contest

Purpose:

Community participation.

Contest engagement.

Guild competition.

---

### Weekly Boss Battle Rewards

- XP
- Achievements
- Guild points
- Seasonal progress

---

## Mega Boss Battle

Automatically generated from:

LeetCode Biweekly Contest

Special event.

Higher rewards.

Unique achievements.

Community-wide visibility.

---

# Reliability System

Reliability measures how dependable a user is.

Range:

0–100

Factors:

- Contest attendance
- Challenge attendance
- Team participation
- Event completion

Uses:

- Matchmaking
- Team recommendations
- Reputation

Reliability should matter.

---

# Streak System

Track:

- Daily activity streak
- Challenge streak
- Contest streak

Streaks should encourage consistency.

Missing activity should reduce streaks appropriately.

---

# Leaderboards

Leaderboards must support:

- Weekly
- Monthly
- Seasonal
- Streak
- Reliability
- Improvement
- Contest Performance

Leaderboards should not focus solely on solved counts.

---

# Achievement System

Achievements should feel like gaming progression.

Examples:

### Progress

- First Solve
- 50 Solves
- 100 Solves
- 500 Solves

### Consistency

- 7 Day Streak
- 30 Day Streak
- 100 Day Streak

### Challenges

- First Challenge
- Challenge Champion
- Team MVP

### Contests

- Contest Participant
- Boss Slayer
- Mega Boss Slayer

### Topic Specialists

- Graph Specialist
- DP Specialist
- Tree Specialist
- Binary Search Specialist

### Difficulty

- Hard Hunter
- Hard Specialist

Achievement system must be extensible.

---

# Seasons

Season Length:

90 Days

Configurable.

At season end:

- Rankings reset
- XP resets
- Seasonal leaderboards archive

Permanent items:

- Achievements
- Historical records
- Season trophies

---

# Reviews

## Daily Review

Include:

- Problems solved
- XP earned
- Difficulty distribution
- Streak updates
- Rank movement

---

## Weekly Review

Include:

- Weekly XP
- Most solved topic
- Contest performance
- Improvement metrics
- Achievements earned

---

## Monthly Wrapped

Visual shareable summary.

Include:

- Total solves
- Favorite topic
- Longest streak
- Best day
- Contest stats
- Season progress

This should be designed for sharing.

---

# Rank System

Ranks:

- Bronze
- Silver
- Gold
- Platinum
- Diamond
- Master
- Grandmaster

Rank should depend on:

- XP
- Reliability
- Participation
- Contest activity

Not solely on problem count.

---

# Notifications

Supported:

- Problem solved
- Challenge updates
- Contest reminders
- Boss battle alerts
- Achievement unlocks
- Daily recap
- Weekly recap

Notifications should be configurable per server.

---

# Long-Term Vision

DevGuild should become:

"The Discord operating system for coding communities."

A coding club should be able to install DevGuild and instantly gain:

- Competition
- Accountability
- Challenges
- Rankings
- Contests
- Seasonal progression

without needing any manual management.

The ultimate goal is making coding communities more active, consistent, and engaging through Discord-native experiences.