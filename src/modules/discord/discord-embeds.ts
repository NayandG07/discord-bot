import { EmbedBuilder } from 'discord.js';
import { RankTier } from '@prisma/client';

export const RANK_COLORS: Record<RankTier, number> = {
  [RankTier.BRONZE]: 0xcd7f32,
  [RankTier.SILVER]: 0xc0c0c0,
  [RankTier.GOLD]: 0xffd700,
  [RankTier.PLATINUM]: 0x00e5ff,
  [RankTier.DIAMOND]: 0x3d5afe,
  [RankTier.MASTER]: 0x9c27b0,
  [RankTier.GRANDMASTER]: 0xff1744,
};

export const RANK_NAMES: Record<RankTier, string> = {
  [RankTier.BRONZE]: '🪵 Code Initiate',
  [RankTier.SILVER]: '🛡️ Logic Sentinel',
  [RankTier.GOLD]: '🗡️ Algorithm Bladesmith',
  [RankTier.PLATINUM]: '🧙‍♂️ Recursion Sorcerer',
  [RankTier.DIAMOND]: '⚡ Dynamic Conjurer',
  [RankTier.MASTER]: '🐉 Raid Champion',
  [RankTier.GRANDMASTER]: '👑 Mythic Architect',
};

export class DiscordEmbeds {
  static createVerificationPrompt(token: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('🔐 DEVGUILD ACCOUNT VERIFICATION')
      .setColor(0x00e5ff)
      .setDescription(
        `Welcome to DevGuild! To securely link your LeetCode profile:\n\n` +
          `1. Copy this unique verification token:\n` +
          `\`\`\`\n${token}\n\`\`\`\n` +
          `2. Go to [LeetCode Profile Settings](https://leetcode.com/profile/) and paste this token into your **"About Me"** section.\n` +
          `3. Click the **"Verify Now"** button below within 15 minutes.`,
      )
      .setFooter({ text: 'DevGuild Security Protocol • One Discord per LeetCode account' })
      .setTimestamp();
  }

  static createProfileEmbed(user: any, profile: any, rankTier: RankTier, guildXp = 0, botSolves = 0): EmbedBuilder {
    const color = RANK_COLORS[rankTier] || 0xcd7f32;
    const rankTitle = RANK_NAMES[rankTier] || rankTier;

    return new EmbedBuilder()
      .setTitle(`⚔️ DEVGUILD CODER PROFILE — ${user.username}`)
      .setColor(color)
      .setThumbnail(user.avatarUrl || profile.avatar || null)
      .addFields(
        {
          name: 'LeetCode Account',
          value: `[${profile.username}](https://leetcode.com/${profile.username})`,
          inline: true,
        },
        {
          name: 'Guild Rank & XP',
          value: `Rank: **${rankTitle}**\nTotal XP: ⭐ **${guildXp.toLocaleString()} XP**`,
          inline: true,
        },
        {
          name: 'Reliability Score',
          value: `**${Number(user.reliabilityScore).toFixed(1)}%**`,
          inline: true,
        },
        {
          name: 'Streak Stats',
          value: `🔥 Bot Streak: **${user.currentStreak} Days**\n⚡ LC Max Streak: **${user.longestStreak} Days**`,
          inline: true,
        },
        {
          name: 'Solves Tracking',
          value: `🤖 DevGuild Solves: **${botSolves}**\n🧩 LC Lifetime: **${profile.totalSolved}**\n*(🟩 ${profile.easySolved} · 🟨 ${profile.mediumSolved} · 🟥 ${profile.hardSolved})*`,
          inline: true,
        },
        {
          name: 'Contest Metrics',
          value: `Rating: **${profile.contestRating ? Math.round(Number(profile.contestRating)).toLocaleString() : 'Unranked'}**\nRank: **${profile.contestGlobalRank ? '#' + Number(profile.contestGlobalRank).toLocaleString() : 'N/A'}**`,
          inline: true,
        },
      )
      .setFooter({ text: 'DevGuild Competitive League' })
      .setTimestamp();
  }

  static createChallengeLobbyEmbed(challenge: any, hostUser: any): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`⚔️ CHALLENGE LOBBY — ${challenge.format.replace(/_/g, ' ')}`)
      .setColor(0x00e676)
      .setDescription(
        `Host: **${hostUser.username}**\n` +
          `Duration: **${challenge.durationHours} Hours**\n` +
          `Intensity: **${challenge.intensity}**\n\n` +
          `Click below to join a team slot or accept your invitation.`,
      )
      .setFooter({ text: 'DevGuild Challenge Engine' })
      .setTimestamp();
  }

  static createBossBattleEmbed(boss: any): EmbedBuilder {
    const healthPercent = Math.max(0, Math.round((boss.currentHealthPoints / boss.totalHealthPoints) * 100));
    const barLength = 20;
    const filled = Math.round((healthPercent / 100) * barLength);
    const healthBar = '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, barLength - filled));

    const endUnix = boss.contest ? Math.floor(new Date(boss.contest.endTime).getTime() / 1000) : 0;
    const startMs = boss.contest ? new Date(boss.contest.startTime).getTime() : 0;
    const isCritActive = Date.now() < startMs + 30 * 60 * 1000;

    const embed = new EmbedBuilder()
      .setTitle(`👹 RAID EVENT: ${boss.bossName.toUpperCase()}`)
      .setColor(0xe040fb)
      .setDescription(
        `**Official LeetCode ${boss.contest?.title || 'Contest'} Raid**\n\n` +
          `⏱️ **Raid Status**: 🔴 **LIVE IN SESSION** (Ends <t:${endUnix}:R>)\n` +
          (isCritActive
            ? `⚡ **CRITICAL STRIKE WINDOW ACTIVE**: Solves right now deal **+25% Critical Damage**!\n\n`
            : `⚡ **Standard Strike Phase**: Raid currently underway!\n\n`) +
          `Boss Health: **${boss.currentHealthPoints.toLocaleString()} / ${boss.totalHealthPoints.toLocaleString()} HP** (${healthPercent}%)\n` +
          `\`[${healthBar}]\`\n\n` +
          `⚔️ **Damage Formula per Solve**:\n` +
          `• **Q1 (Easy)**: 💥 **100 DMG** (+10 XP)\n` +
          `• **Q2 (Medium)**: 💥 **250 DMG** (+30 XP)\n` +
          `• **Q3 (Medium/Hard)**: 💥 **600 DMG** (+75 XP)\n` +
          `• **Q4 (Hard)**: 💥 **1,500 DMG** (+150 XP)\n\n` +
          `Solve problems on LeetCode and run \`/sync\` to deal damage to the Boss! Defeating the boss awards Guild XP bonuses and the **Boss Slayer** badge!\n\n` +
          `*Check past raid damage with \`/leaderboard contests\`.*`,
      );

    if (boss.participants && boss.participants.length > 0) {
      const sorted = [...boss.participants].sort((a: any, b: any) => b.damageDealt - a.damageDealt);
      const topList = sorted
        .slice(0, 5)
        .map((p: any, idx: number) => {
          const medal = idx === 0 ? '👑 MVP' : `#${idx + 1}`;
          return `${medal} **${p.user?.username || 'Coder'}**: 💥 **${p.damageDealt.toLocaleString()} DMG** (${p.problemsSolved} solves)`;
        })
        .join('\n');
      embed.addFields({ name: `🛡️ Raid Party Leaderboard (${boss.participants.length} Active)`, value: topList });
    } else {
      embed.addFields({ name: '🛡️ Raid Party', value: 'No damage dealt yet! Be the first to strike the boss with `/sync`.' });
    }

    embed.setFooter({ text: 'DevGuild Boss Battle Engine • Automated Raid Alerts' });
    embed.setTimestamp();
    return embed;
  }

  static renderProgressBar(current: number, total: number, length: number = 10): string {
    if (total <= 0) return '■'.repeat(length);
    const progress = Math.min(1, Math.max(0, current / total));
    const filled = Math.round(progress * length);
    const empty = length - filled;
    return '■'.repeat(filled) + '□'.repeat(empty);
  }

  static createSolveAlertEmbed(
    user: any,
    activity: any,
    xpAwarded?: number,
    goalProgress?: { current: number; target: number; period: string },
  ): EmbedBuilder {
    const diffEmoji = activity.difficulty === 'HARD' ? '🟥' : activity.difficulty === 'MEDIUM' ? '🟨' : '🟩';
    const color = activity.difficulty === 'HARD' ? 0xff1744 : activity.difficulty === 'MEDIUM' ? 0xffd700 : 0x00e676;

    const embed = new EmbedBuilder()
      .setTitle(`${diffEmoji} NEW PROBLEM SOLVED!`)
      .setColor(color)
      .setDescription(
        `**${user.username}** just solved **[${activity.problemTitle}](https://leetcode.com/problems/${activity.problemSlug}/)**!`,
      )
      .addFields(
        { name: 'Difficulty', value: `\`${activity.difficulty}\``, inline: true },
        { name: 'Topic', value: `\`${(activity.primaryTopic || 'ALGORITHMS').replace(/_/g, ' ')}\``, inline: true },
        { name: 'Streak', value: `🔥 **${user.currentStreak} Days**`, inline: true },
      )
      .setFooter({ text: 'DevGuild Automated Activity Tracker' })
      .setTimestamp(activity.submissionTimestamp ? new Date(activity.submissionTimestamp) : new Date());

    if (xpAwarded) {
      embed.addFields({ name: 'XP Awarded', value: `⭐ **+${xpAwarded} XP**`, inline: true });
    }

    if (goalProgress) {
      const isMet = goalProgress.current >= goalProgress.target;
      embed.addFields({
        name: `🎯 ${goalProgress.period} Goal`,
        value: isMet
          ? `✅ **Target Achieved!** (${goalProgress.current}/${goalProgress.target})`
          : `⏳ **${goalProgress.current}/${goalProgress.target} Solved** (${goalProgress.target - goalProgress.current} left)`,
        inline: true,
      });
    }

    if (user.avatarUrl) {
      embed.setThumbnail(user.avatarUrl);
    }

    return embed;
  }

  static createDailyRecapEmbed(summary: any): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('📊 DEVGUILD DAILY RECAP')
      .setColor(0x00e5ff)
      .setDescription(
        `Here is the 24-hour guild LeetCode digest!\n\n` +
          `• Total Problems Solved: **${summary.totalSolves}**\n` +
          `• Active Coders: **${summary.activeSolversCount}**\n` +
          `• Total Guild XP Earned: **+${(summary.totalXpEarned || 0).toLocaleString()} XP**\n\n` +
          `**Difficulty Distribution**:\n` +
          `🟩 Easy: **${summary.difficultyDistribution?.easy ?? 0}**  |  🟨 Medium: **${summary.difficultyDistribution?.medium ?? 0}**  |  🟥 Hard: **${summary.difficultyDistribution?.hard ?? 0}**`,
      )
      .setFooter({ text: 'DevGuild Daily Digest • Consistency over intensity' })
      .setTimestamp();

    if (summary.solvers && summary.solvers.length > 0) {
      const solversText = summary.solvers
        .map((s: any, idx: number) => {
          const medal = idx === 0 ? '👑' : '⭐';
          const breakdown = `(${s.easy}E / ${s.medium}M / ${s.hard}H)`;
          const problemSample = s.problems.slice(0, 3).join(', ');
          const more = s.problems.length > 3 ? ` +${s.problems.length - 3} more` : '';
          return `${medal} **${s.username}** — **${s.solvesCount} solve${s.solvesCount > 1 ? 's' : ''}** ${breakdown}\n└ *${problemSample}${more}*`;
        })
        .join('\n\n');

      embed.addFields({
        name: '👥 Coders Active Today',
        value: solversText.length > 1024 ? solversText.substring(0, 1020) + '...' : solversText,
      });
    }

    return embed;
  }

  static createWeeklyRecapEmbed(summary: any): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('📊 DEVGUILD WEEKLY RECAP (PAST 7 DAYS)')
      .setColor(0x00e5ff)
      .setDescription(
        `Here is the 7-day guild LeetCode digest!\n\n` +
          `• Total Problems Solved: **${summary.totalSolves}**\n` +
          `• Active Coders This Week: **${summary.activeSolversCount}**\n` +
          `• Total Guild XP Earned: **+${(summary.totalXpEarned || 0).toLocaleString()} XP**\n\n` +
          `**Difficulty Distribution**:\n` +
          `🟩 Easy: **${summary.difficultyDistribution?.easy ?? 0}**  |  🟨 Medium: **${summary.difficultyDistribution?.medium ?? 0}**  |  🟥 Hard: **${summary.difficultyDistribution?.hard ?? 0}**`,
      )
      .setFooter({ text: 'DevGuild Weekly Digest • Consistency over intensity' })
      .setTimestamp();

    if (summary.solvers && summary.solvers.length > 0) {
      const solversText = summary.solvers
        .map((s: any, idx: number) => {
          const medal = idx === 0 ? '👑' : '⭐';
          const breakdown = `(${s.easy}E / ${s.medium}M / ${s.hard}H)`;
          const problemSample = s.problems.slice(0, 4).join(', ');
          const more = s.problems.length > 4 ? ` +${s.problems.length - 4} more` : '';
          return `${medal} **${s.username}** — **${s.solvesCount} solve${s.solvesCount > 1 ? 's' : ''}** ${breakdown}\n└ *${problemSample}${more}*`;
        })
        .join('\n\n');

      embed.addFields({
        name: '👥 Coders Active This Week',
        value: solversText.length > 1024 ? solversText.substring(0, 1020) + '...' : solversText,
      });
    }

    return embed;
  }

  static createLeaderboardEmbed(title: string, entries: any[]): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`🏆 DEVGUILD LEADERBOARD — ${title.toUpperCase()}`)
      .setColor(0xffd700)
      .setFooter({ text: 'DevGuild Competitive Rankings • Updated Realtime' })
      .setTimestamp();

    if (!entries || entries.length === 0) {
      embed.setDescription('No active entries found for this leaderboard yet. Start solving to claim the #1 spot! 🔥');
      return embed;
    }

    const rankEmojis = ['🥇', '🥈', '🥉'];
    const description = entries
      .map((entry, idx) => {
        const medal = rankEmojis[idx] || `\`#${entry.rank}\``;
        const tier = entry.tier ? ` \`[${(RANK_NAMES as any)[entry.tier] || entry.tier}]\`` : '';
        const value = typeof entry.metricValue === 'number' ? entry.metricValue.toLocaleString() : entry.metricValue;
        let line = `${medal} **${entry.username}**${tier} — **${value}** ${entry.metricLabel}`;

        const details: string[] = [];
        if (entry.botSolved !== undefined) {
          details.push(`🤖 **${entry.botSolved}** Bot Solves`);
        }
        if (entry.totalSolved !== undefined && entry.totalSolved > 0) {
          const breakdown =
            entry.easy !== undefined ? ` (${entry.easy}E • ${entry.medium}M • ${entry.hard}H)` : '';
          details.push(`🧩 **${entry.totalSolved}** LC Total${breakdown}`);
        }
        if (entry.streak !== undefined) {
          details.push(`🔥 **${entry.streak}d** Bot Streak`);
        }
        if (entry.longestStreak !== undefined && entry.longestStreak > 0) {
          details.push(`⚡ **${entry.longestStreak}d** LC Max`);
        }
        if (entry.contestRating && entry.contestRating > 0) {
          details.push(`⭐ **${Math.round(Number(entry.contestRating)).toLocaleString()}** Rating`);
        }
        if (entry.problemsSolved !== undefined && entry.problemsSolved > 0) {
          details.push(`⚔️ **${entry.problemsSolved}** Contest Solves`);
        }
        if (details.length > 0) {
          line += `\n   └ ${details.join(' | ')}`;
        }
        return line;
      })
      .join('\n\n');

    embed.setDescription(description);
    return embed;
  }

  static createUpcomingContestsEmbed(scheduleInfo?: any): EmbedBuilder {
    let weeklyUnix: number;
    let biweeklyUnix: number;

    if (scheduleInfo?.upcomingBiweekly && scheduleInfo?.upcomingWeekly) {
      biweeklyUnix = Math.floor(new Date(scheduleInfo.upcomingBiweekly.start).getTime() / 1000);
      weeklyUnix = Math.floor(new Date(scheduleInfo.upcomingWeekly.start).getTime() / 1000);
    } else {
      const now = new Date();
      const refBiweekly = new Date('2024-10-12T14:30:00Z').getTime();
      const twoWeeks = 14 * 24 * 60 * 60 * 1000;
      const bDiff = now.getTime() - refBiweekly;
      const bCycle = Math.floor(bDiff / twoWeeks);
      const curBStart = new Date(refBiweekly + bCycle * twoWeeks);
      const nextBStart = new Date(refBiweekly + (bCycle + 1) * twoWeeks);
      const upcomingB = now < curBStart ? curBStart : nextBStart;
      biweeklyUnix = Math.floor(upcomingB.getTime() / 1000);

      const refWeekly = new Date('2024-10-13T02:30:00Z').getTime();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      const wDiff = now.getTime() - refWeekly;
      const wCycle = Math.floor(wDiff / oneWeek);
      const curWStart = new Date(refWeekly + wCycle * oneWeek);
      const nextWStart = new Date(refWeekly + (wCycle + 1) * oneWeek);
      const upcomingW = now < curWStart ? curWStart : nextWStart;
      weeklyUnix = Math.floor(upcomingW.getTime() / 1000);
    }

    return new EmbedBuilder()
      .setTitle('⚔️ LEETCODE RAID BOSS RADAR & CONTEST SCHEDULE')
      .setColor(0xe040fb)
      .setDescription(
        `**No active Boss Battle raid currently in session.**\n` +
          `Boss Battles activate automatically during official LeetCode Weekly & Biweekly Contests! Prepare your algorithms and rally your guild mates.\n\n` +
          `**Upcoming Official Contests:**\n\n` +
          `🏆 **Next Biweekly Contest**\n` +
          `• Time: <t:${biweeklyUnix}:F> (<t:${biweeklyUnix}:R>)\n` +
          `• Format: 4 algorithmic problems • 90 minutes\n\n` +
          `🏆 **Next Weekly Contest**\n` +
          `• Time: <t:${weeklyUnix}:F> (<t:${weeklyUnix}:R>)\n` +
          `• Format: 4 algorithmic problems • 90 minutes\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👹 **How Boss Battles Work**:\n` +
          `• The server collectively fights a massive Mega Boss scaled to guild size.\n` +
          `• Every problem you solve during the contest deals raw damage to the Boss:\n` +
          `  - **Q1 (Easy)**: 💥 **100 DMG** (+10 XP)\n` +
          `  - **Q2 (Medium)**: 💥 **250 DMG** (+30 XP)\n` +
          `  - **Q3 (Medium/Hard)**: 💥 **600 DMG** (+75 XP)\n` +
          `  - **Q4 (Hard)**: 💥 **1,500 DMG** (+150 XP)\n` +
          `• ⚡ **Critical Strike**: Solves submitted in the first 30 minutes deal **+25% Critical Damage**!\n` +
          `• 🏅 **Loot**: Defeating the boss awards the *Boss Slayer* role, Guild XP bonuses, and raid badges!\n\n` +
          `*Check past raid damage with \`/leaderboard contests\`.*`,
      )
      .setFooter({ text: 'DevGuild Boss Battle Engine • Automated Raid Alerts' })
      .setTimestamp();
  }

  static createGuideEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('📖 DEVGUILD — ULTIMATE SURVIVAL & MASTERY GUIDE')
      .setColor(0x5865f2)
      .setDescription(
        `Welcome to **DevGuild**! DevGuild turns daily LeetCode practice into an interactive, gamified RPG where consistency, teamwork, and problem-solving level you up.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🚀 **1. Getting Started**\n` +
          `• **/link \`<username>\`**: Connect your official LeetCode account with a bio token verification.\n` +
          `• **/sync**: Check LeetCode for new submissions and broadcast your latest solves.\n` +
          `• **/profile**: View your real-time stats, current streak, guild rank title, and XP.\n\n` +
          `👑 **2. Guild Rank Hierarchy (RPG Ladder)**\n` +
          `• 🪵 **Code Initiate**: 0 – 749 XP\n` +
          `• 🛡️ **Logic Sentinel**: 750 – 2,499 XP\n` +
          `• 🗡️ **Algorithm Bladesmith**: 2,500 – 5,999 XP\n` +
          `• 🧙‍♂️ **Recursion Sorcerer**: 6,000 – 11,999 XP *(Reliability ≥ 70%)*\n` +
          `• ⚡ **Dynamic Conjurer**: 12,000 – 19,999 XP *(Reliability ≥ 80%)*\n` +
          `• 🐉 **Raid Champion**: 20,000 – 34,999 XP *(Reliability ≥ 85% + 3 Contests)*\n` +
          `• 👑 **Mythic Architect**: 35,000+ XP *(Reliability ≥ 90% + 5 Contests + 5 Duel Wins)*\n\n` +
          `⭐ **3. Problem Solve XP Economy**\n` +
          `• 🟩 **Easy**: **25 XP**  |  🟨 **Medium**: **60 XP**  |  🟥 **Hard**: **150 XP**\n` +
          `• **Guild Solves vs. LC Lifetime**: Guild XP and Bot Solves track problems solved *since joining DevGuild*. Historical solves from before joining are preserved under \`🧩 LC Total\`.\n` +
          `• **Relaxed Anti-Farming**: Solve alongside course lectures without penalty!\n` +
          `  - Solves 1–10 (Easy): **100% full XP**\n` +
          `  - Solves 11–20 (Easy): **80% XP**\n` +
          `  - Solves 21+ (Easy): **50% XP floor**\n` +
          `  - *Medium and Hard problems NEVER face diminishing returns (always 100% XP)!*\n\n` +
          `🔥 **4. Streaks & Milestone Bursts**\n` +
          `• **Streak Multiplier**: Earn **+2% bonus XP per day** of your active streak (up to **+50% bonus**).\n` +
          `• **Milestone XP Bursts** (awarded automatically upon reaching):\n` +
          `  - **7 Days**: +100 XP  |  **14 Days**: +250 XP  |  **30 Days**: +600 XP\n` +
          `  - **60 Days**: +1,500 XP  |  **90 Days**: +2,500 XP  |  **180 Days**: +5,000 XP\n` +
          `  - **365 Days**: 🌟 **+12,000 XP**\n\n` +
          `👹 **5. Boss Battle Raids & Contests**\n` +
          `• **/boss**: View countdown radar for the next official LeetCode Weekly and Biweekly contests.\n` +
          `• During contests, participate in the server-wide **Mega Boss Raid**.\n` +
          `• Solve contest problems to deal damage: Q1: 100 | Q2: 250 | Q3: 600 | Q4: 1,500 DMG.\n` +
          `• ⚡ **Critical Strikes**: Solves in the first 30 minutes deal **+25% Critical Damage**!\n\n` +
          `🏆 **6. Leaderboards & Squads**\n` +
          `• **/leaderboard all**: Cumulative all-time Guild XP, problems solved breakdown, and contest ratings.\n` +
          `• **/leaderboard weekly / streak / consistency / contests**: Specialized seasonal rankings.\n` +
          `• **/challenge create**: Challenge peers to 1v1, 2v2, or 3v3 solve matches.\n` +
          `• **/team create** & **/team stats**: Create permanent squads and rosters.\n\n` +
          `🎯 **7. Personal Goals & Strict Accountability**\n` +
          `• **/goal day \`<num>\`**: Lock in a daily target of problems to solve today before midnight UTC.\n` +
          `• **/goal week \`<num>\`**: Lock in a weekly target of problems to solve before Sunday midnight UTC.\n` +
          `• **/goal status**: Check live progress, progress bars, deadlines, and penalties at risk.\n` +
          `• **/goal cancel**: Cancel an active goal.\n` +
          `• ⏰ **Automated Reminders**: Reminders are delivered to the activity channel, tagging **you only**.\n` +
          `• ⚠️ **Accountability Clause**: Completing goals awards **NO bonuses** (discipline is its own reward). If you fail to hit your target before deadline, you are **PENALIZED**:\n` +
          `  - Daily failure: **-50 XP** and **-5.0% Reliability**\n` +
          `  - Weekly failure: **-150 XP** and **-10.0% Reliability**\n\n` +
          `📊 **8. Community Recaps & Digest**\n` +
          `• **/recap daily**: 24-hour guild solve recap and active coder list.\n` +
          `• **/recap weekly**: Past 7-day solve digest, top solvers, and difficulty breakdown.\n` +
          `• **/recap wrapped**: Generate your personal Monthly Wrapped graphic card!\n\n` +
          `• 🔔 The **@DEV** role is tagged automatically on solves and digest recaps!`,
      )
      .setFooter({ text: 'DevGuild • Consistency Over Intensity • Happy Coding! 💻' })
      .setTimestamp();
  }

  static createGoalSetEmbed(goal: any): EmbedBuilder {
    const periodLabel = goal.period === 'DAY' ? 'Daily' : 'Weekly';
    const endUnix = Math.floor(new Date(goal.endsAt).getTime() / 1000);
    const isCompleted = goal.isComplete;

    return new EmbedBuilder()
      .setTitle(`🎯 ${periodLabel} Goal Locked: ${goal.targetCount} Problems!`)
      .setColor(isCompleted ? 0x2ecc71 : 0x5865f2)
      .setDescription(
        `You have committed to solve **${goal.targetCount} problem${goal.targetCount === 1 ? '' : 's'}** ${goal.period === 'DAY' ? 'today' : 'this week'}.\n\n` +
          `• **Current Progress**: **${goal.currentCount}/${goal.targetCount}** solved\n` +
          `• **Remaining Needed**: **${goal.remaining}** problem${goal.remaining === 1 ? '' : 's'}\n` +
          `• **Deadline**: <t:${endUnix}:F> (<t:${endUnix}:R>)\n\n` +
          `⚠️ **ACCOUNTABILITY CLAUSE (STRICT ENFORCEMENT)**:\n` +
          `• If you **fail** to hit your target before the deadline, you will be penalized:\n` +
          `  - 📉 **-${goal.penaltyXp} Guild XP**\n` +
          `  - 📉 **-${Number(goal.penaltyReliability).toFixed(1)}% Reliability Score**\n` +
          `• **NO BONUSES**: Fulfilling this goal does NOT grant bonus XP or multipliers. This is for pure accountability and discipline.`,
      )
      .setFooter({ text: 'DevGuild Accountability Engine • Automated Reminder Alerts Enabled' })
      .setTimestamp();
  }

  static createGoalStatusEmbed(goals: any[], username: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`🎯 Active Goals & Accountability — ${username}`)
      .setColor(0x5865f2)
      .setTimestamp();

    if (goals.length === 0) {
      embed.setDescription(
        `You currently have no active goals.\n\n` +
          `Use \`/goal day num:<count>\` to set a daily goal, or \`/goal week num:<count>\` for a weekly target!`,
      );
      return embed;
    }

    const goalDescriptions = goals.map((g) => {
      const periodLabel = g.period === 'DAY' ? 'Daily Goal' : 'Weekly Goal';
      const endUnix = Math.floor(new Date(g.endsAt).getTime() / 1000);
      const progressBar = DiscordEmbeds.renderProgressBar(g.currentCount, g.targetCount, 10);
      const statusIcon = g.isComplete ? '✅ **Target Met!**' : `⏳ **${g.remaining} left**`;

      return (
        `📌 **${periodLabel}**: **${g.targetCount} Problems**\n` +
        `• Progress: \`[${progressBar}]\` **${g.currentCount}/${g.targetCount}** (${statusIcon})\n` +
        `• Deadline: <t:${endUnix}:R> (<t:${endUnix}:t>)\n` +
        `• Penalty at Risk: **-${g.penaltyXp} XP** | **-${Number(g.penaltyReliability).toFixed(1)}% Reliability**`
      );
    });

    embed.setDescription(
      `Here is your live goal status. Hit your targets before the deadline to protect your XP and Reliability!\n\n` +
        goalDescriptions.join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n') +
        `\n\n*Note: Goals yield no bonuses upon completion. Failing a goal enforces penalties immediately.*`,
    );

    return embed;
  }

  static createGoalReminderEmbed(candidate: any): EmbedBuilder {
    const periodLabel = candidate.period === 'DAY' ? 'Daily' : 'Weekly';
    const endUnix = Math.floor(new Date(candidate.endsAt).getTime() / 1000);
    const progressBar = DiscordEmbeds.renderProgressBar(candidate.currentCount, candidate.targetCount, 10);

    return new EmbedBuilder()
      .setTitle(`⏰ TARGET REMINDER: ${periodLabel} Goal`)
      .setColor(0xe67e22)
      .setDescription(
        `Friendly nudge! You pledged to solve **${candidate.targetCount} problem${candidate.targetCount === 1 ? '' : 's'}** ${candidate.period === 'DAY' ? 'today' : 'this week'}.\n\n` +
          `• **Progress**: \`[${progressBar}]\` **${candidate.currentCount}/${candidate.targetCount}** solved\n` +
          `• **Remaining**: **${candidate.remaining}** problem${candidate.remaining === 1 ? '' : 's'} needed\n` +
          `• **Time Left**: <t:${endUnix}:R> (<t:${endUnix}:F>)\n\n` +
          `⚠️ **Penalty at Risk**:\n` +
          `Failure will cost you **-${candidate.penaltyXp} XP** and **-${Number(candidate.penaltyReliability).toFixed(1)}% Reliability Score**!\n\n` +
          `*Fire up LeetCode and finish your target!* 💻`,
      )
      .setFooter({ text: 'DevGuild Accountability Radar' })
      .setTimestamp();
  }

  static createGoalPenaltyEmbed(penalty: {
    period: string;
    targetCount: number;
    completedCount: number;
    penaltyXp: number;
    penaltyReliability: number;
  }): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('⚠️ GOAL FAILED — PENALTY ENFORCED')
      .setColor(0xed4245)
      .setDescription(
        `The deadline for your **${penalty.period === 'DAY' ? 'Daily' : 'Weekly'} Goal** has passed.\n\n` +
          `• Target: **${penalty.targetCount} problems**\n` +
          `• Solved: **${penalty.completedCount}/${penalty.targetCount}**\n\n` +
          `💥 **PENALTIES APPLIED**:\n` +
          `• 📉 **-${penalty.penaltyXp} Guild XP** deducted from your profile\n` +
          `• 📉 **-${Number(penalty.penaltyReliability).toFixed(1)}% Reliability Score** deducted\n\n` +
          `*Accountability is hard, but consistency is key. Dust yourself off and set a new goal with \`/goal\`!*`,
      )
      .setFooter({ text: 'DevGuild Accountability Engine' })
      .setTimestamp();
  }
}
