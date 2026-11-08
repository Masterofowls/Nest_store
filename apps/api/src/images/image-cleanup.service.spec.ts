import { Test } from '@nestjs/testing';
import { ImageCleanupService } from './image-cleanup.service';
import { StorageService } from './storage.service';
import { DatabaseService } from '../db/database/database.service';
import { queryMock } from '../../test/query.mock';
import { PgDialect } from 'drizzle-orm/pg-core';

describe('Durable product image cleanup', () => {
  let service: ImageCleanupService;
  const entry = {
    bucket: 'product-images',
    path: 'product/image.webp',
    createdAt: new Date(),
    notBefore: new Date(),
  };
  let pending: ReturnType<typeof queryMock<typeof entry>>;
  const remove = jest.fn();
  const deleteRows = jest.fn();
  beforeEach(async () => {
    jest.clearAllMocks();
    pending = queryMock([entry]);
    remove.mockResolvedValue(undefined);
    deleteRows.mockReturnValue(queryMock([]));
    const module = await Test.createTestingModule({
      providers: [
        ImageCleanupService,
        { provide: StorageService, useValue: { remove } },
        {
          provide: DatabaseService,
          useValue: { db: { select: () => pending, delete: deleteRows } },
        },
      ],
    }).compile();
    service = module.get(ImageCleanupService);
  });
  it('bounds work and excludes active uploads and referenced images', async () => {
    await expect(service.flush()).resolves.toEqual({ removed: 1 });
    expect(remove).toHaveBeenCalledWith(entry.bucket, entry.path);
    expect(pending.limit).toHaveBeenCalledWith(100);
    const condition = pending.where.mock.calls[0][0];
    if (!condition) throw new Error('Cleanup predicate missing');
    const sql = new PgDialect().sqlToQuery(condition).sql;
    expect(sql).toContain('<= now()');
    expect(sql).toContain('not exists');
    expect(deleteRows).toHaveBeenCalledTimes(2);
  });
  it('leaves a failed object queued and propagates the failure', async () => {
    const failure = new Error('Storage unavailable');
    remove.mockRejectedValueOnce(failure);
    await expect(service.flush()).rejects.toBe(failure);
    expect(deleteRows).toHaveBeenCalledTimes(1);
  });
  it('reports no work when the queue is empty', async () => {
    pending.limit.mockResolvedValue([]);
    await expect(service.flush()).resolves.toEqual({ removed: 0 });
    expect(remove).not.toHaveBeenCalled();
  });
});
