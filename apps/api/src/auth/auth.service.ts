import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import type { Environment } from '../config/env.schema';
import { DatabaseService } from '../db/database/database.service';
import { account, session, user, verification } from '../db/schema';

@Injectable()
export class AuthService {
  readonly auth: ReturnType<AuthService['createAuth']>;

  constructor(
    config: ConfigService<Environment, true>,
    databaseService: DatabaseService,
  ) {
    this.auth = this.createAuth(config, databaseService);
  }

  private createAuth(
    config: ConfigService<Environment, true>,
    databaseService: DatabaseService,
  ) {
    return betterAuth({
      database: drizzleAdapter(databaseService.db, {
        provider: 'pg',
        schema: { user, session, account, verification },
      }),
      secret: config.getOrThrow('BETTER_AUTH_SECRET', { infer: true }),
      baseURL: config.getOrThrow('BETTER_AUTH_URL', { infer: true }),
      emailAndPassword: { enabled: true },
      user: {
        additionalFields: {
          isAdmin: {
            type: 'boolean',
            defaultValue: false,
            input: false,
          },
        },
      },
    });
  }
}
