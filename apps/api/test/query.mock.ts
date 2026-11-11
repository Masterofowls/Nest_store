import type { SQL } from 'drizzle-orm';

export function queryMock<T>(rows: T[]) {
  const query = Object.assign(Promise.resolve(rows), {
    from: jest.fn(),
    where: jest.fn<unknown, [SQL | undefined]>(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    values: jest.fn(),
    set: jest.fn<unknown, [unknown]>(),
    returning: jest.fn(),
    leftJoin: jest.fn(),
    innerJoin: jest.fn(),
    groupBy: jest.fn(),
    as: jest.fn(),
  });
  query.leftJoin.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);
  query.groupBy.mockReturnValue(query);
  query.as.mockReturnValue(query);
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.offset.mockReturnValue(query);
  query.values.mockReturnValue(query);
  query.set.mockReturnValue(query);
  query.returning.mockReturnValue(query);
  return query;
}
