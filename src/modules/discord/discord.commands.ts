import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';

export const SLASH_COMMANDS = [
  new SlashCommandBuilder()
    .setName('setup-channel')
    .setDescription('Configure which channel receives automated alerts (Admins only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('The channel where alerts should be sent (e.g. #bot-alerts)')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Which alerts to route (defaults to ALL alerts)')
        .setRequired(false)
        .addChoices(
          { name: '🌟 All Automated Alerts (Solves, Recaps, Boss Raids, Challenges)', value: 'all' },
          { name: 'Problem Solve Alerts only', value: 'activity' },
          { name: 'Daily & Weekly Recaps only', value: 'recap' },
          { name: 'Boss Battle Contests only', value: 'boss' },
          { name: 'Challenges & Duels only', value: 'challenge' },
        ),
    ),

  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your LeetCode account to DevGuild')
    .addStringOption((opt) =>
      opt.setName('username').setDescription('Your official LeetCode username').setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your current LeetCode profile from DevGuild'),

  new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Instantly check your LeetCode profile for new solves and broadcast alerts'),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View DevGuild profile and LeetCode stats')
    .addUserOption((opt) => opt.setName('user').setDescription('Target user to view (defaults to you)')),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View guild competitive leaderboards')
    .addSubcommand((sub) => sub.setName('weekly').setDescription('Weekly XP leaderboard'))
    .addSubcommand((sub) => sub.setName('streak').setDescription('Daily streak leaderboard'))
    .addSubcommand((sub) => sub.setName('consistency').setDescription('Reliability & consistency leaderboard'))
    .addSubcommand((sub) => sub.setName('contests').setDescription('Boss Battle contest raid damage leaderboard')),

  new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('Create or view coding challenges')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new challenge lobby')
        .addStringOption((opt) =>
          opt
            .setName('format')
            .setDescription('Match format')
            .setRequired(true)
            .addChoices(
              { name: '1v1 Match', value: 'ONE_V_ONE' },
              { name: '2v2 Squad Match', value: 'TWO_V_TWO' },
              { name: '3v3 Team Match', value: 'THREE_V_THREE' },
            ),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('duration')
            .setDescription('Duration in hours')
            .addChoices(
              { name: '24 Hours', value: 24 },
              { name: '48 Hours', value: 48 },
              { name: '72 Hours', value: 72 },
              { name: '7 Days', value: 168 },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName('intensity')
            .setDescription('Match intensity')
            .addChoices(
              { name: 'Casual (1.0x XP)', value: 'CASUAL' },
              { name: 'Competitive (1.25x XP)', value: 'COMPETITIVE' },
              { name: 'Hardcore (1.5x XP)', value: 'HARDCORE' },
            ),
        ),
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('Check ongoing challenge status')),

  new SlashCommandBuilder()
    .setName('team')
    .setDescription('Manage permanent squads and teams')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new team')
        .addStringOption((opt) => opt.setName('name').setDescription('Team display name').setRequired(true))
        .addStringOption((opt) => opt.setName('tag').setDescription('3-6 letter team tag (e.g. DEV)').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('stats')
        .setDescription('View team statistics')
        .addStringOption((opt) => opt.setName('tag').setDescription('Team tag').setRequired(true)),
    ),

  new SlashCommandBuilder()
    .setName('boss')
    .setDescription('View current Weekly / Mega Boss Battle raid'),

  new SlashCommandBuilder()
    .setName('recap')
    .setDescription('View daily or weekly recap')
    .addSubcommand((sub) => sub.setName('daily').setDescription('View today’s solve recap'))
    .addSubcommand((sub) => sub.setName('wrapped').setDescription('Generate your Monthly Wrapped card')),
];
