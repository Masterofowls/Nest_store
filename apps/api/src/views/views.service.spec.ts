import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { queryMock } from '../../test/query.mock';
import { DatabaseService } from '../db/database/database.service';
import { ViewsService } from './views.service';

const view = {
  id: '00000000-0000-4000-8000-000000000001',
  productId: '00000000-0000-4000-8000-000000000002',
  viewedAt: new Date('2026-01-01'),
};

describe('ViewsService', () => {
  let service: ViewsService;
  let query: ReturnType<typeof queryMock<typeof view>> & {
    for: jest.Mock;
    innerJoin: jest.Mock;
  };
  let transaction: jest.Mock;

  beforeEach(async () => {
    query = Object.assign(queryMock([view]), {
      for: jest.fn(),
      innerJoin: jest.fn(),
    });
    query.for.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    const tx = { select: () => query, insert: () => query };
    transaction = jest.fn((callback: (value: typeof tx) => unknown) =>
      callback(tx),
    );
    const module = await Test.createTestingModule({
      providers: [
        ViewsService,
        {
          provide: DatabaseService,
          useValue: { db: { select: () => query, transaction } },
        },
      ],
    }).compile();
    service = module.get(ViewsService);
  });

  it('creates a separate event on every authenticated view', async () => {
    await service.record('buyer', view.productId);
    await service.record('buyer', view.productId);
    expect(query.values).toHaveBeenCalledTimes(2);
    expect(query.values).toHaveBeenCalledWith({
      userId: 'buyer',
      productId: view.productId,
    });
    expect(query.for).toHaveBeenCalledWith('share');
  });

  it('does not record a missing product', async () => {
    query.for.mockResolvedValue([]);
    await expect(
      service.record('buyer', view.productId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(query.values).not.toHaveBeenCalled();
  });

  it('maps a concurrently deleted viewer account to unauthorized', async () => {
    transaction.mockRejectedValue({
      cause: {
        code: '23503',
        constraint_name: 'product_views_user_id_user_id_fk',
      },
    });
    await expect(
      service.record('buyer', view.productId),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('propagates unexpected database errors', async () => {
    const error = new Error('Database unavailable');
    transaction.mockRejectedValue(error);
    await expect(service.record('buyer', view.productId)).rejects.toBe(error);
  });

  it('bounds history and predicates it on the current viewer', async () => {
    await expect(
      service.findOwn('buyer', { page: 2, limit: 4 }),
    ).resolves.toEqual([view]);
    expect(query.offset).toHaveBeenCalledWith(4);
    expect(query.limit).toHaveBeenCalledWith(4);
    const predicate = query.where.mock.calls[0][0];
    if (!predicate) throw new Error('Missing view ownership predicate');
    expect(new PgDialect().sqlToQuery(predicate).params).toEqual(['buyer']);
  });
});
