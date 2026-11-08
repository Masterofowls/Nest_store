import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import type { SessionRequest } from '../auth/session-request';
import {
  sessionFixture,
  productFixture,
} from '../../test/marketplace.fixtures';

describe('CartController', () => {
  const session = { authSession: sessionFixture } as SessionRequest;
  const service = {
    find: jest.fn(),
    add: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const controller = new CartController(service as unknown as CartService);

  beforeEach(() => jest.clearAllMocks());

  it('requires a session on every route and a trusted origin for writes', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CartController)).toEqual([
      SessionGuard,
    ]);
    for (const name of ['add', 'update', 'delete']) {
      const descriptor = Object.getOwnPropertyDescriptor(
        CartController.prototype,
        name,
      );
      if (!descriptor) throw new Error('Cart route method missing');
      expect(
        Reflect.getMetadata(GUARDS_METADATA, descriptor.value as object),
      ).toEqual([WriteOriginGuard]);
    }
  });

  it('passes the authenticated user and validated pagination to cart reads', async () => {
    await controller.find(session, { page: 1, limit: 10 });
    expect(service.find).toHaveBeenCalledWith(sessionFixture.user.id, {
      page: 1,
      limit: 10,
    });
  });

  it('maps an add without accepting ownership from the body', async () => {
    const input = { productId: productFixture.id, quantity: 2 };
    await controller.add(session, input);
    expect(service.add).toHaveBeenCalledWith(sessionFixture.user.id, input);
  });

  it('maps quantity replacement to the owned item', async () => {
    await controller.update(session, productFixture.id, { quantity: 3 });
    expect(service.update).toHaveBeenCalledWith(
      sessionFixture.user.id,
      productFixture.id,
      { quantity: 3 },
    );
  });

  it('maps item deletion to the authenticated user', async () => {
    await controller.delete(session, productFixture.id);
    expect(service.delete).toHaveBeenCalledWith(
      sessionFixture.user.id,
      productFixture.id,
    );
  });
});
