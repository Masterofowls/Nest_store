import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/env.schema';
import { DatabaseService } from '../db/database/database.service';
import { AuthService } from './auth.service';

describe('AuthService tests', () => {
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
      expect(service.auth.options.secret).toBe(
        'fake-test-secret-with-at-least-thirty-two-characters',
      );
      const adapter = service.auth.options.database(service.auth.options);
      expect(adapter.id).toBe('drizzle');
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
