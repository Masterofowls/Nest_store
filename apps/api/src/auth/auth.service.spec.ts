import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/env.schema';
import { DatabaseService } from '../db/database/database.service';
import { AuthService } from './auth.service';

describe('AuthService tests', () => {
  beforeEach(() => {
    const environment = { ...process.env };
    delete environment.TRUSTED_FRONTEND_ORIGIN;
    delete environment.BETTER_AUTH_TRUSTED_ORIGINS;
    jest.replaceProperty(process, 'env', environment);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('auth initialization test', async () => {
    const config = new ConfigService<Environment, true>({
      DATABASE_URL: 'postgresql://localhost:5432/store_test',
      BETTER_AUTH_SECRET:
        'fake-test-secret-with-at-least-thirty-two-characters',
      BETTER_AUTH_URL: 'http://localhost:3000',
    });
    const database = new DatabaseService(config);

    try {
      const service = new AuthService(config, database);
      expect(typeof service.auth.handler).toBe('function');
      expect(service.auth.options.emailAndPassword?.enabled).toBe(true);
      expect(service.auth.options.user?.additionalFields.isAdmin).toEqual({
        type: 'boolean',
        defaultValue: false,
        input: false,
      });
      expect(service.auth.options.baseURL).toBe('http://localhost:3000');
      expect(service.auth.options.advanced?.disableOriginCheck).toBe(false);
      expect(service.trustedFrontendOrigin).toBeUndefined();
      expect(service.auth.options.trustedOrigins).toEqual([]);
      const context = await service.auth.$context;
      expect(context.isTrustedOrigin('http://localhost:3000')).toBe(true);
      expect(context.isTrustedOrigin('http://localhost:3001')).toBe(false);
      expect(service.auth.options.secret).toBe(
        'fake-test-secret-with-at-least-thirty-two-characters',
      );
      const adapter = service.auth.options.database(service.auth.options);
      expect(adapter.id).toBe('drizzle');
    } finally {
      await database.onModuleDestroy();
    }
  });

  it('trusts the configured frontend and the original base origin', async () => {
    const config = new ConfigService<Environment, true>({
      DATABASE_URL: 'postgresql://localhost:5432/store_test',
      BETTER_AUTH_SECRET:
        'fake-test-secret-with-at-least-thirty-two-characters',
      BETTER_AUTH_URL: 'http://localhost:3000',
      TRUSTED_FRONTEND_ORIGIN: 'http://localhost:3001',
    });
    const database = new DatabaseService(config);

    try {
      const service = new AuthService(config, database);
      expect(service.trustedFrontendOrigin).toBe('http://localhost:3001');
      expect(service.auth.options.trustedOrigins).toEqual([
        'http://localhost:3001',
      ]);
      const context = await service.auth.$context;
      expect(context.isTrustedOrigin('http://localhost:3000')).toBe(true);
      expect(context.isTrustedOrigin('http://localhost:3001')).toBe(true);
      expect(context.isTrustedOrigin('http://localhost:3002')).toBe(false);
      expect(context.isTrustedOrigin('https://localhost:3001')).toBe(false);
      expect(
        context.isTrustedOrigin('http://localhost:3001.attacker.example'),
      ).toBe(false);
    } finally {
      await database.onModuleDestroy();
    }
  });

  it('rejects frontend auth requests when no frontend origin is configured', async () => {
    const config = new ConfigService<Environment, true>({
      DATABASE_URL: 'postgresql://localhost:5432/store_test',
      BETTER_AUTH_SECRET:
        'fake-test-secret-with-at-least-thirty-two-characters',
      BETTER_AUTH_URL: 'http://localhost:3000',
    });
    const database = new DatabaseService(config);

    try {
      const service = new AuthService(config, database);
      const response = await service.auth.handler(
        new Request('http://localhost:3000/api/auth/sign-in/email', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3001',
          },
          body: JSON.stringify({
            email: 'origin-test@example.test',
            password: 'test-password',
          }),
        }),
      );
      expect(response.status).toBe(403);
    } finally {
      await database.onModuleDestroy();
    }
  });

  it.each(['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'] as const)(
    'rejects missing %s',
    async (missingKey) => {
      const environment: Environment = {
        DATABASE_URL: 'postgresql://localhost:5432/store_test',
        BETTER_AUTH_SECRET:
          'fake-test-secret-with-at-least-thirty-two-characters',
        BETTER_AUTH_URL: 'http://localhost:3000',
      };
      const config = new ConfigService<Environment, true>(environment);
      const database = new DatabaseService(config);
      const get = jest.spyOn(config, 'get').mockImplementation((key) => {
        if (key === missingKey) {
          return undefined;
        }
        if (key === 'TRUSTED_FRONTEND_ORIGIN') {
          return undefined;
        }
        if (
          key === 'DATABASE_URL' ||
          key === 'BETTER_AUTH_SECRET' ||
          key === 'BETTER_AUTH_URL'
        ) {
          return environment[key];
        }
        throw new Error('Unexpected configuration key');
      });

      try {
        expect(() => new AuthService(config, database)).toThrow(missingKey);
      } finally {
        get.mockRestore();
        await database.onModuleDestroy();
      }
    },
  );
});
