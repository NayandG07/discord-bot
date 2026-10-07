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

  static createProfileEmbed(user: any, profile: any, rankTier: RankTier): EmbedBuilder {
    const color = RANK_COLORS[rankTier] || 0xcd7f32;

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
          name: 'Guild Rank Tier',
          value: `**${rankTier}**`,
          inline: true,
        },
        {
          name: 'Reliability Score',
          value: `**${Number(user.reliabilityScore).toFixed(1)}%**`,
          inline: true,
        },
        {
          name: 'Streak Stats',
          value: `🔥 Current: **${user.currentStreak} Days**\n⚡ Max Streak: **${user.longestStreak} Days**`,
          inline: true,
        },
        {
          name: 'LeetCode Breakdown',
          value: `🟩 Easy: **${profile.easySolved}**\n🟨 Medium: **${profile.mediumSolved}**\n🟥 Hard: **${profile.hardSolved}**\n⭐ Total: **${profile.totalSolved}**`,
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
        const tier = entry.tier ? ` [${entry.tier}]` : '';
        const value = typeof entry.metricValue === 'number' ? entry.metricValue.toLocaleString() : entry.metricValue;
        return `${medal} **${entry.username}**${tier} — **${value}** ${entry.metricLabel}`;
      })
      .join('\n');

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
          `🚀 **1. Getting Started (Setup & Linking)**\n` +
          `• **/link \`<username>\`**: Connect your official LeetCode account.\n` +
          `  - You’ll receive a unique verification token.\n` +
          `  - Paste it into your LeetCode profile **"About Me"** bio and click **Verify**.\n` +
          `• **/sync**: Instantly sync your latest solves and update your rank on the fly!\n` +
          `• **/profile**: View your real-time stats, current streak, LeetCode contest rating, and rank tier.\n\n` +
          `🔥 **2. Daily Streaks & XP System**\n` +
          `• **Solve daily**: Every day you solve at least 1 problem keeps your streak alive.\n` +
          `• **Streak Multipliers**: Earn an additional **+2% XP per day** of your active streak (up to **+50% bonus!**).\n` +
          `• **Anti-Farming Protection**: Spamming easy questions triggers diminishing returns to encourage true skill progression.\n\n` +
          `👹 **3. Raid Boss Battles & Contests**\n` +
          `• **/boss**: Check countdowns for the next official LeetCode Weekly and Biweekly contests.\n` +
          `• During contests, the bot launches an automated server-wide **Mega Boss Raid**.\n` +
          `• Every problem you solve deals damage to the boss. Slay the boss together to earn server-wide loot!\n\n` +
          `⚔️ **4. Duels & Squads**\n` +
          `• **/challenge create**: Challenge your server peers to 1v1, 2v2, or 3v3 solve matches.\n` +
          `• **/team create \`<name>\` \`<tag>\`**: Create a permanent squad (e.g. \`[DEV] CodeCrushers\`).\n` +
          `• **/team stats \`<tag>\`**: Track squad rosters and collective power.\n\n` +
          `🏆 **5. Leaderboards & Analytics**\n` +
          `• **/leaderboard weekly**: Weekly XP leaderboard — resets Sunday midnight UTC.\n` +
          `• **/leaderboard streak**: Highest current consecutive days.\n` +
          `• **/leaderboard consistency**: Reliability score tracking.\n` +
          `• **/leaderboard contests**: Boss battle damage dealers.\n` +
          `• **/recap daily**: See who solved problems today and what questions they tackled.\n` +
          `• **/recap wrapped**: Generate your monthly summary graphic.\n\n` +
          `🔔 **Role Mentions**: Every time someone solves a question or a daily recap is posted, the **@DEV** role is notified in the alert channel!`,
      )
      .setFooter({ text: 'DevGuild • Consistency Over Intensity • Happy Coding! 💻' })
      .setTimestamp();
  }
}
