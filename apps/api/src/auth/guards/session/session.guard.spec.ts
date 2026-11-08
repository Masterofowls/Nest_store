import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import type { Environment } from '../../../config/env.schema';
import { DatabaseService } from '../../../db/database/database.service';
import { AuthService } from '../../auth.service';
import type { AuthSession, SessionRequest } from '../../session-request';
import { SessionGuard } from './session.guard';

describe('SessionGuard session lookup', () => {
  const date = new Date('2026-01-01T00:00:00Z');
  const validSession: AuthSession = {
    user: {
      id: 'test-user',
      name: 'Test buyer',
      email: 'buyer@example.test',
      emailVerified: false,
      image: null,
      createdAt: date,
      updatedAt: date,
    },
    session: {
      id: 'test-session',
      userId: 'test-user',
      token: 'fake-session-token',
      expiresAt: new Date('2026-01-02T00:00:00Z'),
      createdAt: date,
      updatedAt: date,
      ipAddress: null,
      userAgent: null,
    },
  };

  it.each([validSession, null])(
    'uses the session lookup result without trusting the cookie alone %#',
    async (session) => {
      const config = new ConfigService<Environment, true>({
        DATABASE_URL: 'postgresql://localhost:5432/store_test',
        BETTER_AUTH_SECRET:
          'fake-test-secret-with-at-least-thirty-two-characters',
        BETTER_AUTH_URL: 'http://localhost:3000',
      });
      const database = new DatabaseService(config);

      try {
        const authService = new AuthService(config, database);
        const getSession = jest
          .spyOn(authService.auth.api, 'getSession')
          .mockResolvedValue(session);
        try {
          const guard = new SessionGuard(authService);
          const request: Pick<SessionRequest, 'headers' | 'authSession'> = {
            headers: { cookie: 'better-auth.session_token=fake-cookie' },
          };
          const context = new ExecutionContextHost([request]);
          context.setType('http');

          if (session) {
            await expect(guard.canActivate(context)).resolves.toBe(true);
            expect(request.authSession).toBe(session);
          } else {
            await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
              UnauthorizedException,
            );
            expect(request.authSession).toBeUndefined();
          }
          expect(getSession).toHaveBeenCalledTimes(1);
          const headers = getSession.mock.calls[0][0]?.headers;
          expect(headers).toBeInstanceOf(Headers);
          if (headers instanceof Headers) {
            expect(headers.get('cookie')).toBe(request.headers.cookie);
          }
        } finally {
          getSession.mockRestore();
        }
      } finally {
        await database.onModuleDestroy();
      }
    },
  );

  it('propagates session lookup failures without granting access', async () => {
    const config = new ConfigService<Environment, true>({
      DATABASE_URL: 'postgresql://localhost:5432/store_test',
      BETTER_AUTH_SECRET:
        'fake-test-secret-with-at-least-thirty-two-characters',
      BETTER_AUTH_URL: 'http://localhost:3000',
    });
    const database = new DatabaseService(config);

    try {
      const authService = new AuthService(config, database);
      const failure = new Error('Session lookup unavailable');
      const getSession = jest
        .spyOn(authService.auth.api, 'getSession')
        .mockRejectedValue(failure);
      try {
        const guard = new SessionGuard(authService);
        const request: Pick<SessionRequest, 'headers' | 'authSession'> = {
          headers: {},
        };
        const context = new ExecutionContextHost([request]);
        context.setType('http');

        await expect(guard.canActivate(context)).rejects.toBe(failure);
        expect(request.authSession).toBeUndefined();
      } finally {
        getSession.mockRestore();
      }
    } finally {
      await database.onModuleDestroy();
    }
  });
});

it('rejects requests without a session cookie', async () => {
  const config = new ConfigService<Environment, true>({
    DATABASE_URL: 'postgresql://localhost:5432/store_test',
    BETTER_AUTH_SECRET: 'fake-test-secret-with-at-least-thirty-two-characters',
    BETTER_AUTH_URL: 'http://localhost:3000',
  });
  const database = new DatabaseService(config);

  try {
    const authService = new AuthService(config, database);
    const guard = new SessionGuard(authService);
    const context = new ExecutionContextHost([{ headers: {} }]);
    context.setType('http');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  } finally {
    await database.onModuleDestroy();
  }
});
