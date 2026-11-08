import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { queryMock } from '../../test/query.mock';
import { DatabaseService } from '../db/database/database.service';
import { user } from '../db/schema';
import { UsersService } from './users.service';

const publicUser = {
  id: 'buyer',
  name: 'Updated buyer',
  email: 'collections-buyer@example.test',
  emailVerified: false,
  image: null,
};

describe('UsersService account operations', () => {
  let service: UsersService;
  let mutation: ReturnType<typeof queryMock<typeof publicUser>>;

  beforeEach(async () => {
    mutation = queryMock([publicUser]);
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DatabaseService,
          useValue: { db: { update: () => mutation, delete: () => mutation } },
        },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('updates only the signed-in account name and public fields', async () => {
    await expect(
      service.updateMe('buyer', { name: 'Updated buyer' }),
    ).resolves.toEqual(publicUser);
    expect(mutation.set.mock.calls[0][0]).toMatchObject({
      name: 'Updated buyer',
    });
    expect(mutation.set.mock.calls[0][0]).toHaveProperty(
      'updatedAt',
      expect.any(Date),
    );
    const predicate = mutation.where.mock.calls[0][0];
    expect(predicate).toBeDefined();
    if (!predicate) throw new Error('Missing account ownership predicate');
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(predicate)).toEqual(
      dialect.sqlToQuery(eq(user.id, 'buyer')),
    );
    expect(mutation.returning).toHaveBeenCalledWith({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
    });
  });

  it('deletes only the authenticated account', async () => {
    await expect(service.deleteMe('buyer')).resolves.toBeUndefined();
    const predicate = mutation.where.mock.calls[0][0];
    if (!predicate) throw new Error('Missing account ownership predicate');
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(predicate)).toEqual(
      dialect.sqlToQuery(eq(user.id, 'buyer')),
    );
  });

  it('rejects a concurrently removed account on update', async () => {
    mutation.returning.mockResolvedValue([]);
    await expect(
      service.updateMe('buyer', { name: 'Buyer' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a concurrently removed account on deletion', async () => {
    mutation.returning.mockResolvedValue([]);
    await expect(service.deleteMe('buyer')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
