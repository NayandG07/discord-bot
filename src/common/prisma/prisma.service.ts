import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  onModuleInit() {
    this.logger.log('Connecting to PostgreSQL via Prisma Client...');
    this.$connect()
      .then(() => {
        this.logger.log('PostgreSQL connection established successfully.');
      })
      .catch((err) => {
        this.logger.error(`PostgreSQL connection error: ${err.message}`);
      });
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from PostgreSQL...');
    await this.$disconnect();
    this.logger.log('PostgreSQL disconnected.');
  }
}
