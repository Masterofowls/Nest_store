import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { and, eq } from 'drizzle-orm';
import { ProductsService } from './products.service';
import { DatabaseService } from '../db/database/database.service';
import { products } from '../db/schema';
import type { Product } from '../db/schema';
import { queryMock } from '../../test/query.mock';

const product: Product = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Keyboard',
  sellerId: '00000000-0000-4000-8000-000000000002',
  categoryId: '00000000-0000-4000-8000-000000000003',
  price: '10.00',
  stockQuantity: 2,
  discountPercent: 0,
  description: null,
  deliveryDays: 3,
  badge: null,
  createdAt: new Date('2026-11-10T00:00:00.000Z'),
};

const listedRow = { ...product, averageRating: '4.5', ratingCount: 2 };
const listedProduct = { ...product, averageRating: 4.5, ratingCount: 2 };

describe('ProductsService database operations', () => {
  let service: ProductsService;
  let select: ReturnType<typeof queryMock<typeof listedRow>>;
  let mutation: ReturnType<typeof queryMock<Product>>;

  beforeEach(async () => {
    select = queryMock([listedRow]);
    mutation = queryMock([product]);
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: DatabaseService,
          useValue: {
            db: {
              select: () => select,
              insert: () => mutation,
              update: () => mutation,
              delete: () => mutation,
            },
          },
        },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('bounds and orders the list query', async () => {
    await expect(service.findAll({ page: 2, limit: 3 })).resolves.toEqual([
      listedProduct,
    ]);
    expect(select.limit).toHaveBeenCalledWith(3);
    expect(select.offset).toHaveBeenCalledWith(3);
    expect(select.orderBy).toHaveBeenCalledTimes(1);
  });

  it('returns an existing product with numeric rating stats', async () => {
    await expect(service.getOrThrow(product.id)).resolves.toEqual(
      listedProduct,
    );
  });

  it('rejects an unknown product', async () => {
    select.where.mockReturnValue(Promise.resolve([]));
    await expect(service.getOrThrow(product.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('derives seller ownership separately from the allowed create input', async () => {
    const input = {
      name: product.name,
      categoryId: product.categoryId,
      price: product.price,
      stockQuantity: product.stockQuantity,
    };
    await expect(service.postProduct(input, product.sellerId)).resolves.toEqual(
      product,
    );
    expect(mutation.values).toHaveBeenCalledWith({
      ...input,
      sellerId: product.sellerId,
      description: undefined,
      discountPercent: undefined,
    });
  });

  it('includes ownership in the update predicate', async () => {
    await expect(
      service.patchProduct({ stockQuantity: 0 }, product.id, product.sellerId),
    ).resolves.toEqual(product);
    const dialect = new PgDialect();
    expect(mutation.where).toHaveBeenCalledTimes(1);
    const condition = mutation.where.mock.calls[0][0];
    const expected = and(
      eq(products.id, product.id),
      eq(products.sellerId, product.sellerId),
    );
    if (!condition || !expected) {
      throw new Error('Ownership predicate is missing');
    }
    expect(dialect.sqlToQuery(condition)).toEqual(dialect.sqlToQuery(expected));
  });

  it.each(['update', 'delete'])(
    'rejects %s by another seller',
    async (operation) => {
      mutation.returning.mockResolvedValue([]);
      const result =
        operation === 'update'
          ? service.patchProduct(
              { name: 'Changed' },
              product.id,
              'other-seller',
            )
          : service.deleteProduct(product.id, 'other-seller');
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.each(['update', 'delete'])(
    'returns 404 for a missing product on %s',
    async (operation) => {
      mutation.returning.mockResolvedValue([]);
      select.where.mockReturnValue(Promise.resolve([]));
      const result =
        operation === 'update'
          ? service.patchProduct(
              { name: 'Changed' },
              product.id,
              product.sellerId,
            )
          : service.deleteProduct(product.id, product.sellerId);
      await expect(result).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('deletes an owned product', async () => {
    await expect(
      service.deleteProduct(product.id, product.sellerId),
    ).resolves.toBeUndefined();
  });

  it.each([
    ['products_category_id_categories_id_fk', BadRequestException],
    ['products_seller_id_seller_profiles_id_fk', ForbiddenException],
  ])('maps the %s foreign key error', async (constraint, exception) => {
    mutation.returning.mockRejectedValue({
      cause: { code: '23503', constraint_name: constraint },
    });
    await expect(
      service.postProduct(product, product.sellerId),
    ).rejects.toBeInstanceOf(exception);
  });

  it('propagates unexpected database failures', async () => {
    const error = new Error('Database unavailable');
    mutation.returning.mockRejectedValue(error);
    await expect(service.postProduct(product, product.sellerId)).rejects.toBe(
      error,
    );
  });

  it('fails explicitly when an insert returns no row', async () => {
    mutation.returning.mockResolvedValue([]);
    await expect(
      service.postProduct(product, product.sellerId),
    ).rejects.toThrow('Product insert did not return a product');
  });
});
