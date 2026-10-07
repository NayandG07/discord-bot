import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DiscordInteractionsController } from './discord-interactions.controller';
import { DiscordService } from './discord.service';

describe('DiscordInteractionsController', () => {
  let controller: DiscordInteractionsController;
  let discordService: jest.Mocked<Pick<DiscordService, 'handleHttpSlashCommand' | 'handleHttpComponentInteraction'>>;
  let config: jest.Mocked<Pick<ConfigService, 'get'>>;

  const keyPair = crypto.generateKeyPairSync('ed25519');
  const publicKey = (keyPair.publicKey.export({ format: 'der', type: 'spki' }) as Buffer)
    .subarray(12)
    .toString('hex');
  const timestamp = '1791343950';

  beforeEach(() => {
    discordService = {
      handleHttpSlashCommand: jest.fn().mockResolvedValue(undefined),
      handleHttpComponentInteraction: jest.fn().mockResolvedValue(undefined),
    };
    config = { get: jest.fn().mockReturnValue(publicKey) };
    controller = new DiscordInteractionsController(
      discordService as unknown as DiscordService,
      config as unknown as ConfigService,
    );
  });

  function signedRequest(body: string) {
    const rawBody = Buffer.from(body, 'utf8');
    const signature = crypto.sign(null, Buffer.concat([Buffer.from(timestamp), rawBody]), keyPair.privateKey).toString('hex');
    return {
      req: {
        rawBody,
        headers: {
          'x-signature-ed25519': signature,
          'x-signature-timestamp': timestamp,
        },
        body: JSON.parse(body),
      } as any,
      signature,
    };
  }

  function response() {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res;
  }

  it('responds to a valid PING using the exact raw request bytes', async () => {
    const body = '{\n  "type": 1,\n  "nonce": "keep-this-format"\n}';
    const { req, signature } = signedRequest(body);
    const res = response();

    await controller.handleInteraction(req, res, undefined, undefined);

    expect(res.json).toHaveBeenCalledWith({ type: 1 });
    expect(res.status).not.toHaveBeenCalled();
    expect(config.get).toHaveBeenCalledWith('DISCORD_PUBLIC_KEY');
    expect(signature).toHaveLength(128);
  });

  it('falls back to Express request headers when Nest header decorators are empty', async () => {
    const { req } = signedRequest('{"type":1}');
    const res = response();

    await controller.handleInteraction(req, res, undefined, undefined);

    expect(res.json).toHaveBeenCalledWith({ type: 1 });
  });

  it('rejects requests without signature metadata without throwing', async () => {
    const res = response();
    const req = { rawBody: Buffer.from('{"type":1}'), headers: {}, body: { type: 1 } } as any;

    await controller.handleInteraction(req, res, undefined, undefined);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid request signature' });
  });

  it('rejects malformed signatures without throwing', async () => {
    const res = response();
    const req = {
      rawBody: Buffer.from('{"type":1}'),
      headers: {
        'x-signature-ed25519': 'not-a-signature',
        'x-signature-timestamp': timestamp,
      },
    } as any;

    await controller.handleInteraction(req, res, undefined, undefined);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid request signature' });
  });
});
