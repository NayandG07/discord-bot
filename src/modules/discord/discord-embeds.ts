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
    const healthPercent = Math.round((boss.currentHealthPoints / boss.totalHealthPoints) * 100);
    const barLength = 20;
    const filled = Math.round((healthPercent / 100) * barLength);
    const healthBar = '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, barLength - filled));

    return new EmbedBuilder()
      .setTitle(`👹 RAID EVENT: ${boss.bossName.toUpperCase()}`)
      .setColor(0xe040fb)
      .setDescription(
        `**Official LeetCode Contest Raid**\n\n` +
          `Boss Health: **${boss.currentHealthPoints.toLocaleString()} / ${boss.totalHealthPoints.toLocaleString()} HP** (${healthPercent}%)\n` +
          `\`[${healthBar}]\`\n\n` +
          `⚔️ **Damage Formula**:\n` +
          `• Q1: 100 DMG  |  Q2: 250 DMG\n` +
          `• Q3: 600 DMG  |  Q4: 1,500 DMG\n\n` +
          `Solve contest questions to defeat the boss and earn Guild XP & Boss Slayer badges!`,
      )
      .setFooter({ text: 'DevGuild Raid Boss Engine' })
      .setTimestamp();
  }

  static createSolveAlertEmbed(user: any, activity: any, xpAwarded?: number): EmbedBuilder {
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

  static createUpcomingContestsEmbed(): EmbedBuilder {
    const now = new Date();

    // Next Weekly Contest: Sunday at 02:30 UTC
    const nextWeekly = new Date(now);
    const daysUntilSunday = (7 - now.getUTCDay()) % 7;
    const isSundayPastContest = daysUntilSunday === 0 && (now.getUTCHours() > 4 || (now.getUTCHours() === 4 && now.getUTCMinutes() > 0));
    nextWeekly.setUTCDate(now.getUTCDate() + (isSundayPastContest ? 7 : daysUntilSunday));
    nextWeekly.setUTCHours(2, 30, 0, 0);

    // Next Biweekly Contest: Alternate Saturday at 14:30 UTC
    const refBiweekly = new Date('2024-10-12T14:30:00Z').getTime();
    const twoWeeks = 14 * 24 * 60 * 60 * 1000;
    const diff = now.getTime() - refBiweekly;
    const remainder = diff % twoWeeks;
    const nextBiweekly = new Date(now.getTime() + (twoWeeks - remainder));

    const weeklyUnix = Math.floor(nextWeekly.getTime() / 1000);
    const biweeklyUnix = Math.floor(nextBiweekly.getTime() / 1000);

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
          `• **/team create** & **/team stats**: Create permanent squads and rosters.\n` +
          `• 🔔 The **@DEV** role is tagged automatically on solves and daily digest recaps!`,
      )
      .setFooter({ text: 'DevGuild • Consistency Over Intensity • Happy Coding! 💻' })
      .setTimestamp();
  }
}
