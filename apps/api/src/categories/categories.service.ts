import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/database/database.service';
import { categories } from '../db/schema';
import type { PaginationQuery } from '../common/pagination.schema';
import { isPostgresConstraint } from '../common/postgres-constraint';
import type { CategoryInput } from './category.schema';

@Injectable()
export class CategoriesService {
  constructor(private readonly database: DatabaseService) {}

  findAll(query: PaginationQuery) {
    const search = query.search?.toLowerCase();
    return this.database.db
      .select()
      .from(categories)
      .where(
        search
          ? sql`strpos(lower(${categories.name}), ${search}) > 0`
          : undefined,
      )
      .orderBy(asc(categories.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
  }

  async findOne(id: string) {
    const [category] = await this.database.db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(input: CategoryInput) {
    try {
      const [category] = await this.database.db
        .insert(categories)
        .values({ name: input.name })
        .returning();
      if (!category) {
        throw new Error('Category insert did not return a category');
      }
      return category;
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async update(id: string, input: CategoryInput) {
    try {
      const [category] = await this.database.db
        .update(categories)
        .set({ name: input.name })
        .where(eq(categories.id, id))
        .returning();
      if (!category) {
        throw new NotFoundException('Category not found');
      }
      return category;
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const deleted = await this.database.db
        .delete(categories)
        .where(eq(categories.id, id))
        .returning({ id: categories.id });
      if (deleted.length === 0) {
        throw new NotFoundException('Category not found');
      }
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  private rethrowDatabaseError(error: unknown): never {
    if (isPostgresConstraint(error, '23505', 'categories_name_unique')) {
      throw new ConflictException('Category name is already taken');
    }
    if (
      isPostgresConstraint(
        error,
        '23503',
        'products_category_id_categories_id_fk',
      )
    ) {
      throw new ConflictException('Category is still used by products');
    }
    throw error;
  }
}
