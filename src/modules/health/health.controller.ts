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
}
