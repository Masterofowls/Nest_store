import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import sharp from 'sharp';
import { ImagesService } from './images.service';
import { ImageCleanupService } from './image-cleanup.service';
import { StorageService } from './storage.service';
import { DatabaseService } from '../db/database/database.service';
import { productFixture, sellerFixture } from '../../test/marketplace.fixtures';
import { queryMock } from '../../test/query.mock';

function imageQuery<T>(rows: T[]) {
  const query = Object.assign(queryMock(rows), {
    for: jest.fn<Promise<T[]>, [string]>(),
    onConflictDoNothing: jest.fn(),
  });
  query.for.mockReturnValue(query);
  query.onConflictDoNothing.mockReturnValue(query);
  return query;
}

describe('ImagesService', () => {
  let service: ImagesService;
  const image = {
    id: '00000000-0000-4000-8000-000000000004',
    productId: productFixture.id,
    url: 'https://storage.example.test/photo.webp',
    createdAt: new Date(),
  };
  let product: ReturnType<typeof imageQuery<typeof productFixture>>;
  let totals: ReturnType<typeof imageQuery<{ total: number }>>;
  let images: ReturnType<typeof imageQuery<typeof image>>;
  let write: ReturnType<typeof imageQuery<never>>;
  let bytes: Buffer;
  const cleanup = { flush: jest.fn() };
  const storage = {
    bucket: 'product-images',
    publicUrl: jest.fn(),
    upload: jest.fn(),
  };
  const tx = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const db = {
    ...tx,
    transaction: jest.fn((run: (transaction: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    product = imageQuery([productFixture]);
    totals = imageQuery([{ total: 0 }]);
    images = imageQuery([image]);
    write = imageQuery<never>([]);
    bytes = await sharp({
      create: { width: 1, height: 1, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    cleanup.flush.mockResolvedValue({ removed: 0 });
    storage.publicUrl.mockReturnValue(image.url);
    storage.upload.mockResolvedValue(undefined);
    tx.select.mockReset().mockReturnValueOnce(product).mockReturnValue(totals);
    tx.insert.mockReturnValue(write);
    tx.update.mockReturnValue(images);
    tx.delete.mockReturnValue(images);
    db.select = tx.select;
    db.insert = tx.insert;
    db.delete = tx.delete;
    const module = await Test.createTestingModule({
      providers: [
        ImagesService,
        { provide: DatabaseService, useValue: { db } },
        { provide: ImageCleanupService, useValue: cleanup },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = module.get(ImagesService);
  });

  it('only publishes finalized images after the remote upload', async () => {
    await expect(
      service.upload(productFixture.id, sellerFixture.id, bytes),
    ).resolves.toEqual(image);
    expect(product.for).toHaveBeenCalledWith('update');
    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(/\.webp$/),
      expect.any(Buffer),
    );
    expect(images.set).toHaveBeenCalledWith({ status: 'ready' });
    expect(write.values).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: storage.bucket,
      }),
    );
    expect(db.transaction).toHaveBeenCalledTimes(2);
  });

  it.each(['missing', 'foreign', 'full'])(
    'rejects a %s product before remote upload',
    async (reason) => {
      if (reason === 'missing') product.for.mockResolvedValue([]);
      if (reason === 'foreign')
        product.for.mockResolvedValue([
          { ...productFixture, sellerId: 'other' },
        ]);
      if (reason === 'full')
        totals.where.mockReturnValue(Promise.resolve([{ total: 8 }]));
      await expect(
        service.upload(productFixture.id, sellerFixture.id, bytes),
      ).rejects.toBeInstanceOf(
        reason === 'missing'
          ? NotFoundException
          : reason === 'foreign'
            ? ForbiddenException
            : ConflictException,
      );
      expect(storage.upload).not.toHaveBeenCalled();
    },
  );

  it('persists cleanup again if a product is deleted during upload', async () => {
    images.returning.mockResolvedValue([]);
    await expect(
      service.upload(productFixture.id, sellerFixture.id, bytes),
    ).rejects.toThrow('deleted during upload');
    expect(db.insert).toHaveBeenCalled();
    expect(cleanup.flush).toHaveBeenCalledTimes(2);
  });

  it('propagates remote failures after retaining a cleanup entry', async () => {
    const failure = new Error('Storage unavailable');
    storage.upload.mockRejectedValueOnce(failure);
    await expect(
      service.upload(productFixture.id, sellerFixture.id, bytes),
    ).rejects.toBe(failure);
    expect(db.delete).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalled();
  });

  it('bounds and orders public reads', async () => {
    tx.select.mockReset().mockReturnValueOnce(product).mockReturnValue(images);
    await expect(service.list(productFixture.id)).resolves.toEqual([image]);
    expect(images.limit).toHaveBeenCalledWith(8);
    expect(images.orderBy).toHaveBeenCalled();
  });

  it('returns 404 for an unknown public product', async () => {
    product.where.mockReturnValue(Promise.resolve([]));
    await expect(service.list(productFixture.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('removes owned metadata before flushing the durable queue', async () => {
    await expect(
      service.delete(productFixture.id, image.id, sellerFixture.id),
    ).resolves.toBeUndefined();
    expect(product.for).toHaveBeenCalledWith('update');
    expect(cleanup.flush).toHaveBeenCalledTimes(1);
  });

  it.each(['missing', 'foreign', 'image'])(
    'rejects deletion for %s resources',
    async (reason) => {
      if (reason === 'missing') product.for.mockResolvedValue([]);
      if (reason === 'foreign')
        product.for.mockResolvedValue([
          { ...productFixture, sellerId: 'other' },
        ]);
      if (reason === 'image') images.returning.mockResolvedValue([]);
      await expect(
        service.delete(productFixture.id, image.id, sellerFixture.id),
      ).rejects.toBeInstanceOf(
        reason === 'foreign' ? ForbiddenException : NotFoundException,
      );
      expect(cleanup.flush).not.toHaveBeenCalled();
    },
  );
});
