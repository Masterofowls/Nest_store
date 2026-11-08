import { Test } from '@nestjs/testing';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import { AdminGuard } from './admin.guard';
import { DatabaseService } from '../../db/database/database.service';
import { user } from '../../db/schema';
import { queryMock } from '../../../test/query.mock';
import { sessionFixture } from '../../../test/marketplace.fixtures';
import type { AuthSession } from '../session-request';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let query: ReturnType<typeof queryMock<{ isAdmin: boolean }>>;
  const select = jest.fn();

  beforeEach(async () => {
    query = queryMock([{ isAdmin: true }]);
    select.mockReset().mockReturnValue(query);
    const module = await Test.createTestingModule({
      providers: [
        AdminGuard,
        { provide: DatabaseService, useValue: { db: { select } } },
      ],
    }).compile();
    guard = module.get(AdminGuard);
  });

  it('allows a current database admin even when the session flag is false', async () => {
    await expect(
      guard.canActivate(
        new ExecutionContextHost([{ authSession: sessionFixture }]),
      ),
    ).resolves.toBe(true);
    expect(select).toHaveBeenCalledWith({ isAdmin: user.isAdmin });
    const condition = query.where.mock.calls[0][0];
    if (!condition) {
      throw new Error('Admin user predicate is missing');
    }
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(condition)).toEqual(
      dialect.sqlToQuery(eq(user.id, sessionFixture.user.id)),
    );
  });

  it('rejects a missing session without querying the database', async () => {
    await expect(
      guard.canActivate(new ExecutionContextHost([{}])),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(select).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'a non-admin', rows: [{ isAdmin: false }] },
    { label: 'a deleted user', rows: [] },
  ])('rejects $label even with a forged session flag', async ({ rows }) => {
    query.where.mockReturnValue(Promise.resolve(rows));
    const forgedSession: AuthSession = {
      ...sessionFixture,
      user: { ...sessionFixture.user, isAdmin: true },
    };
    await expect(
      guard.canActivate(
        new ExecutionContextHost([{ authSession: forgedSession }]),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('propagates database failures without granting access', async () => {
    const failure = new Error('Database unavailable');
    query.where.mockReturnValue(Promise.reject(failure));
    await expect(
      guard.canActivate(
        new ExecutionContextHost([{ authSession: sessionFixture }]),
      ),
    ).rejects.toBe(failure);
  });
});
