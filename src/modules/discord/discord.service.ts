import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { DiscordEmbeds } from './discord-embeds';
import { SLASH_COMMANDS } from './discord.commands';
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
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
      ],
    });
  }

  async onModuleInit() {
    const token = this.config.get<string>('DISCORD_BOT_TOKEN');
    if (!token) {
      this.logger.warn('DISCORD_BOT_TOKEN not provided. Discord Bot Client will not start.');
      return;
    }

    this.registerEventHandlers();
    await this.client.login(token);
    await this.registerSlashCommands();
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
    const token = this.config.get<string>('DISCORD_BOT_TOKEN');
    const clientId = this.config.get<string>('DISCORD_CLIENT_ID');
    if (!token || !clientId) return;

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
      this.logger.log(`DevGuild Discord Bot logged in as ${this.client.user?.tag}!`);
    });

    this.client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          await this.handleSlashCommand(interaction);
        } else if (interaction.isButton()) {
          await this.handleButtonInteraction(interaction);
        }
      } catch (err: any) {
        this.logger.error(`Error handling interaction: ${err.message}`, err.stack);
        if (interaction.isRepliable()) {
          const content = '⚠️ An internal error occurred while executing this command.';
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content, ephemeral: true });
          } else {
            await interaction.reply({ content, ephemeral: true });
          }
        }
      }
    });
  }

  private async handleSlashCommand(interaction: ChatInputCommandInteraction) {
    const { commandName } = interaction;

    if (commandName === 'link') {
      const username = interaction.options.getString('username', true);
      await interaction.deferReply({ ephemeral: true });

      const token = `dg-verify-${crypto.randomBytes(4).toString('hex')}`;
      const user = await this.prisma.user.upsert({
        where: { discordId: interaction.user.id },
        update: { username: interaction.user.username },
        create: {
          discordId: interaction.user.id,
          username: interaction.user.username,
        },
      });

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

      await interaction.editReply({ embeds: [embed], components: [row] });
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
      await interaction.reply({ content: `Command \`/${commandName}\` acknowledged!`, ephemeral: true });
    }
  }

  private async handleButtonInteraction(interaction: ButtonInteraction) {
    if (interaction.customId.startsWith('verify_lc_')) {
      await interaction.deferReply({ ephemeral: true });
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
}
