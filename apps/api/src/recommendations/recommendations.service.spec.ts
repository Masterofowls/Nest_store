import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { queryMock } from '../../test/query.mock';
import { DatabaseService } from '../db/database/database.service';
import { RecommendationsService } from './recommendations.service';

const productId = '00000000-0000-4000-8000-000000000001';

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let query: ReturnType<typeof queryMock<{ id: string }>> & {
    innerJoin: jest.Mock;
    groupBy: jest.Mock;
  };
  let select: jest.Mock<unknown, [Record<string, unknown>?]>;

  beforeEach(async () => {
    query = Object.assign(queryMock([{ id: productId }]), {
      innerJoin: jest.fn(),
      groupBy: jest.fn(),
    });
    query.innerJoin.mockReturnValue(query);
    query.groupBy.mockReturnValue(query);
    select = jest
      .fn<unknown, [Record<string, unknown>?]>()
      .mockReturnValue(query);
    const module = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: DatabaseService, useValue: { db: { select } } },
      ],
    }).compile();
    service = module.get(RecommendationsService);
  });

  it('counts distinct users and deterministically bounds related product results', async () => {
    await service.findForProduct(productId, { page: 2, limit: 3 });
    expect(query.innerJoin).toHaveBeenCalledTimes(2);
    expect(query.offset).toHaveBeenCalledWith(3);
    expect(query.limit).toHaveBeenCalledWith(3);
    const selection = select.mock.calls[1][0];
    if (!selection || !(selection.coViewers instanceof SQL)) {
      throw new Error('Missing recommendation count selection');
    }
    const count = new PgDialect().sqlToQuery(selection.coViewers);
    expect(count.sql).toContain('count(distinct "target_views"."user_id")');
    expect(selection).not.toHaveProperty('userId');
    const exclusion = query.where.mock.calls[1][0];
    if (!exclusion) throw new Error('Missing target product exclusion');
    expect(new PgDialect().sqlToQuery(exclusion).sql).toContain('<>');
    expect(new PgDialect().sqlToQuery(exclusion).params).toEqual([productId]);
    expect(query.orderBy.mock.calls[0]).toHaveLength(2);
  });

  it('returns not found for an absent target rather than fabricating products', async () => {
    query.where.mockReturnValue(Promise.resolve([]));
    await expect(
      service.findForProduct(productId, { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(query.innerJoin).not.toHaveBeenCalled();
  });
});
