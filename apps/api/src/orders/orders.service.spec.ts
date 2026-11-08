import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { OrdersService } from './orders.service';
import { DatabaseService } from '../db/database/database.service';
import { productFixture } from '../../test/marketplace.fixtures';
import {
  cartFixture,
  cartItemFixture,
  orderFixture,
  orderItemFixture,
} from '../cart/store.fixture';
import { storeDatabaseMock, storeQuery } from '../cart/store-query.mock';

describe('OrdersService', () => {
  let service: OrdersService;
  let mock: ReturnType<typeof storeDatabaseMock>;
  const key = '00000000-0000-4000-8000-000000000014';

  beforeEach(async () => {
    mock = storeDatabaseMock();
    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: DatabaseService, useValue: { db: mock.db } },
      ],
    }).compile();
    service = module.get(OrdersService);
  });

  function checkoutReads(stock = productFixture.stockQuantity) {
    const cart = storeQuery([cartFixture]);
    const products = storeQuery([{ ...productFixture, stockQuantity: stock }]);
    mock.tx.select
      .mockReturnValueOnce(cart)
      .mockReturnValueOnce(storeQuery([]))
      .mockReturnValueOnce(storeQuery([cartItemFixture]))
      .mockReturnValueOnce(products);
    return { cart, products };
  }

  it('creates pending snapshots, decrements stock and empties the cart atomically', async () => {
    const reads = checkoutReads();
    const order = storeQuery([orderFixture]);
    const items = storeQuery([orderItemFixture]);
    mock.tx.insert
      .mockReturnValueOnce(storeQuery([]))
      .mockReturnValueOnce(order)
      .mockReturnValueOnce(items);
    await expect(service.checkout(cartFixture.userId, key)).resolves.toEqual({
      ...orderFixture,
      items: [orderItemFixture],
    });
    expect(reads.cart.for).toHaveBeenCalledWith('update');
    expect(reads.products.for).toHaveBeenCalledWith('update');
    expect(reads.products.orderBy).toHaveBeenCalledTimes(1);
    expect(order.values).toHaveBeenCalledWith({
      userId: cartFixture.userId,
      checkoutKey: key,
      status: 'pending',
      totalAmount: '59.98',
    });
    expect(items.values).toHaveBeenCalledWith([
      {
        orderId: orderFixture.id,
        productId: productFixture.id,
        productName: productFixture.name,
        quantity: 2,
        unitPrice: '29.99',
      },
    ]);
    expect(mock.tx.update).toHaveBeenCalledTimes(2);
    expect(mock.tx.delete).toHaveBeenCalledTimes(1);
  });

  it('returns the previous order before inspecting a changed or empty cart', async () => {
    mock.tx.select
      .mockReturnValueOnce(storeQuery([cartFixture]))
      .mockReturnValueOnce(storeQuery([orderFixture]))
      .mockReturnValueOnce(storeQuery([orderItemFixture]));
    await expect(service.checkout(cartFixture.userId, key)).resolves.toEqual({
      ...orderFixture,
      items: [orderItemFixture],
    });
    expect(mock.tx.insert).toHaveBeenCalledTimes(1);
    expect(mock.tx.update).not.toHaveBeenCalled();
    expect(mock.tx.delete).not.toHaveBeenCalled();
  });

  it('rejects an empty cart without creating an order', async () => {
    mock.tx.select.mockReturnValueOnce(storeQuery([cartFixture]));
    await expect(service.checkout(cartFixture.userId, key)).rejects.toThrow(
      'Cart is empty',
    );
    expect(mock.tx.insert).toHaveBeenCalledTimes(1);
  });

  it('rolls back checkout when current stock is insufficient', async () => {
    checkoutReads(1);
    await expect(
      service.checkout(cartFixture.userId, key),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mock.tx.update).not.toHaveBeenCalled();
    expect(mock.tx.delete).not.toHaveBeenCalled();
    expect(mock.tx.insert).toHaveBeenCalledTimes(1);
  });

  it.each([0, 1000])(
    'rejects a stored invalid quantity %s',
    async (quantity) => {
      mock.tx.select
        .mockReturnValueOnce(storeQuery([cartFixture]))
        .mockReturnValueOnce(storeQuery([]))
        .mockReturnValueOnce(storeQuery([{ ...cartItemFixture, quantity }]))
        .mockReturnValueOnce(storeQuery([productFixture]));
      await expect(service.checkout(cartFixture.userId, key)).rejects.toThrow(
        'Cart quantity is outside',
      );
      expect(mock.tx.update).not.toHaveBeenCalled();
    },
  );

  it('rejects products deleted before locking', async () => {
    mock.tx.select
      .mockReturnValueOnce(storeQuery([cartFixture]))
      .mockReturnValueOnce(storeQuery([]))
      .mockReturnValueOnce(storeQuery([cartItemFixture]));
    await expect(service.checkout(cartFixture.userId, key)).rejects.toThrow(
      'no longer available',
    );
  });

  it('rejects total overflow before inserting an order', async () => {
    mock.tx.select
      .mockReturnValueOnce(storeQuery([cartFixture]))
      .mockReturnValueOnce(storeQuery([]))
      .mockReturnValueOnce(storeQuery([cartItemFixture]))
      .mockReturnValueOnce(
        storeQuery([{ ...productFixture, price: '99999999.99' }]),
      );
    await expect(service.checkout(cartFixture.userId, key)).rejects.toThrow(
      'Order amount exceeds',
    );
    expect(mock.tx.insert).toHaveBeenCalledTimes(1);
  });

  it('reads only owned orders with bounded stable pagination', async () => {
    const query = storeQuery([orderFixture]);
    mock.db.select.mockReturnValueOnce(query);
    await expect(
      service.findAll(cartFixture.userId, {
        page: 2,
        limit: 5,
        status: 'pending',
      }),
    ).resolves.toEqual([orderFixture]);
    expect(query.limit).toHaveBeenCalledWith(5);
    expect(query.offset).toHaveBeenCalledWith(5);
    const condition = query.where.mock.calls[0][0];
    if (!condition) throw new Error('Order ownership predicate missing');
    expect(new PgDialect().sqlToQuery(condition).params).toEqual([
      cartFixture.userId,
      'pending',
    ]);
  });

  it('returns owned order snapshots', async () => {
    const query = storeQuery([orderFixture]);
    mock.db.select
      .mockReturnValueOnce(query)
      .mockReturnValueOnce(storeQuery([orderItemFixture]));
    await expect(
      service.findOne(cartFixture.userId, orderFixture.id),
    ).resolves.toEqual({ ...orderFixture, items: [orderItemFixture] });
    const condition = query.where.mock.calls[0][0];
    if (!condition) throw new Error('Order ownership predicate missing');
    expect(new PgDialect().sqlToQuery(condition).params).toEqual([
      orderFixture.id,
      cartFixture.userId,
    ]);
  });

  it.each(['read', 'cancel'])(
    'hides missing and foreign orders on %s',
    async (operation) => {
      await expect(
        operation === 'read'
          ? service.findOne('other', orderFixture.id)
          : service.cancel('other', orderFixture.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('cancels pending orders and restores extant product stock', async () => {
    const order = storeQuery([orderFixture]);
    const products = storeQuery([productFixture]);
    const cancelled = storeQuery([{ ...orderFixture, status: 'cancelled' }]);
    mock.tx.select
      .mockReturnValueOnce(order)
      .mockReturnValueOnce(storeQuery([orderItemFixture]))
      .mockReturnValueOnce(products);
    mock.tx.update
      .mockReturnValueOnce(storeQuery([]))
      .mockReturnValueOnce(cancelled);
    await expect(
      service.cancel(cartFixture.userId, orderFixture.id),
    ).resolves.toMatchObject({
      status: 'cancelled',
      items: [orderItemFixture],
    });
    expect(order.for).toHaveBeenCalledWith('update');
    expect(products.for).toHaveBeenCalledWith('update');
    const condition = cancelled.where.mock.calls[0][0];
    if (!condition) throw new Error('Order cancellation predicate missing');
    expect(new PgDialect().sqlToQuery(condition).params).toEqual([
      orderFixture.id,
      cartFixture.userId,
      'pending',
    ]);
  });

  it('does not restore stock twice when cancellation is retried', async () => {
    mock.tx.select
      .mockReturnValueOnce(
        storeQuery([{ ...orderFixture, status: 'cancelled' }]),
      )
      .mockReturnValueOnce(storeQuery([orderItemFixture]));
    await expect(
      service.cancel(cartFixture.userId, orderFixture.id),
    ).resolves.toMatchObject({ status: 'cancelled' });
    expect(mock.tx.update).not.toHaveBeenCalled();
  });

  it('preserves deleted-product snapshots during cancellation', async () => {
    const deletedSnapshot = { ...orderItemFixture, productId: null };
    mock.tx.select
      .mockReturnValueOnce(storeQuery([orderFixture]))
      .mockReturnValueOnce(storeQuery([deletedSnapshot]));
    mock.tx.update.mockReturnValueOnce(
      storeQuery([{ ...orderFixture, status: 'cancelled' }]),
    );
    await expect(
      service.cancel(cartFixture.userId, orderFixture.id),
    ).resolves.toMatchObject({ items: [deletedSnapshot] });
    expect(mock.tx.select).toHaveBeenCalledTimes(2);
    expect(mock.tx.update).toHaveBeenCalledTimes(1);
  });

  it('does not cancel non-pending legacy orders', async () => {
    mock.tx.select.mockReturnValueOnce(
      storeQuery([{ ...orderFixture, status: 'paid' }]),
    );
    await expect(
      service.cancel(cartFixture.userId, orderFixture.id),
    ).rejects.toThrow('Only pending orders');
    expect(mock.tx.update).not.toHaveBeenCalled();
  });

  it('returns a conflict before restoring stock beyond the PostgreSQL integer limit', async () => {
    mock.tx.select
      .mockReturnValueOnce(storeQuery([orderFixture]))
      .mockReturnValueOnce(storeQuery([orderItemFixture]))
      .mockReturnValueOnce(
        storeQuery([{ ...productFixture, stockQuantity: 2_147_483_646 }]),
      );
    await expect(
      service.cancel(cartFixture.userId, orderFixture.id),
    ).rejects.toThrow('Restored stock exceeds the permitted range');
    expect(mock.tx.update).not.toHaveBeenCalled();
  });

  it('propagates database failures so the transaction rolls back', async () => {
    checkoutReads();
    const failure = new Error('Database write failed');
    const order = storeQuery([orderFixture]);
    order.returning.mockRejectedValue(failure);
    mock.tx.insert
      .mockReturnValueOnce(storeQuery([]))
      .mockReturnValueOnce(order);
    await expect(service.checkout(cartFixture.userId, key)).rejects.toBe(
      failure,
    );
    expect(mock.tx.update).not.toHaveBeenCalled();
  });
});
