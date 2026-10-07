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

type DiscordRequest = Request & { rawBody?: Buffer };

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
    @Req() req: DiscordRequest,
    @Res() res: Response,
    @Headers('x-signature-ed25519') signature?: string,
    @Headers('x-signature-timestamp') timestamp?: string,
  ) {
    // Read headers from the request as a fallback. This keeps verification working
    // with Express adapters/proxies that do not populate Nest's @Headers argument.
    const signatureHeader = this.getHeader(signature, req.headers['x-signature-ed25519']);
    const timestampHeader = this.getHeader(timestamp, req.headers['x-signature-timestamp']);
    const rawBody = req.rawBody;

    // Discord signs the exact bytes sent over the wire. Never reconstruct the body
    // from req.body because JSON parsing/stringifying can change whitespace, escapes,
    // or property ordering and invalidate an otherwise valid signature.
    if (!rawBody || !signatureHeader || !timestampHeader) {
      this.logger.warn('Rejected interaction request because signature headers or raw body are missing.');
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid request signature' });
    }

    const publicKey = this.config.get<string>('DISCORD_PUBLIC_KEY')?.trim() ?? '';

    // Step 1: Verify Ed25519 signature from Discord
    if (!this.verifySignature(rawBody, signatureHeader, timestampHeader, publicKey)) {
      this.logger.warn('Rejected interaction request with invalid signature.');
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid request signature' });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      this.logger.warn('Rejected interaction request with an invalid JSON body.');
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Invalid request body' });
    }

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

  private getHeader(
    decoratorValue: string | undefined,
    requestValue: string | string[] | undefined,
  ): string | undefined {
    if (decoratorValue) return decoratorValue;
    return Array.isArray(requestValue) ? requestValue[0] : requestValue;
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
      if (!/^[0-9a-f]{128}$/i.test(signature) || !/^\d+$/.test(timestamp) || !/^[0-9a-f]{64}$/i.test(publicKey)) {
        return false;
      }

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
