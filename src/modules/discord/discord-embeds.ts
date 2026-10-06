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
          value: `🔥 Current: **${user.currentStreak} Days**\n⚡ Longest: **${user.longestStreak} Days**`,
          inline: true,
        },
        {
          name: 'LeetCode Breakdown',
          value: `🟩 Easy: **${profile.easySolved}**\n🟨 Medium: **${profile.mediumSolved}**\n🟥 Hard: **${profile.hardSolved}**\n⭐ Total: **${profile.totalSolved}**`,
          inline: true,
        },
        {
          name: 'Contest Metrics',
          value: `Rating: **${profile.contestRating ? Number(profile.contestRating).toFixed(0) : 'Unranked'}**\nRank: **${profile.contestGlobalRank ? '#' + profile.contestGlobalRank : 'N/A'}**`,
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
}
