import { queryMock } from '../../test/query.mock';

export function storeQuery<T>(rows: T[]) {
  const query = Object.assign(queryMock(rows), {
    for: jest.fn(),
    innerJoin: jest.fn(),
    onConflictDoNothing: jest.fn(),
  });
  query.for.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);
  query.onConflictDoNothing.mockReturnValue(query);
  return query;
}

export function storeDatabaseMock() {
  const empty = storeQuery([]);
  const tx = {
    select: jest.fn().mockReturnValue(empty),
    insert: jest.fn().mockReturnValue(empty),
    update: jest.fn().mockReturnValue(empty),
    delete: jest.fn().mockReturnValue(empty),
  };
  const db = {
    ...tx,
    transaction: jest.fn(
      async (work: (connection: typeof tx) => Promise<unknown>) => work(tx),
    ),
  };
  return { db, tx };
}
