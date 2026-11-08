import { Test } from '@nestjs/testing';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SellerGuard } from './seller.guard';
import { SellersService } from './sellers.service';
import type { SellerRequest } from './seller-request';
import { requestSellerId } from './seller-request';
import { sellerFixture, sessionFixture } from '../../test/marketplace.fixtures';

describe('SellerGuard', () => {
  let guard: SellerGuard;
  const requireSeller = jest.fn();

  beforeEach(async () => {
    requireSeller.mockReset().mockResolvedValue(sellerFixture);
    const module = await Test.createTestingModule({
      providers: [
        SellerGuard,
        { provide: SellersService, useValue: { requireSeller } },
      ],
    }).compile();
    guard = module.get(SellerGuard);
  });

  it('attaches the database seller for the session user', async () => {
    const request: Pick<SellerRequest, 'authSession' | 'sellerProfile'> = {
      authSession: sessionFixture,
    };
    await expect(
      guard.canActivate(new ExecutionContextHost([request])),
    ).resolves.toBe(true);
    expect(requireSeller).toHaveBeenCalledWith(sessionFixture.user.id);
    expect(request.sellerProfile).toBe(sellerFixture);
  });

  it('rejects missing sessions before querying sellers', async () => {
    await expect(
      guard.canActivate(new ExecutionContextHost([{}])),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(requireSeller).not.toHaveBeenCalled();
  });

  it.each([
    new ForbiddenException('A seller profile is required'),
    new Error('Database unavailable'),
  ])(
    'propagates lookup failure without attaching ownership',
    async (failure) => {
      requireSeller.mockRejectedValue(failure);
      const request: Pick<SellerRequest, 'authSession' | 'sellerProfile'> = {
        authSession: sessionFixture,
      };
      await expect(
        guard.canActivate(new ExecutionContextHost([request])),
      ).rejects.toBe(failure);
      expect(request.sellerProfile).toBeUndefined();
    },
  );

  it('requires the guard-populated seller identity', () => {
    expect(() => requestSellerId({})).toThrow(ForbiddenException);
  });
});
