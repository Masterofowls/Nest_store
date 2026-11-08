import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SellersService } from './sellers.service';
import { DatabaseService } from '../db/database/database.service';
import { queryMock } from '../../test/query.mock';
import { sellerFixture } from '../../test/marketplace.fixtures';
import type { SellerProfile } from '../db/schema';

describe('SellersService database operations', () => {
  let service: SellersService;
  let query: ReturnType<typeof queryMock<SellerProfile>>;

  beforeEach(async () => {
    query = queryMock([sellerFixture]);
    const module = await Test.createTestingModule({
      providers: [
        SellersService,
        {
          provide: DatabaseService,
          useValue: {
            db: {
              select: () => query,
              insert: () => query,
              update: () => query,
              delete: () => query,
            },
          },
        },
      ],
    }).compile();
    service = module.get(SellersService);
  });

  it('bounds and orders the public list', async () => {
    await service.findAll({ page: 2, limit: 2, search: 'STORE' });
    expect(query.limit).toHaveBeenCalledWith(2);
    expect(query.offset).toHaveBeenCalledWith(2);
    expect(query.orderBy).toHaveBeenCalledTimes(1);
  });

  it('finds the authenticated user seller profile', async () => {
    await expect(service.requireSeller(sellerFixture.userId)).resolves.toEqual(
      sellerFixture,
    );
  });

  it('returns existing public and own profiles', async () => {
    await expect(service.findOne(sellerFixture.id)).resolves.toEqual(
      sellerFixture,
    );
    await expect(service.findOwn(sellerFixture.userId)).resolves.toEqual(
      sellerFixture,
    );
  });

  it('fails explicitly when an insert returns no row', async () => {
    query.returning.mockResolvedValue([]);
    await expect(
      service.create('buyer', { storeName: 'Store' }),
    ).rejects.toThrow('Seller insert did not return a profile');
  });

  it('returns 403 when a seller profile is required but missing', async () => {
    query.where.mockReturnValue(Promise.resolve([]));
    await expect(service.requireSeller('buyer')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it.each(['public', 'own', 'update', 'delete'])(
    'returns 404 for missing %s profile',
    async (operation) => {
      query.where.mockReturnValue(query);
      query.returning.mockResolvedValue([]);
      if (operation === 'public' || operation === 'own') {
        query.where.mockReturnValue(Promise.resolve([]));
      }
      const result =
        operation === 'public'
          ? service.findOne(sellerFixture.id)
          : operation === 'own'
            ? service.findOwn(sellerFixture.userId)
            : operation === 'update'
              ? service.updateOwn(sellerFixture.userId, { description: null })
              : service.deleteOwn(sellerFixture.userId);
      await expect(result).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('uses server-derived user ownership on creation', async () => {
    await service.create(sellerFixture.userId, { storeName: 'Store' });
    expect(query.values).toHaveBeenCalledWith({
      userId: sellerFixture.userId,
      storeName: 'Store',
      description: undefined,
    });
  });

  it('updates only allowed fields and refreshes the timestamp', async () => {
    await service.updateOwn(sellerFixture.userId, { description: null });
    const input: unknown = query.set.mock.calls[0][0];
    expect(input).toMatchObject({
      storeName: undefined,
      description: null,
    });
    expect(input).toHaveProperty('updatedAt', expect.any(Date));
  });

  it.each([
    'seller_profiles_user_id_unique',
    'seller_profiles_store_name_unique',
  ])('maps %s on create and update', async (constraint) => {
    query.returning.mockRejectedValue({
      cause: { code: '23505', constraint_name: constraint },
    });
    await expect(
      service.create('buyer', { storeName: 'Store' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.updateOwn('buyer', { storeName: 'Store' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('propagates unexpected failures', async () => {
    const error = new Error('Database unavailable');
    query.returning.mockRejectedValue(error);
    await expect(service.create('buyer', { storeName: 'Store' })).rejects.toBe(
      error,
    );
  });
});
