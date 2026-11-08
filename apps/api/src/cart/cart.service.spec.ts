import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { CartService } from './cart.service';
import { DatabaseService } from '../db/database/database.service';
import { productFixture } from '../../test/marketplace.fixtures';
import { storeDatabaseMock, storeQuery } from './store-query.mock';
import { cartFixture, cartItemFixture } from './store.fixture';

describe('CartService', () => {
  let service: CartService;
  let mock: ReturnType<typeof storeDatabaseMock>;

  beforeEach(async () => {
    mock = storeDatabaseMock();
    const module = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: DatabaseService, useValue: { db: mock.db } },
      ],
    }).compile();
    service = module.get(CartService);
  });

  function lockedCart() {
    const query = storeQuery([cartFixture]);
    mock.tx.select.mockReturnValueOnce(query);
    return { query };
  }

  it('does not create a cart during an empty read', async () => {
    await expect(
      service.find('test-buyer', { page: 1, limit: 10 }),
    ).resolves.toEqual({ id: null, items: [] });
    expect(mock.db.insert).not.toHaveBeenCalled();
  });

  it('reads only the user cart with bounded items', async () => {
    const cart = storeQuery([cartFixture]);
    const items = storeQuery([{ ...cartItemFixture, product: productFixture }]);
    mock.db.select.mockReturnValueOnce(cart).mockReturnValueOnce(items);
    const result = await service.find('test-buyer', { page: 2, limit: 3 });
    expect(result.items).toHaveLength(1);
    expect(items.limit).toHaveBeenCalledWith(3);
    expect(items.offset).toHaveBeenCalledWith(3);
    const predicate = cart.where.mock.calls[0][0];
    if (!predicate) throw new Error('Cart ownership predicate missing');
    expect(new PgDialect().sqlToQuery(predicate).params).toEqual([
      'test-buyer',
    ]);
  });

  it('adds a new item while holding the cart and product locks', async () => {
    const { query: cart } = lockedCart();
    const product = storeQuery([productFixture]);
    mock.tx.select
      .mockReturnValueOnce(product)
      .mockReturnValueOnce(storeQuery([]));
    const inserted = storeQuery([cartItemFixture]);
    mock.tx.insert
      .mockReturnValueOnce(storeQuery([]))
      .mockReturnValueOnce(inserted);
    await expect(
      service.add('test-buyer', { productId: productFixture.id, quantity: 2 }),
    ).resolves.toEqual(cartItemFixture);
    expect(cart.for).toHaveBeenCalledWith('update');
    expect(product.for).toHaveBeenCalledWith('update');
    expect(inserted.values).toHaveBeenCalledWith({
      cartId: cartFixture.id,
      productId: productFixture.id,
      quantity: 2,
    });
  });

  it('accumulates additions after serializing on the cart', async () => {
    lockedCart();
    mock.tx.select
      .mockReturnValueOnce(storeQuery([productFixture]))
      .mockReturnValueOnce(storeQuery([cartItemFixture]));
    const updated = storeQuery([{ ...cartItemFixture, quantity: 5 }]);
    mock.tx.update.mockReturnValueOnce(updated);
    await expect(
      service.add('test-buyer', { productId: productFixture.id, quantity: 3 }),
    ).resolves.toMatchObject({ quantity: 5 });
    const values = updated.set.mock.calls[0][0] as {
      quantity: number;
      updatedAt: Date;
    };
    expect(values.quantity).toBe(5);
    expect(values.updatedAt).toBeInstanceOf(Date);
  });

  it.each([6, 1000])(
    'rejects aggregate quantity %s before writes',
    async (stockQuantity) => {
      lockedCart();
      mock.tx.select
        .mockReturnValueOnce(storeQuery([{ ...productFixture, stockQuantity }]))
        .mockReturnValueOnce(
          storeQuery([{ ...cartItemFixture, quantity: stockQuantity }]),
        );
      await expect(
        service.add('test-buyer', {
          productId: productFixture.id,
          quantity: 1,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mock.tx.update).not.toHaveBeenCalled();
    },
  );

  it('rejects missing products', async () => {
    lockedCart();
    await expect(
      service.add('test-buyer', { productId: productFixture.id, quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([0, 1000, 1.2])(
    'rejects invalid quantity %s before a transaction',
    (quantity) => {
      expect(() =>
        service.add('test-buyer', { productId: productFixture.id, quantity }),
      ).toThrow(BadRequestException);
      expect(mock.db.transaction).not.toHaveBeenCalled();
    },
  );

  it('updates only an owned item and checks stock', async () => {
    lockedCart();
    mock.tx.select
      .mockReturnValueOnce(storeQuery([cartItemFixture]))
      .mockReturnValueOnce(storeQuery([productFixture]));
    const updated = storeQuery([{ ...cartItemFixture, quantity: 3 }]);
    mock.tx.update.mockReturnValueOnce(updated);
    await expect(
      service.update('test-buyer', cartItemFixture.id, { quantity: 3 }),
    ).resolves.toMatchObject({ quantity: 3 });
    const condition = updated.where.mock.calls[0][0];
    if (!condition) throw new Error('Cart item predicate missing');
    expect(new PgDialect().sqlToQuery(condition).params).toEqual([
      cartItemFixture.id,
      cartFixture.id,
    ]);
  });

  it('rejects updates above stock', async () => {
    lockedCart();
    mock.tx.select
      .mockReturnValueOnce(storeQuery([cartItemFixture]))
      .mockReturnValueOnce(storeQuery([productFixture]));
    await expect(
      service.update('test-buyer', cartItemFixture.id, { quantity: 6 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mock.tx.update).not.toHaveBeenCalled();
  });

  it.each(['update', 'delete'])(
    'hides missing or foreign items on %s',
    async (operation) => {
      lockedCart();
      await expect(
        operation === 'update'
          ? service.update('test-buyer', cartItemFixture.id, { quantity: 1 })
          : service.delete('test-buyer', cartItemFixture.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('deletes only an owned item', async () => {
    lockedCart();
    const deleted = storeQuery([{ id: cartItemFixture.id }]);
    mock.tx.delete.mockReturnValueOnce(deleted);
    await expect(
      service.delete('test-buyer', cartItemFixture.id),
    ).resolves.toBeUndefined();
    const condition = deleted.where.mock.calls[0][0];
    if (!condition) throw new Error('Cart delete predicate missing');
    expect(new PgDialect().sqlToQuery(condition).params).toEqual([
      cartItemFixture.id,
      cartFixture.id,
    ]);
  });
});
