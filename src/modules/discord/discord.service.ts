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
import { ProblemDifficulty, GoalPeriod } from '@prisma/client';
import { DiscordEmbeds } from './discord-embeds';
import { SLASH_COMMANDS } from './discord.commands';
import { ActivityCreatedEventPayload } from '../activity/activity.types';
import { LeaderboardService } from '../leaderboards/leaderboard.service';
import { GoalService } from '../goals/goal.service';
import * as crypto from 'crypto';

@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordService.name);
  private readonly httpCommandTimeoutMs = 120_000;
  private readonly externalOperationTimeoutMs = 30_000;
  private readonly httpFollowUpTimeoutMs = 10_000;
  private client: Client;
  private devRoleCache = new Map<string, string>();
  private goalCheckInterval?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly leetcode: LeetCodeService,
    private readonly reliability: ReliabilityService,
    private readonly recap: RecapService,
    private readonly activity: ActivityService,
    private readonly leaderboard?: LeaderboardService,
    private readonly goalService?: GoalService,
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

    // Always register slash commands right away independently so commands exist even if Gateway WebSocket is rate-limited
    this.registerSlashCommands().catch((err) => {
      this.logger.error(`Discord slash command registration error: ${err.message}`);
    });

    this.registerEventHandlers();
    this.initDiscord(token).catch((err) => {
      this.logger.error(`Discord initialization error: ${err.message}`, err.stack);
    });

    // Start background accountability runner for goals (periodic reminders and penalty enforcement)
    this.goalCheckInterval = setInterval(async () => {
      try {
        await this.processGoalEvaluations();
        await this.processGoalReminders();
      } catch (err: any) {
        this.logger.error(`Error in goal accountability background runner: ${err.message}`);
      }
    }, 10 * 60 * 1000); // Check every 10 minutes
  }

  private async initDiscord(token: string) {
    try {
      this.logger.log(`TOKEN_DEBUG: length=${token.length}, prefix="${token.substring(0, 12)}", suffix="${token.substring(token.length - 6)}"`);
      this.client.rest.setToken(token);

      this.logger.log(`Connecting DevGuild to Discord Gateway (token prefix: ${token.substring(0, 8)}...)...`);
      await Promise.race([
        this.client.login(token),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Gateway login connection timed out (10s)')), 10000)),
      ]);
      this.logger.log(`Discord Gateway connected successfully! Tag: ${this.client.user?.tag}`);

      await this.registerSlashCommands();
    } catch (err: any) {
      this.logger.warn(`Discord Gateway connection skipped or timed out: ${err.message}. Running in HTTP-interactions mode.`);
    }
  }

  async onModuleDestroy() {
    if (this.goalCheckInterval) {
      clearInterval(this.goalCheckInterval);
    }
    if (this.client) {
      this.logger.log('Destroying Discord client connection...');
      await this.client.destroy();
    }
  }

  getClient(): Client {
    return this.client;
  }

  /**
   * Executes a slash command synchronously and returns the response payload for direct HTTP response.
   * This eliminates any outbound webhook calls to Discord, completely bypassing Cloudflare rate limits on Render.
   */
  async executeHttpSlashCommand(body: any): Promise<any> {
    const guildId = body.guild_id ?? null;
    const userId = body.member?.user?.id ?? body.user?.id ?? '';
    const username = body.member?.user?.username ?? body.user?.username ?? '';
    const rawOptions: any[] = body.data?.options ?? [];

    const options: any[] = [];
    for (const opt of rawOptions) {
      if (opt.type === 1 && Array.isArray(opt.options)) {
        options.push(...opt.options);
      } else {
        options.push(opt);
      }
    }

    let capturedResponse: any = null;
    let isEphemeral = false;

    const toJson = (payload: any, defaultFlags?: number): any => {
      let data: any = {};
      if (typeof payload === 'string') {
        data = { content: payload };
      } else if (payload && typeof payload === 'object') {
        const { files, ...rest } = payload;
        data = { ...rest };
      }
      if (Array.isArray(data.embeds)) {
        data.embeds = data.embeds.map((e: any) => typeof e?.toJSON === 'function' ? e.toJSON() : e);
      }
      if (Array.isArray(data.components)) {
        data.components = data.components.map((c: any) => typeof c?.toJSON === 'function' ? c.toJSON() : c);
      }
      if (defaultFlags && data.flags === undefined) {
        data.flags = defaultFlags;
      }
      return data;
    };

    const mockInteraction: any = {
      commandName: body.data?.name,
      guildId,
      guild: guildId ? { id: guildId, name: body.guild?.name ?? guildId, iconURL: () => null } : null,
      user: { id: userId, username },
      deferred: false,
      replied: false,
      options: {
        getString: (name: string, required = false) => options.find((o) => o.name === name)?.value ?? null,
        getChannel: (name: string) => {
          const opt = options.find((o) => o.name === name);
          if (!opt) return null;
          return { id: opt.value, name: `channel-${opt.value}` };
        },
        getUser: (name: string) => {
          const opt = options.find((o) => o.name === name);
          if (!opt) return null;
          return { id: opt.value, username: body.data?.resolved?.users?.[opt.value]?.username ?? opt.value };
        },
        getInteger: (name: string) => options.find((o) => o.name === name)?.value ?? null,
        getSubcommand: () => rawOptions.find((o) => o.type === 1)?.name ?? null,
      },
      deferReply: async (opts?: any) => {
        if (opts?.flags === 64) isEphemeral = true;
      },
      reply: async (payload: any) => {
        capturedResponse = toJson(payload, isEphemeral ? 64 : undefined);
      },
      editReply: async (payload: any) => {
        capturedResponse = toJson(payload, isEphemeral ? 64 : undefined);
      },
      followUp: async (payload: any) => {
        capturedResponse = toJson(payload, isEphemeral ? 64 : undefined);
      },
      isRepliable: () => true,
      isChatInputCommand: () => true,
      isButton: () => false,
    };

    await this.handleSlashCommand(mockInteraction as ChatInputCommandInteraction);
    return capturedResponse;
  }

  /**
   * Executes a button/component interaction synchronously and returns the response payload.
   */
  async executeHttpComponentInteraction(body: any): Promise<any> {
    const userId = body.member?.user?.id ?? body.user?.id ?? '';
    const username = body.member?.user?.username ?? body.user?.username ?? '';

    let capturedResponse: any = null;

    const toJson = (payload: any, defaultFlags?: number): any => {
      let data: any = {};
      if (typeof payload === 'string') {
        data = { content: payload };
      } else if (payload && typeof payload === 'object') {
        const { files, ...rest } = payload;
        data = { ...rest };
      }
      if (Array.isArray(data.embeds)) {
        data.embeds = data.embeds.map((e: any) => typeof e?.toJSON === 'function' ? e.toJSON() : e);
      }
      if (Array.isArray(data.components)) {
        data.components = data.components.map((c: any) => typeof c?.toJSON === 'function' ? c.toJSON() : c);
      }
      if (defaultFlags && data.flags === undefined) {
        data.flags = defaultFlags;
      }
      return data;
    };

    const mockInteraction: any = {
      customId: body.data?.custom_id,
      user: { id: userId, username },
      deferred: false,
      replied: false,
      deferReply: async () => {},
      deferUpdate: async () => {},
      editReply: async (payload: any) => {
        capturedResponse = toJson(payload, 64);
      },
      reply: async (payload: any) => {
        capturedResponse = toJson(payload, 64);
      },
      isRepliable: () => true,
      isButton: () => true,
      isChatInputCommand: () => false,
    };

    await this.handleButtonInteraction(mockInteraction as ButtonInteraction);
    return capturedResponse;
  }

  /**
   * Builds a lightweight mock interaction object from raw Discord HTTP payload,
   * then dispatches it to the existing slash command handler.
   * This allows all command logic to work identically in both Gateway and HTTP modes.
   */
  async handleHttpSlashCommand(body: any): Promise<void> {
    const token = this.config.get<string>('DISCORD_BOT_TOKEN')?.trim().replace(/^["']|["']$/g, '') ?? '';
    const rawClientId = this.config.get<string>('DISCORD_CLIENT_ID')?.trim().replace(/^["']|["']$/g, '');
    const appId = body.application_id || rawClientId || '1557065263575343145';
    const rest = new REST({ version: '10' }).setToken(token);

    const guildId = body.guild_id ?? null;
    const userId = body.member?.user?.id ?? body.user?.id ?? '';
    const username = body.member?.user?.username ?? body.user?.username ?? '';
    const rawOptions: any[] = body.data?.options ?? [];

    // Flatten options if command has subcommands (e.g. /recap daily)
    const options: any[] = [];
    for (const opt of rawOptions) {
      if (opt.type === 1 && Array.isArray(opt.options)) {
        options.push(...opt.options);
      } else {
        options.push(opt);
      }
    }

    const normalizePayload = (payload: any) => {
      if (typeof payload === 'string') {
        return { body: { content: payload } };
      }
      if (payload && typeof payload === 'object') {
        const { files, ...restBody } = payload;
        const optionsData: any = { body: restBody };
        if (files) optionsData.files = files;
        return optionsData;
      }
      return { body: {} };
    };

    const toJsonBody = (payload: any): object => {
      if (typeof payload === 'string') return { content: payload };
      if (payload && typeof payload === 'object') {
        const { files, ...restBody } = payload;
        const bodyObj: any = { ...restBody };
        if (Array.isArray(bodyObj.embeds)) {
          bodyObj.embeds = bodyObj.embeds.map((e: any) => typeof e?.toJSON === 'function' ? e.toJSON() : e);
        }
        if (Array.isArray(bodyObj.components)) {
          bodyObj.components = bodyObj.components.map((c: any) => typeof c?.toJSON === 'function' ? c.toJSON() : c);
        }
        return bodyObj;
      }
      return {};
    };

    const editReply = async (payload: any) => {
      const cmdName = body.data?.name ?? 'unknown';
      this.logger.log(`Sending HTTP interaction follow-up for /${cmdName}.`);
      const restPayload = normalizePayload(payload);

      try {
        await this.withTimeout(
          rest.patch(Routes.webhookMessage(appId, body.token), { ...restPayload, auth: false }),
          this.httpFollowUpTimeoutMs,
          `Discord /${cmdName} follow-up`,
        );
        this.logger.log(`HTTP interaction follow-up sent via REST for /${cmdName}.`);
      } catch (err: any) {
        this.logger.warn(`rest.patch failed for /${cmdName} (${err.message}). Trying native HTTPS IPv4 fallback...`);
        try {
          await this.sendDirectDiscordWebhook(appId, body.token, '@original', 'PATCH', toJsonBody(payload));
          this.logger.log(`HTTP interaction follow-up sent via native HTTPS fallback for /${cmdName}.`);
        } catch (fallbackErr: any) {
          this.logger.error(`All follow-up channels failed for /${cmdName}: ${fallbackErr.message}`, fallbackErr.stack);
          throw fallbackErr;
        }
      }
    };

    const mockInteraction: any = {
      commandName: body.data?.name,
      guildId,
      guild: guildId ? { id: guildId, name: body.guild?.name ?? guildId, iconURL: () => null } : null,
      user: { id: userId, username },
      deferred: true,
      replied: false,
      options: {
        getString: (name: string, required = false) => options.find((o) => o.name === name)?.value ?? null,
        getChannel: (name: string) => {
          const opt = options.find((o) => o.name === name);
          if (!opt) return null;
          return { id: opt.value, name: `channel-${opt.value}` };
        },
        getUser: (name: string) => {
          const opt = options.find((o) => o.name === name);
          if (!opt) return null;
          return { id: opt.value, username: body.data?.resolved?.users?.[opt.value]?.username ?? opt.value };
        },
        getInteger: (name: string) => options.find((o) => o.name === name)?.value ?? null,
        getSubcommand: () => rawOptions.find((o) => o.type === 1)?.name ?? null,
      },
      deferReply: async () => { /* already deferred via HTTP type=5 */ },
      reply: async (payload: any) => editReply(payload),
      editReply: async (payload: any) => editReply(payload),
      followUp: async (payload: any) => {
        try {
          await rest.post(Routes.webhook(appId, body.token), { ...normalizePayload(payload), auth: false });
        } catch {
          await this.sendDirectDiscordWebhook(appId, body.token, '', 'POST', toJsonBody(payload));
        }
      },
      isRepliable: () => true,
      isChatInputCommand: () => true,
      isButton: () => false,
    };

    try {
      await this.withTimeout(
        this.handleSlashCommand(mockInteraction as ChatInputCommandInteraction),
        this.httpCommandTimeoutMs,
        `HTTP /${body.data?.name ?? 'unknown'} command`,
      );
    } catch (err: any) {
      this.logger.error(`HTTP slash command /${body.data?.name ?? 'unknown'} failed: ${err.message}`, err.stack);
      try {
        await editReply({ content: '⚠️ The command timed out or failed while processing. Please try again.' });
      } catch {
        // The original interaction token may also have expired or been rejected.
      }
    }
  }

  private async withTimeout<T>(operation: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${operationName} exceeded ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Handles button/component interactions arriving via HTTP.
   */
  async handleHttpComponentInteraction(body: any): Promise<void> {
    const token = this.config.get<string>('DISCORD_BOT_TOKEN')?.trim().replace(/^["']|["']$/g, '') ?? '';
    const rawClientId = this.config.get<string>('DISCORD_CLIENT_ID')?.trim().replace(/^["']|["']$/g, '');
    const appId = body.application_id || rawClientId || '1557065263575343145';
    const rest = new REST({ version: '10' }).setToken(token);

    const userId = body.member?.user?.id ?? body.user?.id ?? '';
    const username = body.member?.user?.username ?? body.user?.username ?? '';

    const normalizePayload = (payload: any) => {
      if (typeof payload === 'string') {
        return { body: { content: payload } };
      }
      if (payload && typeof payload === 'object') {
        const { files, ...restBody } = payload;
        const optionsData: any = { body: restBody };
        if (files) optionsData.files = files;
        return optionsData;
      }
      return { body: {} };
    };

    const toJsonBody = (payload: any): object => {
      if (typeof payload === 'string') return { content: payload };
      if (payload && typeof payload === 'object') {
        const { files, ...restBody } = payload;
        const bodyObj: any = { ...restBody };
        if (Array.isArray(bodyObj.embeds)) {
          bodyObj.embeds = bodyObj.embeds.map((e: any) => typeof e?.toJSON === 'function' ? e.toJSON() : e);
        }
        if (Array.isArray(bodyObj.components)) {
          bodyObj.components = bodyObj.components.map((c: any) => typeof c?.toJSON === 'function' ? c.toJSON() : c);
        }
        return bodyObj;
      }
      return {};
    };

    const editReply = async (payload: any) => {
      try {
        await rest.patch(Routes.webhookMessage(appId, body.token), { ...normalizePayload(payload), auth: false });
      } catch (err: any) {
        this.logger.warn(`Component rest.patch failed (${err.message}). Trying native HTTPS fallback...`);
        await this.sendDirectDiscordWebhook(appId, body.token, '@original', 'PATCH', toJsonBody(payload));
      }
    };

    const mockInteraction: any = {
      customId: body.data?.custom_id,
      user: { id: userId, username },
      deferred: true,
      replied: false,
      deferReply: async () => { /* already deferred via HTTP type=5 */ },
      deferUpdate: async () => { /* already deferred */ },
      editReply: async (payload: any) => editReply(payload),
      reply: async (payload: any) => editReply(payload),
      isRepliable: () => true,
      isButton: () => true,
      isChatInputCommand: () => false,
    };

    await this.handleButtonInteraction(mockInteraction as ButtonInteraction);
  }

  /**
   * Native IPv4 HTTPS delivery for Discord interaction webhooks.
   * Completely independent of undici / discord.js connection pool to eliminate hangs on Render.
   */
  private sendDirectDiscordWebhook(
    appId: string,
    interactionToken: string,
    messageId: string,
    method: 'PATCH' | 'POST',
    body: object,
  ): Promise<void> {
    if (!/^\d+$/.test(appId)) {
      this.logger.warn(`Skipping direct webhook delivery: invalid snowflake appId "${appId}"`);
      return Promise.resolve();
    }
    const path = messageId === '@original'
      ? `/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`
      : `/api/v10/webhooks/${appId}/${interactionToken}`;

    const proxyHost = this.config.get<string>('DISCORD_WEBHOOK_PROXY_HOST')?.trim();

    const sendToHost = (hostname: string): Promise<boolean> => {
      return new Promise(async (resolve) => {
        try {
          const https = await import('https');
          const jsonStr = JSON.stringify(body);
          const req = https.request(
            {
              hostname,
              port: 443,
              path,
              method,
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(jsonStr),
                'User-Agent': 'DiscordBot (https://discord.js.org, 14.16.3)',
                'Accept': 'application/json',
              },
              family: 4, // Force IPv4
              timeout: 8000,
            },
            (res: any) => {
              let responseData = '';
              res.on('data', (chunk: any) => (responseData += chunk));
              res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  resolve(true);
                } else {
                  this.logger.warn(`Direct webhook to ${hostname}${path} returned ${res.statusCode}: ${responseData}`);
                  resolve(false);
                }
              });
            },
          );
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
          req.on('error', (err: any) => {
            this.logger.warn(`Direct webhook to ${hostname}${path} error: ${err.message}`);
            resolve(false);
          });
          req.write(jsonStr);
          req.end();
        } catch {
          resolve(false);
        }
      });
    };

    return new Promise(async (resolve, reject) => {
      // 1. Try proxy host if explicitly configured in environment
      if (proxyHost) {
        const proxySuccess = await sendToHost(proxyHost);
        if (proxySuccess) return resolve();
      }

      // 2. Direct discord.com
      const directSuccess = await sendToHost('discord.com');
      if (directSuccess) return resolve();

      reject(new Error(`Failed to deliver interaction webhook${proxyHost ? ` to both ${proxyHost} and discord.com` : ' to discord.com'}`));
    });
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
      const commandBody = SLASH_COMMANDS.map((cmd) => (typeof cmd.toJSON === 'function' ? cmd.toJSON() : cmd));
      this.logger.log('Registering global Discord slash commands...');
      await rest.put(Routes.applicationCommands(clientId), {
        body: commandBody,
      });
      this.logger.log('Successfully registered all global slash commands.');

      // Clear any guild-scoped commands so Discord client does not display duplicate command entries
      const guilds = await this.prisma.guild.findMany();
      for (const g of guilds) {
        try {
          await rest.put(Routes.applicationGuildCommands(clientId, g.discordGuildId), {
            body: [],
          });
        } catch (gErr: any) {
          // ignore
        }
      }
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

      await interaction.editReply({ embeds: [embed], components: [row] });

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
        const submissions = await this.withTimeout(
          this.leetcode.fetchRecentSubmissions(user.leetCodeProfile.username, 15),
          this.externalOperationTimeoutMs,
          'LeetCode submission fetch',
        );
        const accepted = submissions.filter((s) => s.statusDisplay === 'Accepted');
        let newCount = 0;

        for (const sub of accepted) {
          const subTimestamp = new Date(Number(sub.timestamp) * 1000);
          // Never ingest historical problems solved before the user joined/linked with DevGuild
          if (subTimestamp < user.createdAt) {
            continue;
          }

          const existing = await this.prisma.activity.findFirst({
            where: {
              userId: user.id,
              OR: [
                { leetCodeSubmissionId: sub.id },
                { problemSlug: sub.titleSlug },
              ],
            },
          });
          if (existing) continue;

          const details = await this.withTimeout(
            this.leetcode.fetchQuestionDetails(sub.titleSlug),
            this.externalOperationTimeoutMs,
            `LeetCode question fetch for ${sub.titleSlug}`,
          );
          if (!details) continue;

          const diff = details.difficulty.toUpperCase() as ProblemDifficulty;
          const tags = details.topicTags.map((t) => t.name);

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

        // Refresh full LeetCode stats & contest metrics
        try {
          const [liveProfile, contestRanking] = await Promise.all([
            this.leetcode.fetchUserProfile(user.leetCodeProfile.username).catch(() => null),
            this.leetcode.fetchContestRanking(user.leetCodeProfile.username).catch(() => null),
          ]);

          if (liveProfile) {
            const allCount = liveProfile.submitStats.acSubmissionNum.find((s) => s.difficulty === 'All')?.count || 0;
            const easyCount = liveProfile.submitStats.acSubmissionNum.find((s) => s.difficulty === 'Easy')?.count || 0;
            const medCount = liveProfile.submitStats.acSubmissionNum.find((s) => s.difficulty === 'Medium')?.count || 0;
            const hardCount = liveProfile.submitStats.acSubmissionNum.find((s) => s.difficulty === 'Hard')?.count || 0;

            await this.prisma.leetCodeProfile.update({
              where: { id: user.leetCodeProfile.id },
              data: {
                totalSolved: allCount,
                easySolved: easyCount,
                mediumSolved: medCount,
                hardSolved: hardCount,
                ranking: liveProfile.ranking,
                avatar: liveProfile.userAvatar || undefined,
                contestRating: contestRanking?.rating ? Math.round(contestRanking.rating) : undefined,
                contestGlobalRank: contestRanking?.globalRanking || undefined,
                lastSyncedAt: new Date(),
              },
            });

            if (liveProfile.streak) {
              await this.prisma.user.update({
                where: { id: user.id },
                data: { longestStreak: Math.max(user.longestStreak, liveProfile.streak) },
              });
            }
          } else {
            await this.prisma.leetCodeProfile.update({
              where: { id: user.leetCodeProfile.id },
              data: { lastSyncedAt: new Date() },
            });
          }
        } catch {
          await this.prisma.leetCodeProfile.update({
            where: { id: user.leetCodeProfile.id },
            data: { lastSyncedAt: new Date() },
          });
        }

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

      let user = await this.prisma.user.findUnique({
        where: { discordId: targetUser.id },
        include: {
          leetCodeProfile: true,
          guildMemberships: { include: { guild: true } },
          _count: { select: { activities: true } },
        },
      });

      if (!user || !user.leetCodeProfile || !user.leetCodeProfile.isVerified) {
        await interaction.editReply({
          content: `❌ ${targetUser.username} has not linked their verified LeetCode profile yet. Use \`/link\`!`,
        });
        return;
      }

      // If contest metrics or solve count is missing / stale, refresh on the fly
      if (
        user.leetCodeProfile.contestRating === null ||
        !user.leetCodeProfile.lastSyncedAt ||
        Date.now() - user.leetCodeProfile.lastSyncedAt.getTime() > 5 * 60 * 1000
      ) {
        try {
          const [liveProfile, contestRanking] = await Promise.all([
            this.leetcode.fetchUserProfile(user.leetCodeProfile.username).catch(() => null),
            this.leetcode.fetchContestRanking(user.leetCodeProfile.username).catch(() => null),
          ]);

          if (liveProfile) {
            const allCount = liveProfile.submitStats.acSubmissionNum.find((s) => s.difficulty === 'All')?.count || 0;
            const easyCount = liveProfile.submitStats.acSubmissionNum.find((s) => s.difficulty === 'Easy')?.count || 0;
            const medCount = liveProfile.submitStats.acSubmissionNum.find((s) => s.difficulty === 'Medium')?.count || 0;
            const hardCount = liveProfile.submitStats.acSubmissionNum.find((s) => s.difficulty === 'Hard')?.count || 0;

            const updatedProfile = await this.prisma.leetCodeProfile.update({
              where: { id: user.leetCodeProfile.id },
              data: {
                totalSolved: allCount,
                easySolved: easyCount,
                mediumSolved: medCount,
                hardSolved: hardCount,
                ranking: liveProfile.ranking,
                avatar: liveProfile.userAvatar || undefined,
                contestRating: contestRanking?.rating ? Math.round(contestRanking.rating) : undefined,
                contestGlobalRank: contestRanking?.globalRanking || undefined,
                lastSyncedAt: new Date(),
              },
            });
            user.leetCodeProfile = updatedProfile;

            if (liveProfile.streak) {
              const updatedUser = await this.prisma.user.update({
                where: { id: user.id },
                data: { longestStreak: Math.max(user.longestStreak, liveProfile.streak) },
              });
              user.longestStreak = updatedUser.longestStreak;
            }
          }
        } catch {
          // fallback to cached DB data
        }
      }

      const guildMember =
        user.guildMemberships.find(
          (m) => m.guild?.discordGuildId === interaction.guildId || m.guildId === interaction.guildId,
        ) || user.guildMemberships[0];
      const rankTier = guildMember?.guildRank || 'BRONZE';
      const guildXp = guildMember?.guildXp ? Number(guildMember.guildXp) : 0;
      const botSolves = user._count?.activities || 0;

      const embed = DiscordEmbeds.createProfileEmbed(user, user.leetCodeProfile, rankTier as any, guildXp, botSolves);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'recap') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'daily' && interaction.guildId) {
        await interaction.deferReply();
        const summary = await this.withTimeout(
          this.recap.generateDailyGuildRecap(interaction.guildId),
          this.externalOperationTimeoutMs,
          'Daily recap generation',
        );
        const embed = DiscordEmbeds.createDailyRecapEmbed(summary);
        const { mention, roleId } = await this.getDevRoleMention(interaction.guildId);
        await interaction.editReply({
          content: `📢 **Daily Guild Digest!** ${mention}`,
          embeds: [embed],
          allowed_mentions: roleId ? { roles: [roleId] } : { parse: ['roles'] },
        } as any);
      } else if (sub === 'weekly' && interaction.guildId) {
        await interaction.deferReply();
        const summary = await this.withTimeout(
          this.recap.generateWeeklyGuildRecap(interaction.guildId),
          this.externalOperationTimeoutMs,
          'Weekly recap generation',
        );
        const embed = DiscordEmbeds.createWeeklyRecapEmbed(summary);
        const { mention, roleId } = await this.getDevRoleMention(interaction.guildId);
        await interaction.editReply({
          content: `📢 **Weekly Guild Digest!** ${mention}`,
          embeds: [embed],
          allowed_mentions: roleId ? { roles: [roleId] } : { parse: ['roles'] },
        } as any);
      } else if (sub === 'wrapped') {
        await interaction.deferReply();
        const user = await this.prisma.user.findUnique({ where: { discordId: interaction.user.id } });
        if (!user) {
          await interaction.editReply({ content: '❌ You do not have an active DevGuild profile.' });
          return;
        }

        const now = new Date();
        const buffer = await this.withTimeout(
          this.recap.generateMonthlyWrappedCard(user.id, now.getFullYear(), now.getMonth() + 1),
          this.externalOperationTimeoutMs,
          'Monthly wrapped recap generation',
        );
        await interaction.editReply({
          content: `✨ **Here is your Monthly Wrapped, ${interaction.user.username}!**`,
          files: [{ attachment: buffer, name: `wrapped-${user.username}.png` }],
        });
      } else {
        await interaction.editReply({
          content: '❌ Please choose a valid recap option: `daily` or `wrapped`.',
        });
      }
    } else if (commandName === 'leaderboard') {
      if (!interaction.guildId) {
        await interaction.reply({ content: '❌ This command can only be used inside a server.', flags: 64 });
        return;
      }
      await interaction.deferReply();

      const guild = await this.prisma.guild.findUnique({
        where: { discordGuildId: interaction.guildId },
      });

      if (!guild) {
        await interaction.editReply({ content: '❌ Guild profile not found. Please run `/setup-channel` first!' });
        return;
      }

      if (!this.leaderboard) {
        await interaction.editReply({ content: '⚠️ Leaderboard service is currently unavailable.' });
        return;
      }

      const sub = interaction.options.getSubcommand() || 'all';
      let title = 'Cumulative Guild XP & Stats';
      let entries: any[] = [];

      if (sub === 'all') {
        title = 'Cumulative Guild XP & All-Time Stats';
        entries = await this.leaderboard.getCumulativeLeaderboard(guild.id, 10);
      } else if (sub === 'weekly') {
        title = 'Weekly XP';
        entries = await this.leaderboard.getWeeklyLeaderboard(guild.id, 10);
      } else if (sub === 'streak') {
        title = 'Daily Streaks';
        entries = await this.leaderboard.getStreakLeaderboard(guild.id, 10);
      } else if (sub === 'consistency') {
        title = 'Consistency & Reliability';
        entries = await this.leaderboard.getConsistencyLeaderboard(guild.id, 10);
      } else if (sub === 'contests') {
        title = 'Contest Raid Damage';
        entries = await this.leaderboard.getContestLeaderboard(guild.id, 10);
      }

      const embed = DiscordEmbeds.createLeaderboardEmbed(title, entries);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'boss') {
      if (!interaction.guildId) {
        await interaction.reply({ content: '❌ This command can only be used inside a server.', flags: 64 });
        return;
      }
      await interaction.deferReply();

      const guild = await this.prisma.guild.findUnique({
        where: { discordGuildId: interaction.guildId },
      });

      if (!guild) {
        await interaction.editReply({ content: '❌ Guild profile not found. Please run `/setup-channel` first!' });
        return;
      }

      const activeBoss = await this.prisma.bossBattle.findFirst({
        where: { guildId: guild.id, isDefeated: false },
        include: { contest: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!activeBoss) {
        const embed = DiscordEmbeds.createUpcomingContestsEmbed();
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const embed = DiscordEmbeds.createBossBattleEmbed(activeBoss);
      await interaction.editReply({ embeds: [embed] });
    } else if (commandName === 'unlink') {
      await interaction.deferReply({ flags: 64 });
      const user = await this.prisma.user.findUnique({
        where: { discordId: interaction.user.id },
        include: { leetCodeProfile: true },
      });

      if (!user || !user.leetCodeProfile) {
        await interaction.editReply({ content: '❌ You do not have a linked LeetCode profile.' });
        return;
      }

      await this.prisma.leetCodeProfile.delete({
        where: { id: user.leetCodeProfile.id },
      });

      await interaction.editReply({ content: '✅ Your LeetCode profile has been successfully unlinked.' });
    } else if (commandName === 'challenge') {
      if (!interaction.guildId) {
        await interaction.reply({ content: '❌ This command can only be used inside a server.', flags: 64 });
        return;
      }
      await interaction.deferReply();

      const guild = await this.prisma.guild.findUnique({
        where: { discordGuildId: interaction.guildId },
      });
      if (!guild) {
        await interaction.editReply({ content: '❌ Guild profile not found. Run `/setup-channel` first!' });
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { discordId: interaction.user.id },
      });
      if (!user) {
        await interaction.editReply({ content: '❌ You need to link your account first using `/link`.' });
        return;
      }

      const sub = interaction.options.getSubcommand();
      if (sub === 'create') {
        const format = (interaction.options.getString('format') || 'ONE_V_ONE') as any;
        const durationHours = interaction.options.getInteger('duration') || 24;
        const intensity = (interaction.options.getString('intensity') || 'CASUAL') as any;

        const challenge = await this.prisma.challenge.create({
          data: {
            guildId: guild.id,
            creatorId: user.id,
            format,
            durationHours,
            intensity,
            status: 'CREATED',
          },
        });

        await this.prisma.challengeParticipant.create({
          data: {
            challengeId: challenge.id,
            userId: user.id,
            teamNumber: 1,
            status: 'ACCEPTED',
          },
        });

        const embed = DiscordEmbeds.createChallengeLobbyEmbed(challenge, user);
        await interaction.editReply({ embeds: [embed] });
      } else if (sub === 'status') {
        const activeChallenge = await this.prisma.challenge.findFirst({
          where: { guildId: guild.id, status: { in: ['CREATED', 'ACTIVE'] } },
          include: { creator: true, participants: { include: { user: true } } },
          orderBy: { createdAt: 'desc' },
        });

        if (!activeChallenge) {
          await interaction.editReply({ content: 'ℹ️ No active challenges right now. Create one using `/challenge create`!' });
          return;
        }

        const embed = DiscordEmbeds.createChallengeLobbyEmbed(activeChallenge, activeChallenge.creator);
        await interaction.editReply({ embeds: [embed] });
      }
    } else if (commandName === 'team') {
      if (!interaction.guildId) {
        await interaction.reply({ content: '❌ This command can only be used inside a server.', flags: 64 });
        return;
      }
      await interaction.deferReply();

      const guild = await this.prisma.guild.findUnique({
        where: { discordGuildId: interaction.guildId },
      });
      if (!guild) {
        await interaction.editReply({ content: '❌ Guild profile not found. Run `/setup-channel` first!' });
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { discordId: interaction.user.id },
      });
      if (!user) {
        await interaction.editReply({ content: '❌ You need to link your account first using `/link`.' });
        return;
      }

      const sub = interaction.options.getSubcommand();
      if (sub === 'create') {
        const name = interaction.options.getString('name', true);
        const tag = interaction.options.getString('tag', true).toUpperCase();

        const existing = await this.prisma.team.findFirst({
          where: { guildId: guild.id, OR: [{ name }, { tag }] },
        });

        if (existing) {
          await interaction.editReply({ content: `❌ A squad with name "${name}" or tag "[${tag}]" already exists.` });
          return;
        }

        const team = await this.prisma.team.create({
          data: {
            guildId: guild.id,
            leaderId: user.id,
            name,
            tag,
          },
        });

        await this.prisma.teamMember.create({
          data: {
            teamId: team.id,
            userId: user.id,
            role: 'LEADER',
          },
        });

        await interaction.editReply({
          content: `🛡️ **Squad Created!** **[${team.tag}] ${team.name}** is now active with **${user.username}** as Leader.`,
        });
      } else if (sub === 'stats') {
        const tag = interaction.options.getString('tag', true).toUpperCase();
        const team = await this.prisma.team.findFirst({
          where: { guildId: guild.id, tag },
          include: { members: { include: { user: true } }, leader: true },
        });

        if (!team) {
          await interaction.editReply({ content: `❌ Squad with tag "[${tag}]" not found.` });
          return;
        }

        const memberList = team.members.map((m) => `• **${m.user.username}** (${m.role})`).join('\n');
        await interaction.editReply({
          content: `🛡️ **Squad Info: [${team.tag}] ${team.name}**\nLeader: **${team.leader.username}**\nTotal Members: **${team.members.length}**\n\n**Roster:**\n${memberList}`,
        });
      }
    } else if (commandName === 'guide') {
      const embed = DiscordEmbeds.createGuideEmbed();
      await interaction.reply({ embeds: [embed] });
    } else if (commandName === 'goal') {
      if (!this.goalService) {
        await interaction.reply({ content: '⚠️ Goal service is currently unavailable.', flags: 64 });
        return;
      }
      const sub = interaction.options.getSubcommand();
      if (sub === 'day' || sub === 'week') {
        const num = interaction.options.getInteger('num', true);
        await interaction.deferReply();
        const goal = await this.withTimeout(
          this.goalService.setGoal({
            discordUserId: interaction.user.id,
            discordGuildId: interaction.guildId ?? undefined,
            period: sub === 'day' ? GoalPeriod.DAY : GoalPeriod.WEEK,
            targetCount: num,
          }),
          this.externalOperationTimeoutMs,
          'Setting goal',
        );
        const embed = DiscordEmbeds.createGoalSetEmbed(goal);
        await interaction.editReply({ embeds: [embed] });
      } else if (sub === 'status') {
        await interaction.deferReply();
        const goals = await this.withTimeout(
          this.goalService.getUserActiveGoals(interaction.user.id),
          this.externalOperationTimeoutMs,
          'Fetching goals',
        );
        const embed = DiscordEmbeds.createGoalStatusEmbed(goals, interaction.user.username);
        await interaction.editReply({ embeds: [embed] });
      } else if (sub === 'cancel') {
        const periodChoice = interaction.options.getString('period', true);
        await interaction.deferReply({ flags: 64 });
        const period = periodChoice === 'day' ? GoalPeriod.DAY : GoalPeriod.WEEK;
        const count = await this.withTimeout(
          this.goalService.cancelGoal(interaction.user.id, period),
          this.externalOperationTimeoutMs,
          'Cancelling goal',
        );
        if (count > 0) {
          await interaction.editReply({
            content: `✅ Cancelled your active ${periodChoice} goal. Set a new one anytime with \`/goal\`.`,
          });
        } else {
          await interaction.editReply({
            content: `ℹ️ You do not have an active ${periodChoice} goal to cancel.`,
          });
        }
      } else {
        await interaction.reply({ content: '❌ Unknown goal subcommand.', flags: 64 });
      }
    } else {
      await interaction.reply({ content: `Command \`/${commandName}\` acknowledged!`, flags: 64 });
    }
  }

  @OnEvent('activity.created')
  async handleActivityBroadcast(event: ActivityCreatedEventPayload) {
    try {
      // 1. Guard against historical submissions: only broadcast solve alerts for problems solved within the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (event.submissionTimestamp && new Date(event.submissionTimestamp).getTime() < oneDayAgo.getTime()) {
        this.logger.log(
          `Skipping live activity broadcast for historical submission '${event.problemTitle}' (${new Date(event.submissionTimestamp).toISOString()}).`,
        );
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: event.userId },
        include: { guildMemberships: { include: { guild: { include: { notificationConfig: true } } } } },
      });

      if (!user) return;

      // Check active goal progress for this user
      let goalProgressSummary: { current: number; target: number; period: string } | undefined;
      if (this.goalService) {
        try {
          const activeGoals = await this.goalService.getUserActiveGoals(user.discordId);
          if (activeGoals.length > 0) {
            const primaryGoal = activeGoals[0];
            goalProgressSummary = {
              current: primaryGoal.currentCount,
              target: primaryGoal.targetCount,
              period: primaryGoal.period === 'DAY' ? 'Daily' : 'Weekly',
            };
          }
        } catch (gErr: any) {
          this.logger.warn(`Could not fetch goal progress for alert: ${gErr.message}`);
        }
      }

      for (const membership of user.guildMemberships) {
        const notifConfig = membership.guild.notificationConfig;
        if (notifConfig && notifConfig.enableActivityAlerts && notifConfig.activityChannelId) {
          try {
            const embed = DiscordEmbeds.createSolveAlertEmbed(user, event, event.xpAwarded, goalProgressSummary);
            const { mention, roleId } = await this.getDevRoleMention(membership.guild.discordGuildId);

            const delivered = await this.sendMessageToChannel(notifConfig.activityChannelId, {
              content: `🔔 **Problem Solved Alert!** ${mention}`,
              embeds: [embed],
              allowed_mentions: roleId ? { roles: [roleId] } : { parse: ['roles'] },
            });

            if (delivered) {
              this.logger.log(`Broadcasted solve alert for ${user.username} to channel ${notifConfig.activityChannelId}`);
            } else {
              this.logger.warn(`Failed to broadcast solve alert for ${user.username} to channel ${notifConfig.activityChannelId}: all delivery strategies failed.`);
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

  /**
   * Resolves the DEV role mention and role ID for a guild, with in-memory caching and fallbacks.
   */
  async getDevRoleMention(guildDiscordId?: string): Promise<{ mention: string; roleId?: string }> {
    const configuredRoleId = this.config.get<string>('DISCORD_DEV_ROLE_ID')?.trim();
    if (configuredRoleId) {
      return { mention: `<@&${configuredRoleId}>`, roleId: configuredRoleId };
    }

    if (guildDiscordId && this.devRoleCache.has(guildDiscordId)) {
      const cached = this.devRoleCache.get(guildDiscordId)!;
      return { mention: `<@&${cached}>`, roleId: cached };
    }

    try {
      if (guildDiscordId && this.client.isReady()) {
        const guildObj = await this.client.guilds.fetch(guildDiscordId).catch(() => null);
        if (guildObj) {
          const roles = await guildObj.roles.fetch().catch(() => null);
          const devRole = roles?.find((r) => r.name.toLowerCase() === 'dev');
          if (devRole) {
            this.devRoleCache.set(guildDiscordId, devRole.id);
            return { mention: `<@&${devRole.id}>`, roleId: devRole.id };
          }
        }
      }
    } catch {
      // ignore
    }

    // Default known DEV role ID in the OnlyPlans guild
    const knownDefault = '1557402103968829440';
    return { mention: `<@&${knownDefault}>`, roleId: knownDefault };
  }

  /**
   * Returns a configured webhook URL for an alert channel.
   * Checks DISCORD_ALERT_WEBHOOK_URL environment variable first,
   * then falls back to the database NotificationConfig for resilient delivery on Render.
   * Enables complete bypass of Cloudflare Error 1015 IP rate limits on Render.
   */
  async getWebhookUrlForChannel(channelId: string): Promise<string | null> {
    const envWebhook = this.config.get<string>('DISCORD_ALERT_WEBHOOK_URL')?.trim();
    if (envWebhook) return envWebhook;

    try {
      const config = await this.prisma.notificationConfig.findFirst({
        where: {
          OR: [
            { activityChannelId: channelId },
            { recapChannelId: channelId },
            { bossBattleChannelId: channelId },
            { challengeChannelId: channelId },
            { webhookUrl: { not: null } },
          ],
        },
      });
      if (config?.webhookUrl) {
        return config.webhookUrl.trim();
      }
    } catch (err: any) {
      this.logger.warn(`Failed to retrieve webhookUrl from database: ${err.message}`);
    }

    return null;
  }

  /**
   * Delivers a webhook message to Discord, routing through a proxy host if direct Cloudflare egress is rate limited.
   */
  async sendWebhookMessage(
    webhookUrl: string,
    payload: { content?: string; embeds?: any[]; allowed_mentions?: any },
  ): Promise<boolean> {
    const jsonBody: any = {
      content: payload.content,
      embeds: payload.embeds?.map((e: any) => typeof e?.toJSON === 'function' ? e.toJSON() : e),
    };
    if (payload.allowed_mentions) {
      jsonBody.allowed_mentions = payload.allowed_mentions;
    }
    const jsonStr = JSON.stringify(jsonBody);

    let parsedPath = '/api/webhooks/';
    try {
      const u = new URL(webhookUrl);
      parsedPath = u.pathname;
    } catch {
      parsedPath = webhookUrl;
    }

    const proxyHost = this.config.get<string>('DISCORD_WEBHOOK_PROXY_HOST')?.trim() || 'webhook.lewisakura.moe';

    if (proxyHost) {
      const proxySuccess = await this.executeHttpsPost(proxyHost, parsedPath, jsonStr);
      if (proxySuccess) {
        this.logger.log(`Webhook message delivered via proxy (${proxyHost}).`);
        return true;
      }
      this.logger.warn(`Proxy delivery failed. Falling back to direct discord.com...`);
    }

    return await this.executeHttpsPost('discord.com', parsedPath, jsonStr);
  }

  private executeHttpsPost(
    hostname: string,
    path: string,
    jsonStr: string,
    authHeader?: string,
    retries = 2,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      import('https').then((https) => {
        const headers: Record<string, string | number> = {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(jsonStr),
          'User-Agent': 'DevGuildBot/1.0 (+https://devguild.onrender.com)',
          'Accept': 'application/json',
        };
        if (authHeader) {
          headers['Authorization'] = authHeader;
        }

        const req = https.request(
          {
            hostname,
            port: 443,
            path,
            method: 'POST',
            headers,
            family: 4,
            timeout: 10000,
          },
          (res: any) => {
            let data = '';
            res.on('data', (chunk: any) => (data += chunk));
            res.on('end', async () => {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve(true);
              } else if ((res.statusCode === 403 || res.statusCode === 429) && retries > 0) {
                this.logger.warn(`HTTPS POST to ${hostname}${path} returned ${res.statusCode}. Retrying in 2.5s (remaining retries: ${retries - 1})...`);
                await new Promise((r) => setTimeout(r, 2500));
                const retryResult = await this.executeHttpsPost(hostname, path, jsonStr, authHeader, retries - 1);
                resolve(retryResult);
              } else {
                this.logger.warn(`HTTPS POST to ${hostname}${path} returned ${res.statusCode}: ${data}`);
                resolve(false);
              }
            });
          },
        );

        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        req.on('error', (err: any) => {
          this.logger.warn(`HTTPS POST to ${hostname}${path} failed: ${err.message}`);
          resolve(false);
        });

        req.write(jsonStr);
        req.end();
      }).catch((err) => {
        this.logger.error(`Failed to load https module: ${err.message}`);
        resolve(false);
      });
    });
  }

  /**
   * Processes active goals that are due for a reminder.
   * Dispatches automated alerts to the guild's activity channel, tagging the user ONLY!
   */
  async processGoalReminders(): Promise<void> {
    if (!this.goalService) return;
    try {
      const candidates = await this.goalService.getGoalsDueForReminder();
      for (const candidate of candidates) {
        if (!candidate.activityChannelId) continue;
        try {
          const embed = DiscordEmbeds.createGoalReminderEmbed(candidate);
          // Tag the user ONLY in the automated alerts channel
          await this.sendMessageToChannel(candidate.activityChannelId, {
            content: `⏰ <@${candidate.discordId}> **Accountability Reminder!**`,
            embeds: [embed],
            allowed_mentions: { users: [candidate.discordId] },
          });
          await this.goalService.recordReminderSent(candidate.goalId);
          this.logger.log(`Broadcasted automated goal reminder to <@${candidate.discordId}> in channel ${candidate.activityChannelId}`);
        } catch (candErr: any) {
          this.logger.warn(`Could not send goal reminder to channel ${candidate.activityChannelId}: ${candErr.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in processGoalReminders: ${err.message}`);
    }
  }

  /**
   * Evaluates expired goals, applies penalties if targets were missed,
   * and dispatches penalty notices to the guild's activity channel, tagging the user ONLY!
   */
  async processGoalEvaluations(): Promise<void> {
    if (!this.goalService) return;
    try {
      const evalResult = await this.goalService.evaluateExpiredGoals();
      for (const penalty of evalResult.penalties) {
        if (!penalty.activityChannelId) continue;
        try {
          const embed = DiscordEmbeds.createGoalPenaltyEmbed(penalty);
          // Tag the user ONLY in the automated alerts channel
          await this.sendMessageToChannel(penalty.activityChannelId, {
            content: `⚠️ <@${penalty.discordId}> **Accountability Enforcement: Target Missed!**`,
            embeds: [embed],
            allowed_mentions: { users: [penalty.discordId] },
          });
          this.logger.log(`Broadcasted automated goal penalty notice for <@${penalty.discordId}> in channel ${penalty.activityChannelId}`);
        } catch (penErr: any) {
          this.logger.warn(`Could not send goal penalty alert to channel ${penalty.activityChannelId}: ${penErr.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in processGoalEvaluations: ${err.message}`);
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
          const embed = DiscordEmbeds.createDailyRecapEmbed(summary);
          const { mention, roleId } = await this.getDevRoleMention(conf.guild.discordGuildId);

          await this.sendMessageToChannel(conf.recapChannelId, {
            content: `📢 **Daily Guild Digest!** ${mention}`,
            embeds: [embed],
            allowed_mentions: roleId ? { roles: [roleId] } : { parse: ['roles'] },
          });
          this.logger.log(`Broadcasted daily recap to guild ${conf.guild.name}`);
        } catch (err: any) {
          this.logger.warn(`Could not send daily recap to channel ${conf.recapChannelId}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in broadcastDailyRecapToAllGuilds: ${err.message}`);
    }
  }

  /**
   * Resilient channel message delivery:
   * 1. If client is connected to Gateway, delivers through discord.js channel client.
   * 2. If client/Gateway is unavailable (e.g. Cloudflare 1015 on Render), uses Webhook delivery (proxied via lewisakura to bypass Cloudflare IP bans).
   * 3. Falls back to direct native HTTPS POST to Discord API.
   */
  private channelMessageQueue: Promise<any> = Promise.resolve();

  /**
   * Sends a message to a Discord channel using a multi-tier fallback:
   * 1. Discord Webhook via lewisakura proxy (FIRST - bypasses Cloudflare 1015 on Render shared IPs)
   * 2. discord.js Gateway client (if connected)
   * 3. Falls back to direct native HTTPS POST to Discord API.
   *
   * Queued sequentially with 1.2s spacing to prevent Cloudflare Turnstile bot challenge triggers.
   */
  async sendMessageToChannel(
    channelId: string,
    payload: { content?: string; embeds?: any[]; allowed_mentions?: any },
  ): Promise<boolean> {
    const queuePromise = this.channelMessageQueue.then(async () => {
      await new Promise((r) => setTimeout(r, 1200));
      return this.dispatchMessageToChannel(channelId, payload);
    });
    this.channelMessageQueue = queuePromise.catch(() => false);
    return queuePromise;
  }

  private async dispatchMessageToChannel(
    channelId: string,
    payload: { content?: string; embeds?: any[]; allowed_mentions?: any },
  ): Promise<boolean> {
    // 1. FIRST try webhook proxy (webhook.lewisakura.moe bypasses Cloudflare 1015 on Render IPs).
    //    This is intentionally tried BEFORE the Gateway client because client.channels.send()
    //    internally makes discord.com REST calls that ALSO get blocked by Cloudflare 1015
    //    from Render's shared IP ranges, causing it to silently succeed but never actually deliver.
    const webhookUrl = await this.getWebhookUrlForChannel(channelId);
    if (webhookUrl) {
      const webhookSuccess = await this.sendWebhookMessage(webhookUrl, payload);
      if (webhookSuccess) {
        this.logger.log(`Message delivered to channel ${channelId} via webhook proxy.`);
        return true;
      }
      this.logger.warn(`Webhook proxy delivery failed for channel ${channelId}.`);
    }

    // 2. Try discord.js Gateway client (WebSocket-based, may work even if REST is blocked)
    if (this.client?.isReady?.()) {
      try {
        const channel = await this.client.channels.fetch(channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          await (channel as any).send(payload);
          this.logger.log(`Message delivered to channel ${channelId} via Gateway client.`);
          return true;
        }
      } catch (err: any) {
        this.logger.warn(`client.channels.send failed for ${channelId}: ${err.message}.`);
      }
    }

    // 3. Last resort: direct discord.com REST API
    const token = this.config.get<string>('DISCORD_BOT_TOKEN')?.trim().replace(/^["']|["']$/g, '') ?? '';
    const jsonBody = {
      content: payload.content,
      embeds: payload.embeds?.map((e: any) => typeof e?.toJSON === 'function' ? e.toJSON() : e),
      allowed_mentions: payload.allowed_mentions,
    };
    const jsonStr = JSON.stringify(jsonBody);

    const restSuccess = await this.executeHttpsPost('discord.com', `/api/v10/channels/${channelId}/messages`, jsonStr, `Bot ${token}`);
    if (!restSuccess) {
      this.logger.error(`All delivery strategies exhausted for channel ${channelId}. Message was NOT sent.`);
    }
    return restSuccess;
  }
}
