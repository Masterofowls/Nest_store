import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import { CategoriesService } from './categories.service';
import { DatabaseService } from '../db/database/database.service';
import { categories } from '../db/schema';
import type { Category } from '../db/schema';
import { queryMock } from '../../test/query.mock';

const category: Category = {
  id: '00000000-0000-4000-8000-000000000003',
  name: 'Keyboards',
  parentId: null,
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  let query: ReturnType<typeof queryMock<Category>>;

  beforeEach(async () => {
    query = queryMock([category]);
    const module = await Test.createTestingModule({
      providers: [
        CategoriesService,
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
    service = module.get(CategoriesService);
  });

  it('bounds and orders public reads', async () => {
    await expect(
      service.findAll({ page: 2, limit: 3, search: 'KEY' }),
    ).resolves.toEqual([category]);
    expect(query.limit).toHaveBeenCalledWith(3);
    expect(query.offset).toHaveBeenCalledWith(3);
    expect(query.orderBy).toHaveBeenCalledTimes(1);
  });

  it('reads a category by ID', async () => {
    await expect(service.findOne(category.id)).resolves.toEqual(category);
  });

  it('creates only the allowed name field', async () => {
    await expect(service.create({ name: category.name })).resolves.toEqual(
      category,
    );
    expect(query.values).toHaveBeenCalledWith({ name: category.name });
  });

  it('updates only the requested category', async () => {
    await expect(
      service.update(category.id, { name: 'Updated' }),
    ).resolves.toEqual(category);
    expect(query.set).toHaveBeenCalledWith({ name: 'Updated' });
    const condition = query.where.mock.calls[0][0];
    if (!condition) throw new Error('Category update predicate is missing');
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(condition)).toEqual(
      dialect.sqlToQuery(eq(categories.id, category.id)),
    );
  });

  it('deletes an existing category', async () => {
    await expect(service.delete(category.id)).resolves.toBeUndefined();
  });

  it.each(['read', 'update', 'delete'])(
    'returns 404 for missing category on %s',
    async (operation) => {
      if (operation === 'read')
        query.where.mockReturnValue(Promise.resolve([]));
      else query.returning.mockResolvedValue([]);
      const result =
        operation === 'read'
          ? service.findOne(category.id)
          : operation === 'update'
            ? service.update(category.id, { name: 'Updated' })
            : service.delete(category.id);
      await expect(result).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it.each(['create', 'update'])(
    'returns 409 for a name conflict on %s',
    async (operation) => {
      query.returning.mockRejectedValue({
        cause: { code: '23505', constraint_name: 'categories_name_unique' },
      });
      const result =
        operation === 'create'
          ? service.create({ name: category.name })
          : service.update(category.id, { name: category.name });
      await expect(result).rejects.toBeInstanceOf(ConflictException);
    },
  );

  it('returns 409 when products still reference a deleted category', async () => {
    query.returning.mockRejectedValue({
      cause: {
        code: '23503',
        constraint_name: 'products_category_id_categories_id_fk',
      },
    });
    await expect(service.delete(category.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it.each(['create', 'update', 'delete'])(
    'propagates unexpected %s failures',
    async (operation) => {
      const failure = new Error('Database unavailable');
      query.returning.mockRejectedValue(failure);
      const result =
        operation === 'create'
          ? service.create({ name: category.name })
          : operation === 'update'
            ? service.update(category.id, { name: category.name })
            : service.delete(category.id);
      await expect(result).rejects.toBe(failure);
    },
  );

  it('fails explicitly if insertion returns no row', async () => {
    query.returning.mockResolvedValue([]);
    await expect(service.create({ name: category.name })).rejects.toThrow(
      'Category insert did not return a category',
    );
  });
});
