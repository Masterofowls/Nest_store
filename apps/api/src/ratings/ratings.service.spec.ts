import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { queryMock } from '../../test/query.mock';
import { DatabaseService } from '../db/database/database.service';
import { RatingsService } from './ratings.service';

const rating = {
  id: '00000000-0000-4000-8000-000000000001',
  productId: '00000000-0000-4000-8000-000000000002',
  productName: 'Keyboard',
  score: 4,
  comment: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('RatingsService', () => {
  let service: RatingsService;
  let mutation: ReturnType<typeof queryMock<typeof rating>>;
  let product: ReturnType<typeof queryMock<{ name: string }>> & {
    for: jest.Mock;
  };
  let existing: ReturnType<typeof queryMock<{ productId: string | null }>>;
  let transaction: jest.Mock;
  let select: jest.Mock;

  beforeEach(async () => {
    mutation = queryMock([rating]);
    product = Object.assign(queryMock([{ name: 'Current keyboard' }]), {
      for: jest.fn(),
    });
    product.for.mockReturnValue(product);
    existing = queryMock([{ productId: rating.productId }]);
    select = jest.fn().mockReturnValue(product);
    const tx = { select, insert: () => mutation, update: () => mutation };
    transaction = jest.fn((callback: (value: typeof tx) => unknown) =>
      callback(tx),
    );
    const module = await Test.createTestingModule({
      providers: [
        RatingsService,
        {
          provide: DatabaseService,
          useValue: {
            db: { select: () => mutation, delete: () => mutation, transaction },
          },
        },
      ],
    }).compile();
    service = module.get(RatingsService);
  });

  it('locks and snapshots the current product for rating creation', async () => {
    await expect(
      service.create('buyer', { productId: rating.productId, score: 4 }),
    ).resolves.toEqual(rating);
    expect(product.for).toHaveBeenCalledWith('share');
    expect(mutation.values).toHaveBeenCalledWith({
      userId: 'buyer',
      productId: rating.productId,
      productName: 'Current keyboard',
      score: 4,
      comment: undefined,
    });
  });

  it('rejects rating creation for a missing product', async () => {
    product.for.mockResolvedValue([]);
    await expect(
      service.create('buyer', { productId: rating.productId, score: 4 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mutation.values).not.toHaveBeenCalled();
  });

  it('maps duplicates and deleted users while preserving unexpected errors', async () => {
    transaction.mockRejectedValue({
      cause: { code: '23505', constraint_name: 'ratings_user_product_unique' },
    });
    await expect(
      service.create('buyer', { productId: rating.productId, score: 4 }),
    ).rejects.toBeInstanceOf(ConflictException);
    transaction.mockRejectedValue({
      cause: { code: '23503', constraint_name: 'ratings_user_id_user_id_fk' },
    });
    await expect(
      service.create('buyer', { productId: rating.productId, score: 4 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const error = new Error('Database unavailable');
    transaction.mockRejectedValue(error);
    await expect(
      service.create('buyer', { productId: rating.productId, score: 4 }),
    ).rejects.toBe(error);
  });

  it('updates the current snapshot and predicates the write on ownership', async () => {
    select.mockReturnValueOnce(existing);
    await expect(
      service.update('buyer', rating.id, { score: 5, comment: null }),
    ).resolves.toEqual(rating);
    expect(mutation.set.mock.calls[0][0]).toMatchObject({
      score: 5,
      comment: null,
      productName: 'Current keyboard',
    });
    expect(mutation.set.mock.calls[0][0]).toHaveProperty(
      'updatedAt',
      expect.any(Date),
    );
    const predicate = mutation.where.mock.calls[0][0];
    if (!predicate) throw new Error('Missing rating ownership predicate');
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(predicate).params).toEqual([rating.id, 'buyer']);
    expect(dialect.sqlToQuery(predicate).sql).toContain('"user_id"');
  });

  it('does not update another user rating or a deleted-product snapshot', async () => {
    select.mockReturnValueOnce(existing);
    existing.where.mockReturnValueOnce(Promise.resolve([]));
    await expect(
      service.update('other', rating.id, { score: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    select.mockReturnValueOnce(existing);
    existing.where.mockReturnValueOnce(Promise.resolve([{ productId: null }]));
    await expect(
      service.update('buyer', rating.id, { score: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mutation.set).not.toHaveBeenCalled();
  });

  it('returns not found if a rating disappears before the update', async () => {
    select.mockReturnValueOnce(existing);
    mutation.returning.mockResolvedValue([]);
    await expect(
      service.update('buyer', rating.id, { score: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('bounds the private rating list without exposing ownership fields', async () => {
    await expect(
      service.findOwn('buyer', { page: 3, limit: 2 }),
    ).resolves.toEqual([rating]);
    expect(mutation.offset).toHaveBeenCalledWith(4);
    expect(mutation.limit).toHaveBeenCalledWith(2);
    const predicate = mutation.where.mock.calls[0][0];
    if (!predicate) throw new Error('Missing rating ownership predicate');
    expect(new PgDialect().sqlToQuery(predicate).params).toEqual(['buyer']);
  });

  it('requires ownership on deletion and permits deleting historical snapshots', async () => {
    await service.remove('buyer', rating.id);
    const predicate = mutation.where.mock.calls[0][0];
    if (!predicate) throw new Error('Missing rating ownership predicate');
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(predicate).params).toEqual([rating.id, 'buyer']);
    expect(dialect.sqlToQuery(predicate).sql).toContain('"user_id"');
    mutation.returning.mockResolvedValue([]);
    await expect(service.remove('other', rating.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns explicit not found for public ratings of an absent product', async () => {
    mutation.where.mockReturnValue(Promise.resolve([]));
    await expect(
      service.findForProduct(rating.productId, { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
