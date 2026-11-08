import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { queryMock } from '../../test/query.mock';
import { DatabaseService } from '../db/database/database.service';
import { FavouritesService } from './favourites.service';

const favourite = {
  id: '00000000-0000-4000-8000-000000000001',
  productId: '00000000-0000-4000-8000-000000000002',
  productName: 'Keyboard',
  createdAt: new Date('2026-01-01'),
};

describe('FavouritesService', () => {
  let service: FavouritesService;
  let mutation: ReturnType<typeof queryMock<typeof favourite>>;
  let product: ReturnType<typeof queryMock<{ name: string }>> & {
    for: jest.Mock;
  };
  let transaction: jest.Mock;

  beforeEach(async () => {
    mutation = queryMock([favourite]);
    product = Object.assign(queryMock([{ name: 'Keyboard' }]), {
      for: jest.fn(),
    });
    product.for.mockReturnValue(product);
    const tx = { select: () => product, insert: () => mutation };
    transaction = jest.fn((callback: (value: typeof tx) => unknown) =>
      callback(tx),
    );
    const module = await Test.createTestingModule({
      providers: [
        FavouritesService,
        {
          provide: DatabaseService,
          useValue: {
            db: { select: () => mutation, delete: () => mutation, transaction },
          },
        },
      ],
    }).compile();
    service = module.get(FavouritesService);
  });

  it('locks the product and snapshots its current name on insert', async () => {
    await expect(service.create('buyer', favourite.productId)).resolves.toEqual(
      favourite,
    );
    expect(product.for).toHaveBeenCalledWith('share');
    expect(mutation.values).toHaveBeenCalledWith({
      userId: 'buyer',
      productId: favourite.productId,
      productName: 'Keyboard',
    });
  });

  it('does not create a favourite for a missing product', async () => {
    product.for.mockResolvedValue([]);
    await expect(
      service.create('buyer', favourite.productId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mutation.values).not.toHaveBeenCalled();
  });

  it('maps the unique product constraint to conflict without swallowing other errors', async () => {
    transaction.mockRejectedValue({
      cause: {
        code: '23505',
        constraint_name: 'favourites_user_product_unique',
      },
    });
    await expect(
      service.create('buyer', favourite.productId),
    ).rejects.toBeInstanceOf(ConflictException);
    const error = new Error('Database unavailable');
    transaction.mockRejectedValue(error);
    await expect(service.create('buyer', favourite.productId)).rejects.toBe(
      error,
    );
  });

  it('maps a deleted account foreign key to unauthorized', async () => {
    transaction.mockRejectedValue({
      cause: {
        code: '23503',
        constraint_name: 'favourites_user_id_user_id_fk',
      },
    });
    await expect(
      service.create('buyer', favourite.productId),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('bounds the own-user list including deleted-product snapshots', async () => {
    await expect(
      service.findAll('buyer', { page: 2, limit: 3 }),
    ).resolves.toEqual([favourite]);
    expect(mutation.limit).toHaveBeenCalledWith(3);
    expect(mutation.offset).toHaveBeenCalledWith(3);
    const predicate = mutation.where.mock.calls[0][0];
    if (!predicate) throw new Error('Missing favourite ownership predicate');
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(predicate).params).toEqual(['buyer']);
    expect(dialect.sqlToQuery(predicate).sql).toContain('"user_id"');
  });

  it('uses both owner and row ID when deleting', async () => {
    await service.remove('buyer', favourite.id);
    const predicate = mutation.where.mock.calls[0][0];
    if (!predicate) throw new Error('Missing favourite ownership predicate');
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(predicate).params).toEqual([
      favourite.id,
      'buyer',
    ]);
    expect(dialect.sqlToQuery(predicate).sql).toContain('"user_id"');
    mutation.returning.mockResolvedValue([]);
    await expect(service.remove('other', favourite.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
