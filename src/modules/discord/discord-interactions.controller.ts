import {
  Controller,
  Post,
  Headers,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { DiscordService } from './discord.service';

@Controller('discord')
export class DiscordInteractionsController {
  private readonly logger = new Logger(DiscordInteractionsController.name);

  constructor(
    private readonly discordService: DiscordService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Discord Interactions Endpoint (HTTP mode — no Gateway WebSocket needed).
   * Discord verifies this with a PING (type=1) before allowing the URL to be saved.
   * Slash commands (type=2) and buttons (type=3) are routed to DiscordService.
   */
  @Post('interactions')
  @HttpCode(HttpStatus.OK)
  async handleInteraction(
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
    @Headers('x-signature-ed25519') signature: string,
    @Headers('x-signature-timestamp') timestamp: string,
  ) {
    const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));
    const publicKey = this.config.get<string>('DISCORD_PUBLIC_KEY') ?? '';

    // Step 1: Verify Ed25519 signature from Discord
    if (!this.verifySignature(rawBody, signature, timestamp, publicKey)) {
      this.logger.warn('Rejected interaction request with invalid signature.');
      return res.status(401).json({ error: 'Invalid request signature' });
    }

    const body = JSON.parse(rawBody.toString('utf-8'));
    this.logger.log(`Incoming Discord interaction type=${body.type} command=${body.data?.name ?? 'n/a'}`);

    // Step 2: PING — Discord verifies the endpoint is live
    if (body.type === 1) {
      this.logger.log('Responding to Discord PING verification.');
      return res.json({ type: 1 });
    }

    // Step 3: APPLICATION_COMMAND (slash command)
    if (body.type === 2) {
      // Respond immediately with deferred ephemeral (shows "thinking..." to user)
      res.json({ type: 5, data: { flags: 64 } });
      // Process command asynchronously after sending HTTP response
      this.discordService.handleHttpSlashCommand(body).catch((err) => {
        this.logger.error(`Error handling HTTP slash command: ${err.message}`, err.stack);
      });
      return;
    }

    // Step 4: MESSAGE_COMPONENT (button click)
    if (body.type === 3) {
      res.json({ type: 6 }); // Deferred component update
      this.discordService.handleHttpComponentInteraction(body).catch((err) => {
        this.logger.error(`Error handling HTTP component interaction: ${err.message}`, err.stack);
      });
      return;
    }

    return res.json({ type: 1 });
  }

  /**
   * Verify Discord's Ed25519 signature using Node.js built-in crypto.
   * No external packages required.
   */
  private verifySignature(
    rawBody: Buffer,
    signature: string,
    timestamp: string,
    publicKey: string,
  ): boolean {
    try {
      const message = Buffer.concat([Buffer.from(timestamp, 'utf-8'), rawBody]);

      // Wrap raw 32-byte Ed25519 public key in DER/SPKI format
      const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
      const publicKeyDer = Buffer.concat([spkiPrefix, Buffer.from(publicKey, 'hex')]);
      const keyObject = crypto.createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });

      return crypto.verify(null, message, keyObject, Buffer.from(signature, 'hex'));
    } catch (err: any) {
      this.logger.error(`Signature verification error: ${err.message}`);
      return false;
    }
  }
}
