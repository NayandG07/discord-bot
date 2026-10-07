import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { DiscordService } from '../discord/discord.service';
import { Response } from 'express';

@ApiTags('Health & Monitoring')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly discord: DiscordService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint for keep-alive monitoring and container orchestration' })
  async checkHealth(@Res() res: Response) {
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      database: 'unknown',
      redis: 'unknown',
      discordGateway: 'unknown',
    };

    let isHealthy = true;

    // 1. Check PostgreSQL / Supabase
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      status.database = 'connected';
    } catch (err: any) {
      status.database = `error: ${err.message}`;
      isHealthy = false;
    }

    // 2. Check Redis / Redis Cloud
    try {
      const pong = await this.redis.getClient().ping();
      status.redis = pong === 'PONG' ? 'connected' : 'degraded';
    } catch (err: any) {
      status.redis = `error: ${err.message}`;
      isHealthy = false;
    }

    // 3. Check Discord Gateway
    try {
      const discordClient = this.discord.getClient();
      // Status 0 in Discord.js indicates READY
      const wsStatus = discordClient.ws.status;
      status.discordGateway = wsStatus === 0 ? 'connected' : `status_code_${wsStatus}`;
    } catch (err: any) {
      status.discordGateway = `error: ${err.message}`;
    }

    status.status = isHealthy ? 'healthy' : 'degraded';
    const httpStatus = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(httpStatus).json(status);
  }

  @Get('ping')
  @ApiOperation({ summary: 'Ultra-lightweight ping endpoint for uptime monitors' })
  ping(@Res() res: Response) {
    return res.status(HttpStatus.OK).send('OK');
  }

  @Get('test-discord')
  @ApiOperation({ summary: 'Diagnostics endpoint to test outbound HTTPS connectivity to Discord API from Render' })
  async testDiscord(@Res() res: Response) {
    const https = await import('https');
    const start = Date.now();

    const result: any = {
      timestamp: new Date().toISOString(),
      latencyMs: null,
      status: null,
      success: false,
      error: null,
      gatewayUrl: null,
    };

    try {
      const data = await new Promise<string>((resolve, reject) => {
        const req = https.request({
          hostname: 'discord.com',
          port: 443,
          path: '/api/v10/gateway',
          method: 'GET',
          headers: {
            'User-Agent': 'DiscordBot (https://discord.js.org, 14.16.3)',
            'Accept': 'application/json',
          },
          family: 4, // Force IPv4
          timeout: 8000,
        }, (discordRes) => {
          result.status = discordRes.statusCode;
          let body = '';
          discordRes.on('data', chunk => body += chunk);
          discordRes.on('end', () => resolve(body));
        });

        req.on('timeout', () => req.destroy(new Error('Connection timed out after 8000ms')));
        req.on('error', reject);
        req.end();
      });

      result.latencyMs = Date.now() - start;
      const parsed = JSON.parse(data);
      result.gatewayUrl = parsed.url;
      result.success = result.status === 200;
    } catch (err: any) {
      result.latencyMs = Date.now() - start;
      result.error = err.message;
    }

    return res.status(result.success ? HttpStatus.OK : HttpStatus.BAD_GATEWAY).json(result);
  }
}
