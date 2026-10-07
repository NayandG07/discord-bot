import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ButtonInteraction,
} from 'discord.js';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LeetCodeService } from '../leetcode/leetcode.service';
import { ReliabilityService } from '../reliability/reliability.service';
import { RecapService } from '../recaps/recap.service';
import { ActivityService } from '../activity/activity.service';
import { ProblemDifficulty } from '@prisma/client';
import { DiscordEmbeds } from './discord-embeds';
import { SLASH_COMMANDS } from './discord.commands';
import { ActivityCreatedEventPayload } from '../activity/activity.types';
import * as crypto from 'crypto';

@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordService.name);
  private client: Client;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly leetcode: LeetCodeService,
    private readonly reliability: ReliabilityService,
    private readonly recap: RecapService,
    private readonly activity: ActivityService,
  ) {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });
  }

  onModuleInit() {
    const rawToken = this.config.get<string>('DISCORD_BOT_TOKEN');
    const token = rawToken?.trim().replace(/^["']|["']$/g, '');
    if (!token) {
      this.logger.warn('DISCORD_BOT_TOKEN not provided. Discord Bot Client will not start.');
      return;
    }

    this.registerEventHandlers();
    this.initDiscord(token).catch((err) => {
      this.logger.error(`Discord initialization error: ${err.message}`, err.stack);
    });
  }

  private async initDiscord(token: string) {
    try {
      this.logger.log(`TOKEN_DEBUG: length=${token.length}, prefix="${token.substring(0, 12)}", suffix="${token.substring(token.length - 6)}"`);
      this.logger.log(`Connecting DevGuild to Discord Gateway (token prefix: ${token.substring(0, 8)}...)...`);
      await this.client.login(token);
      this.logger.log(`Discord login successful. Tag: ${this.client.user?.tag}`);
      await this.registerSlashCommands();
    } catch (err: any) {
      this.logger.error(`Failed to initialize Discord client: ${err.message}`, err.stack);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      this.logger.log('Destroying Discord client connection...');
      await this.client.destroy();
    }
  }

  getClient(): Client {
    return this.client;
  }

  private async registerSlashCommands() {
    const rawToken = this.config.get<string>('DISCORD_BOT_TOKEN');
    const rawClientId = this.config.get<string>('DISCORD_CLIENT_ID');
    const token = rawToken?.trim().replace(/^["']|["']$/g, '');
    const clientId = rawClientId?.trim().replace(/^["']|["']$/g, '');
    if (!token || !clientId) {
      this.logger.warn('DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID missing; skipping slash commands registration.');
      return;
    }

    const rest = new REST({ version: '10' }).setToken(token);
    try {
      this.logger.log('Registering global Discord slash commands...');
      await rest.put(Routes.applicationCommands(clientId), {
        body: SLASH_COMMANDS.map((cmd) => cmd.toJSON()),
      });
      this.logger.log('Successfully registered all global slash commands.');
    } catch (err: any) {
      this.logger.error(`Failed to register slash commands: ${err.message}`);
    }
  }

  private registerEventHandlers() {
    this.client.on('ready', () => {
      this.logger.log(`DevGuild Discord Bot ready as ${this.client.user?.tag}!`);
    });

    this.client.on('clientReady', () => {
      this.logger.log(`DevGuild Discord Bot clientReady: ${this.client.user?.tag}`);
    });

    this.client.on('error', (err) => {
      this.logger.error(`Discord client error: ${err.message}`, err.stack);
    });

    this.client.on('shardError', (err) => {
      this.logger.error(`Discord WebSocket shard error: ${err.message}`, err.stack);
    });

    this.client.on('shardDisconnect', (event) => {
      this.logger.warn(`Discord shard disconnected (code ${event.code}): ${event.reason}`);
    });

    this.client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          this.logger.log(`Received command /${interaction.commandName} from ${interaction.user.username}`);
          await this.handleSlashCommand(interaction);
        } else if (interaction.isButton()) {
          this.logger.log(`Received button interaction ${interaction.customId} from ${interaction.user.username}`);
          await this.handleButtonInteraction(interaction);
        }
      } catch (err: any) {
        this.logger.error(`Error handling interaction: ${err.message}`, err.stack);
        try {
          if (interaction.isRepliable()) {
            const content = '⚠️ An internal error occurred while executing this command.';
            if (interaction.deferred || interaction.replied) {
              await interaction.followUp({ content, flags: 64 });
            } else {
              await interaction.reply({ content, flags: 64 });
            }
          }
        } catch (replyErr: any) {
          this.logger.error(`Failed to deliver interaction error response: ${replyErr.message}`);
        }
      }
    });
  }

  private async handleSlashCommand(interaction: ChatInputCommandInteraction) {
    const { commandName } = interaction;

    if (commandName === 'setup-channel') {
      if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({ content: '❌ This command can only be executed inside a Discord server.', flags: 64 });
        return;
      }

      await interaction.deferReply({ flags: 64 });
      const alertType = interaction.options.getString('type') || 'all';
      const targetChannel = interaction.options.getChannel('channel', true);

      // Ensure guild exists in database
      const guild = await this.prisma.guild.upsert({
        where: { discordGuildId: interaction.guildId },
        update: { name: interaction.guild.name, iconUrl: interaction.guild.iconURL() },
        create: {
          discordGuildId: interaction.guildId,
          name: interaction.guild.name,
          iconUrl: interaction.guild.iconURL(),
        },
      });

      // Update NotificationConfig
      const updateData: any = {};
      if (alertType === 'all') {
        updateData.activityChannelId = targetChannel.id;
        updateData.recapChannelId = targetChannel.id;
        updateData.bossBattleChannelId = targetChannel.id;
        updateData.challengeChannelId = targetChannel.id;
      } else if (alertType === 'activity') {
        updateData.activityChannelId = targetChannel.id;
      } else if (alertType === 'recap') {
        updateData.recapChannelId = targetChannel.id;
      } else if (alertType === 'boss') {
        updateData.bossBattleChannelId = targetChannel.id;
      } else if (alertType === 'challenge') {
        updateData.challengeChannelId = targetChannel.id;
      }

      await this.prisma.notificationConfig.upsert({
        where: { guildId: guild.id },
        update: updateData,
        create: {
          guildId: guild.id,
          ...updateData,
        },
      });

      const labelMap: Record<string, string> = {
        all: 'All Automated Bot Alerts (Solves, Recaps, Boss Raids, Challenges)',
        activity: 'Problem Solve Alerts only',
        recap: 'Daily & Weekly Recaps only',
        boss: 'Boss Battle Contests only',
        challenge: 'Challenges & Duels only',
      };

      await interaction.editReply({
        content: `✅ **Alert Channel Configured!**\n**${labelMap[alertType] || alertType}** will now be routed directly to <#${targetChannel.id}>.`,
      });
      return;
    }

    if (commandName === 'link') {
      const username = interaction.options.getString('username', true);
      try {
        await interaction.deferReply({ flags: 64 });
      } catch (e: any) {
        this.logger.warn(`Could not defer reply for /link: ${e.message}`);
        return;
      }

      const token = `dg-verify-${crypto.randomBytes(4).toString('hex')}`;
      const user = await this.prisma.user.upsert({
        where: { discordId: interaction.user.id },
        update: { username: interaction.user.username },
        create: {
          discordId: interaction.user.id,
          username: interaction.user.username,
        },
      });

      // Link user to current guild
      if (interaction.guildId && interaction.guild) {
        const guild = await this.prisma.guild.upsert({
          where: { discordGuildId: interaction.guildId },
          update: { name: interaction.guild.name, iconUrl: interaction.guild.iconURL() },
          create: {
            discordGuildId: interaction.guildId,
            name: interaction.guild.name,
            iconUrl: interaction.guild.iconURL(),
          },
        });

        await this.prisma.guildMember.upsert({
          where: { guildId_userId: { guildId: guild.id, userId: user.id } },
          update: {},
          create: {
            guildId: guild.id,
            userId: user.id,
          },
        });
      }

      await this.prisma.leetCodeProfile.upsert({
        where: { userId: user.id },
        update: {
          username,
          verificationToken: token,
          isVerified: false,
        },
        create: {
          userId: user.id,
          username,
          verificationToken: token,
          isVerified: false,
        },
      });

      const embed = DiscordEmbeds.createVerificationPrompt(token);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`verify_lc_${interaction.user.id}_${username}`)
          .setLabel('Confirm & Verify Now')
          .setStyle(ButtonStyle.Success),
      );

    } else if (commandName === 'sync') {
      try {
        await interaction.deferReply({ flags: 64 });
      } catch (deferErr: any) {
        this.logger.warn(`Could not defer reply for /sync: ${deferErr.message}`);
        return;
      }
      const user = await this.prisma.user.findUnique({
        where: { discordId: interaction.user.id },
        include: { leetCodeProfile: true },
      });

      if (!user || !user.leetCodeProfile || !user.leetCodeProfile.isVerified) {
        await interaction.editReply({
          content: '❌ You do not have a verified LeetCode profile linked. Use `/link` first!',
        });
        return;
      }

      try {
        const submissions = await this.leetcode.fetchRecentSubmissions(user.leetCodeProfile.username, 15);
        const accepted = submissions.filter((s) => s.statusDisplay === 'Accepted');
        let newCount = 0;

        for (const sub of accepted) {
          const details = await this.leetcode.fetchQuestionDetails(sub.titleSlug);
          if (!details) continue;

          const diff = details.difficulty.toUpperCase() as ProblemDifficulty;
          const tags = details.topicTags.map((t) => t.name);

          const existing = await this.prisma.activity.findUnique({
            where: {
              userId_leetCodeSubmissionId: {
                userId: user.id,
                leetCodeSubmissionId: sub.id,
              },
            },
          });

          if (!existing) {
            await this.activity.ingestSubmission({
              userId: user.id,
              leetCodeSubmissionId: sub.id,
              problemTitle: sub.title,
              problemSlug: sub.titleSlug,
              difficulty: diff,
              topicTags: tags,
              submissionTimestamp: new Date(Number(sub.timestamp) * 1000),
            });
            newCount++;
          }
        }

        await this.prisma.leetCodeProfile.update({
          where: { id: user.leetCodeProfile.id },
          data: { lastSyncedAt: new Date() },
        });

        if (newCount > 0) {
          await interaction.editReply({
            content: `⚡ **Manual Sync Complete!** Found and processed **${newCount}** new accepted solve(s)! An alert card has been posted to your alerts channel.`,
          });
        } else {
          await interaction.editReply({
            content: `✅ **Sync Complete!** Your profile is fully up to date. (No new solves detected).`,
          });
        }
      } catch (syncErr: any) {
        this.logger.error(`Error during manual sync for ${user.username}: ${syncErr.message}`);
        await interaction.editReply({
          content: `⚠️ Failed to sync LeetCode profile: ${syncErr.message}`,
        });
      }
    } else if (commandName === 'profile') {
      await interaction.deferReply();
      const targetUser = interaction.options.getUser('user') || interaction.user;

      const user = await this.prisma.user.findUnique({
        where: { discordId: targetUser.id },
        include: { leetCodeProfile: true, guildMemberships: true },
      });

      if (!user || !user.leetCodeProfile || !user.leetCodeProfile.isVerified) {
        await interaction.editReply({
          content: `❌ ${targetUser.username} has not linked their verified LeetCode profile yet. Use \`/link\`!`,
        });
        return;
      }

      const guildMember = user.guildMemberships.find((m) => m.guildId === interaction.guildId);
      const rankTier = guildMember?.guildRank || 'BRONZE';

      const embed = DiscordEmbeds.createProfileEmbed(user, user.leetCodeProfile, rankTier as any);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'recap') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'daily' && interaction.guildId) {
        await interaction.deferReply();
        const summary = await this.recap.generateDailyGuildRecap(interaction.guildId);
        await interaction.editReply({
          content: `📊 **Daily Guild Recap**:\nTotal Solves: **${summary.totalSolves}** across **${summary.activeSolversCount}** members!\nXP Earned: **+${summary.totalXpEarned} XP**`,
        });
      } else if (sub === 'wrapped') {
        await interaction.deferReply();
        const user = await this.prisma.user.findUnique({ where: { discordId: interaction.user.id } });
        if (!user) {
          await interaction.editReply({ content: '❌ You do not have an active DevGuild profile.' });
          return;
        }

        const now = new Date();
        const buffer = await this.recap.generateMonthlyWrappedCard(user.id, now.getFullYear(), now.getMonth() + 1);
        await interaction.editReply({
          content: `✨ **Here is your Monthly Wrapped, ${interaction.user.username}!**`,
          files: [{ attachment: buffer, name: `wrapped-${user.username}.png` }],
        });
      }
    } else {
      await interaction.reply({ content: `Command \`/${commandName}\` acknowledged!`, flags: 64 });
    }
  }

  @OnEvent('activity.created')
  async handleActivityBroadcast(event: ActivityCreatedEventPayload) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: event.userId },
        include: { guildMemberships: { include: { guild: { include: { notificationConfig: true } } } } },
      });

      if (!user) return;

      for (const membership of user.guildMemberships) {
        const notifConfig = membership.guild.notificationConfig;
        if (notifConfig && notifConfig.enableActivityAlerts && notifConfig.activityChannelId) {
          try {
            const channel = await this.client.channels.fetch(notifConfig.activityChannelId);
            if (channel && channel.isTextBased()) {
              const embed = DiscordEmbeds.createSolveAlertEmbed(user, event);
              await (channel as any).send({ embeds: [embed] });
              this.logger.log(`Broadcasted solve alert for ${user.username} to channel ${notifConfig.activityChannelId}`);
            }
          } catch (channelErr: any) {
            this.logger.warn(`Could not send activity alert to channel ${notifConfig.activityChannelId}: ${channelErr.message}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Error broadcasting activity alert: ${err.message}`, err.stack);
    }
  }

  private async handleButtonInteraction(interaction: ButtonInteraction) {
    if (interaction.customId.startsWith('verify_lc_')) {
      try {
        await interaction.deferReply({ flags: 64 });
      } catch (err: any) {
        this.logger.warn(`Could not defer reply for button: ${err.message}`);
        return;
      }
      const parts = interaction.customId.split('_');
      const discordId = parts[2];
      const username = parts[3];

      if (interaction.user.id !== discordId) {
        await interaction.editReply({ content: '❌ You cannot verify another user’s account.' });
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { discordId },
        include: { leetCodeProfile: true },
      });

      if (!user || !user.leetCodeProfile || !user.leetCodeProfile.verificationToken) {
        await interaction.editReply({ content: '❌ No pending verification session found.' });
        return;
      }

      const liveProfile = await this.leetcode.fetchUserProfile(username);
      const token = user.leetCodeProfile.verificationToken;

      if (!liveProfile.aboutMe?.includes(token)) {
        await interaction.editReply({
          content: `❌ Verification token \`${token}\` was not detected in your LeetCode "About Me" bio. Please save your bio and retry.`,
        });
        return;
      }

      // Update to verified
      await this.prisma.leetCodeProfile.update({
        where: { id: user.leetCodeProfile.id },
        data: {
          isVerified: true,
          verificationToken: null,
          totalSolved: liveProfile.submitStats.acSubmissionNum.find((s) => s.difficulty === 'All')?.count || 0,
          easySolved: liveProfile.submitStats.acSubmissionNum.find((s) => s.difficulty === 'Easy')?.count || 0,
          mediumSolved: liveProfile.submitStats.acSubmissionNum.find((s) => s.difficulty === 'Medium')?.count || 0,
          hardSolved: liveProfile.submitStats.acSubmissionNum.find((s) => s.difficulty === 'Hard')?.count || 0,
        },
      });

      await interaction.editReply({
        content: `🎉 **Success!** Your LeetCode profile **${username}** is now verified and connected to DevGuild!`,
      });
    }
  }

  async broadcastDailyRecapToAllGuilds() {
    try {
      const configs = await this.prisma.notificationConfig.findMany({
        where: {
          enableDailyRecaps: true,
          recapChannelId: { not: null },
        },
        include: { guild: true },
      });

      for (const conf of configs) {
        if (!conf.recapChannelId) continue;
        try {
          const summary = await this.recap.generateDailyGuildRecap(conf.guildId);
          const channel = await this.client.channels.fetch(conf.recapChannelId);
          if (channel && channel.isTextBased()) {
            const embed = DiscordEmbeds.createDailyRecapEmbed(summary);
            await (channel as any).send({ embeds: [embed] });
            this.logger.log(`Broadcasted daily recap to guild ${conf.guild.name}`);
          }
        } catch (err: any) {
          this.logger.warn(`Could not send daily recap to channel ${conf.recapChannelId}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in broadcastDailyRecapToAllGuilds: ${err.message}`);
    }
  }
}
