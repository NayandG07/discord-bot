import { ConfigService } from '@nestjs/config';
import { REST } from 'discord.js';
import { DiscordService } from './discord.service';

describe('DiscordService HTTP command responses', () => {
  let service: DiscordService;
  let patch: jest.SpyInstance;
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'DISCORD_BOT_TOKEN') return 'bot-token';
      if (key === 'DISCORD_CLIENT_ID') return 'client-id';
      return undefined;
    }),
  };

  beforeEach(() => {
    patch = jest.spyOn(REST.prototype, 'patch').mockResolvedValue({} as any);
    service = new DiscordService(
      config as unknown as ConfigService,
      {
        user: {
          upsert: jest.fn().mockResolvedValue({ id: 'user-id' }),
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-id',
            username: 'discord-user',
            leetCodeProfile: { id: 'profile-id', username: 'coder', isVerified: true },
          }),
        },
        guild: { upsert: jest.fn().mockResolvedValue({ id: 'guild-id', name: 'Guild' }) },
        guildMember: { upsert: jest.fn().mockResolvedValue({}) },
        leetCodeProfile: { upsert: jest.fn().mockResolvedValue({}) },
        activity: { findUnique: jest.fn().mockResolvedValue(null) },
      } as any,
      { fetchRecentSubmissions: jest.fn(), fetchQuestionDetails: jest.fn() } as any,
      { ingestSubmission: jest.fn() } as any,
      {} as any,
      {} as any,
    );
  });

  afterEach(() => {
    patch.mockRestore();
  });

  it('edits the deferred response for /link with the verification prompt', async () => {
    await service.handleHttpSlashCommand({
      token: 'interaction-token',
      guild_id: 'guild-id',
      member: { user: { id: 'discord-id', username: 'discord-user' } },
      data: { name: 'link', options: [{ name: 'username', value: 'coder' }] },
    });

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch.mock.calls[0][1].body.embeds).toHaveLength(1);
    expect(patch.mock.calls[0][1].body.components).toHaveLength(1);
  });

  it('edits the deferred response when /recap has no valid subcommand', async () => {
    await service.handleHttpSlashCommand({
      token: 'interaction-token',
      guild_id: 'guild-id',
      member: { user: { id: 'discord-id', username: 'discord-user' } },
      data: { name: 'recap', options: [] },
    });

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch.mock.calls[0][1].body.content).toContain('valid recap option');
  });

  it('sends a failure follow-up when /sync exceeds its external-operation timeout', async () => {
    const leetcode = (service as any).leetcode;
    leetcode.fetchRecentSubmissions.mockReturnValue(new Promise(() => undefined));
    (service as any).externalOperationTimeoutMs = 10;
    (service as any).httpCommandTimeoutMs = 100;

    await service.handleHttpSlashCommand({
      token: 'interaction-token',
      guild_id: 'guild-id',
      member: { user: { id: 'discord-id', username: 'discord-user' } },
      data: { name: 'sync', options: [] },
    });

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch.mock.calls[0][1].body.content).toContain('Failed to sync');
  });
});
