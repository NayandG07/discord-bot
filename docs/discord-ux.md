# DevGuild — Discord UX Architecture & Design System

## 1. UX Design Philosophy

DevGuild’s Discord user experience feels like a blend of modern multiplayer gaming guilds, competitive esports hubs, and professional developer tools. 

### Fundamental UX Principles
1. **Zero Clutter, Maximum Impact**: Command responses default to sleek, compact embeds. Large embeds are reserved for Boss Battles, Challenge Lobbies, and Monthly Wrapped cards.
2. **Interactive Over Textual**: Wherever users make decisions (voting in challenges, accepting invites, paging leaderboards), interactive Discord UI components (Buttons, Select Menus, Modals) are used instead of typed parameters.
3. **Sub-Second Ephemeral Feedback**: Ephemeral acknowledgement messages (`flags: 64`) are used for private status checks, errors, and verification tokens so personal credentials and command errors do not spam server channels.
4. **Visual Progression & Gaming Identity**: Every user interaction reflects their guild rank through color schemes, tier badges, streak icons, and canvas-rendered shareable graphics.

---

## 2. Color Palette & Visual Token System

Discord embeds strictly follow rank-tier and event color tokens to provide instant visual context:

| Context / Tier | Hex Code | Decimal | Discord Theme Meaning |
|---|---|---|---|
| **Bronze Tier** | `#CD7F32` | `13467442` | New Guild Initiate (0 - 499 XP) |
| **Silver Tier** | `#C0C0C0` | `12632256` | Proven Solver (500 - 1,199 XP) |
| **Gold Tier** | `#FFD700` | `16766720` | Veteran Practitioner (1,200 - 2,499 XP) |
| **Platinum Tier** | `#00E5FF` | `58879` | High-Efficiency Specialist (2,500 - 4,499 XP) |
| **Diamond Tier** | `#3D5AFE` | `4020990` | Elite Competitive Tier (4,500 - 7,499 XP) |
| **Master Tier** | `#9C27B0` | `10233776` | Guild Master Rank (7,500 - 11,999 XP) |
| **Grandmaster** | `#FF1744` | `16717636` | Pinnacle Legend (12,000+ XP) |
| **Boss Battle** | `#E040FB` | `14696699` | Weekly / Biweekly Contest Raid Boss |
| **Challenge Active** | `#00E676` | `58998` | Live Head-to-Head Match |
| **Error / Alert** | `#FF5252` | `16732754` | Validation Errors & Warnings |

---

## 3. Slash Command Hierarchy & Spec

```
/link <leetcode_username>
/unlink
/profile [user]
/leaderboard
  ├── weekly
  ├── monthly
  ├── streak
  ├── consistency
  ├── improvement
  └── contests
/challenge
  ├── create <format> [duration] [intensity]
  ├── invite <user>
  ├── lobby
  ├── vote
  └── status
/team
  ├── create <name> <tag>
  ├── invite <user>
  ├── leave
  └── stats [team_tag]
/boss
  ├── current
  ├── damage-leaderboard
  └── alert-toggle
/recap
  ├── daily
  ├── weekly
  └── wrapped [month] [year]
/admin
  ├── xp-balance <easy> <medium> <hard>
  ├── channel-set <type> <channel>
  ├── season-reset
  └── audit-log
```

---

## 4. Detailed Command Flows & Embed Mockups

### 4.1. Account Linking Flow (`/link`)

**Step 1: User runs command**
```
User: /link leetcode_username: neetcode
Bot: [Ephemeral Embed]
```

**Embed Layout:**
```
+-------------------------------------------------------------------------+
| [Lock Icon] DEVGUILD ACCOUNT VERIFICATION                               |
+-------------------------------------------------------------------------+
| Welcome, @User! To link your LeetCode account:                          |
|                                                                         |
| 1. Copy your unique verification token:                                 |
|    `dg-verify-a4f91e`                                                   |
| 2. Visit https://leetcode.com/profile/ and paste this token into        |
|    your "About Me" bio or GitHub profile handle.                         |
| 3. Click the button below to confirm.                                   |
|                                                                         |
| [Expires in 15 minutes]                                                 |
+-------------------------------------------------------------------------+
| [Button: Verify Now (Success)]   [Button: Cancel (Secondary)]           |
+-------------------------------------------------------------------------+
```

**Step 2: User Clicks "Verify Now"**
- Bot contacts internal API `/api/v1/leetcode/verify`.
- LeetCode GraphQL scrapes profile bio.
- If verified:
```
+-------------------------------------------------------------------------+
| [Checkmark Icon] LEETCODE ACCOUNT LINKED!                               |
+-------------------------------------------------------------------------+
| Successfully linked **neetcode** to Discord account @User!              |
| Initial Stats Ingested:                                                 |
| • Solved: 840 (Easy: 240 | Medium: 480 | Hard: 120)                      |
| • Current Streak: 12 Days                                               |
| • Starting Tier: GOLD (1,450 Guild XP)                                  |
|                                                                         |
| You are now registered for Challenges, Boss Battles, and Seasons!       |
+-------------------------------------------------------------------------+
```

---

### 4.2. Profile Card (`/profile [user]`)

**Embed Layout:**
```
+-------------------------------------------------------------------------+
| [User Avatar]  DEVGUILD CODER PROFILE — CodeNinja                       |
+-------------------------------------------------------------------------+
| LeetCode Handle: [codeninja99](https://leetcode.com/codeninja99)         |
| Guild Rank: DIAMOND (6,420 XP)          Reliability: 98.4% (Elite)      |
| Daily Streak: 14 Days                   Longest Streak: 38 Days         |
+-------------------------------------------------------------------------+
| LEETCODE METRICS                                                        |
| Total Solved: 384                                                       |
| 🟩 Easy: 142    🟨 Medium: 198    🟥 Hard: 44                            |
| Contest Rating: 1,894 (Top 4.2%)                                        |
+-------------------------------------------------------------------------+
| RECENT ACHIEVEMENTS                                                     |
| 🏆 Hard Hunter  •  ⚡ 7-Day Streak  •  ⚔️ Boss Slayer  •  🌳 Tree Maven   |
+-------------------------------------------------------------------------+
| Footer: DevGuild Season 4 • Active Challenge: None                      |
+-------------------------------------------------------------------------+
```

---

### 4.3. Challenge Flow (`/challenge create`)

#### Phase 1: Lobby Setup
When the host executes `/challenge create format:2v2`:
```
+-------------------------------------------------------------------------+
| ⚔️ CHALLENGE LOBBY — 2v2 MATCH                                           |
+-------------------------------------------------------------------------+
| Host: @Alice                                                            |
| Status: WAITING FOR PLAYERS (2/4 Slots Filled)                          |
|                                                                         |
| Team 1:                                                                 |
| 1. @Alice (Host)                                                        |
| 2. [Empty Slot]                                                         |
|                                                                         |
| Team 2:                                                                 |
| 1. @Bob (Invited)                                                       |
| 2. [Empty Slot]                                                         |
|                                                                         |
| Click below to join a team or invite players.                           |
+-------------------------------------------------------------------------+
| [Join Team 1]  [Join Team 2]  [Invite Player]  [Start Voting]  [Cancel] |
+-------------------------------------------------------------------------+
```

#### Phase 2: Interactive Voting Menu
Once all slots are filled, the lobby transforms into the voting modal:
```
+-------------------------------------------------------------------------+
| 🗳️ CHALLENGE VOTING PHASE (Ends in 03:45)                                 |
+-------------------------------------------------------------------------+
| Participants must select their preferences below:                       |
|                                                                         |
| 1. Topic Focus (determines 1.5x score bonus)                            |
| 2. Duration (24h, 48h, 72h, 7 Days)                                     |
| 3. Intensity (Casual, Competitive, Hardcore)                            |
+-------------------------------------------------------------------------+
| [Select Menu: Select Preferred Topic (DP, Trees, Graphs, Mixed...)]     |
| [Select Menu: Select Duration (24h, 48h, 72h, 7 Days)]                  |
| [Select Menu: Select Intensity (Casual 1.0x, Comp 1.25x, Hardcore 1.5x)]|
+-------------------------------------------------------------------------+
```

---

### 4.4. Weekly Boss Battle Announcement (Official Contest Raid)

Posted automatically 2 hours before LeetCode Weekly Contest begins:
```
+-------------------------------------------------------------------------+
| 👹 WEEKLY BOSS BATTLE: THE RECURSION DRAGON                             |
+-------------------------------------------------------------------------+
| Official Event: LeetCode Weekly Contest 419                             |
| Starts: Sunday, 08:00 UTC (In 2 Hours)                                  |
| Raid Boss HP: 6,000 / 6,000 HP                                          |
|                                                                         |
| Raid Objectives:                                                        |
| • Solve Contest Problem 1: Deal 100 DMG                                 |
| • Solve Contest Problem 2: Deal 250 DMG                                 |
| • Solve Contest Problem 3: Deal 600 DMG                                 |
| • Solve Contest Problem 4: Deal 1,500 DMG                               |
|                                                                         |
| Guild Rewards:                                                          |
| • Boss Slain: +200 Guild XP to all participants + Boss Slayer Badge     |
| • Top Damage Dealer: +150 Bonus Seasonal XP                             |
+-------------------------------------------------------------------------+
| [Button: Join Boss Raid Party]   [Button: View Contest Link]            |
+-------------------------------------------------------------------------+
```

---

## 5. Visual Shareable Card Specs (Monthly Wrapped)

For Monthly Wrapped and Leaderboard share cards, DevGuild renders 1200x630 high-DPI PNG images via `@napi-rs/canvas`.

### Canvas Layout Architecture:
- **Dimensions**: `1200px` width $\times$ `630px` height (optimized for Discord and Twitter rich previews).
- **Background**: Deep gradient `#0F172A` $\to$ `#1E1B4B` with subtle hexagonal grid lines.
- **Header**:
  - DevGuild Logo & Guild Badge (top left).
  - User Discord Avatar (circular crop with rank-colored stroke, top right).
  - Header text: `MONTHLY WRAPPED • SEPTEMBER 2026`.
- **Primary Grid (4 Metric Tiles)**:
  - `Tile 1`: Total Solves (Huge font, breakdown: Easy/Med/Hard pills).
  - `Tile 2`: Favorite Topic (e.g., "Dynamic Programming — 42% of solves").
  - `Tile 3`: Consistency & Streak ("24 Days Active • Longest Streak: 18").
  - `Tile 4`: Contest Performance ("Rating +84 • 2 Boss Battles Slain").
- **Footer**:
  - Rank Tier Banner (e.g. `DIAMOND GUILD CODER • TOP 5%`).
  - QR Code or link watermark: `devguild.io/wrapped/c138f31b`.
