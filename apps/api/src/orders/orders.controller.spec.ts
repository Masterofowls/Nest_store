import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Response } from 'express';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import type { SessionRequest } from '../auth/session-request';
import { sessionFixture } from '../../test/marketplace.fixtures';
import { orderFixture } from '../cart/store.fixture';

describe('OrdersController', () => {
  const session = { authSession: sessionFixture } as SessionRequest;
  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    checkout: jest.fn(),
    cancel: jest.fn(),
  };
  const controller = new OrdersController(service as unknown as OrdersService);

  beforeEach(() => jest.clearAllMocks());

  it('requires a session on every route and a trusted origin for writes', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, OrdersController)).toEqual([
      SessionGuard,
    ]);
    for (const name of ['checkout', 'cancel']) {
      const descriptor = Object.getOwnPropertyDescriptor(
        OrdersController.prototype,
        name,
      );
      if (!descriptor) throw new Error('Order route method missing');
      expect(
        Reflect.getMetadata(GUARDS_METADATA, descriptor.value as object),
      ).toEqual([WriteOriginGuard]);
    }
  });

  it('maps a paginated list to its owner', async () => {
    const query = { page: 1, limit: 10 };
    await controller.findAll(session, query);
    expect(service.findAll).toHaveBeenCalledWith(sessionFixture.user.id, query);
  });

  it('maps order detail reads to the authenticated user', async () => {
    await controller.findOne(session, orderFixture.id);
    expect(service.findOne).toHaveBeenCalledWith(
      sessionFixture.user.id,
      orderFixture.id,
    );
  });

  it('sets Location after a checkout from the authenticated cart', async () => {
    const location = jest.fn();
    service.checkout.mockResolvedValue(orderFixture);
    const key = '00000000-0000-4000-8000-000000000014';
    const result = await controller.checkout(session, key, {}, {
      location,
    } as unknown as Response);
    expect(result).toEqual(orderFixture);
    expect(service.checkout).toHaveBeenCalledWith(sessionFixture.user.id, key);
    expect(location).toHaveBeenCalledWith(`/orders/${orderFixture.id}`);
  });

  it('maps only cancellation to the owned order', async () => {
    await controller.cancel(session, orderFixture.id, { status: 'cancelled' });
    expect(service.cancel).toHaveBeenCalledWith(
      sessionFixture.user.id,
      orderFixture.id,
      'cancelled',
    );
  });
});
