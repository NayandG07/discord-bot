import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Redlock, { Lock } from 'redlock';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private redlock: Redlock;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.ensureClient();
  }

  private ensureClient() {
    if (this.client) return;

    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const db = this.configService.get<number>('REDIS_DB', 0);

    this.logger.log(`Connecting to Redis at ${host}:${port}...`);
    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      db,
      lazyConnect: false,
    });

    this.redlock = new Redlock([this.client], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 100,
      automaticExtensionThreshold: 500,
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected successfully.');
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis error encountered: ${err.message}`, err.stack);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      this.logger.log('Disconnecting Redis client...');
      await this.client.quit();
    }
  }

  getClient(): Redis {
    this.ensureClient();
    return this.client;
  }

  getRedlock(): Redlock {
    return this.redlock;
  }

  async acquireLock(resourceKey: string, ttlMs: number): Promise<Lock> {
    const key = `devguild:lock:${resourceKey}`;
    return this.redlock.acquire([key], ttlMs);
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async publish(channel: string, message: any): Promise<void> {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    await this.client.publish(channel, payload);
  }
}
