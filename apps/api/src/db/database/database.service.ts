import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../schema';
import type { Environment } from '../../config/env.schema';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly client: ReturnType<typeof postgres>;
  readonly db: ReturnType<typeof drizzle<typeof schema>>;

  constructor(config: ConfigService<Environment, true>) {
    const url = config.getOrThrow('DATABASE_URL', { infer: true });
    const hostname = new URL(url).hostname;
    const isLoopback =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]';

    this.client = postgres(url, {
      ssl: isLoopback ? false : 'require',
      connect_timeout: 10,
    });

    this.db = drizzle(this.client, { schema });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
