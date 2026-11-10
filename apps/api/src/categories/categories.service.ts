import {
  BadRequestException,
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
    await this.assertValidParent(input.parentId);
    try {
      const [category] = await this.database.db
        .insert(categories)
        .values({ name: input.name, parentId: input.parentId })
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
    if (input.parentId) {
      if (input.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      await this.assertValidParent(input.parentId);
      const [child] = await this.database.db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.parentId, id))
        .limit(1);
      if (child) {
        throw new ConflictException(
          'A category with subcategories cannot be moved under another category',
        );
      }
    }
    try {
      const [category] = await this.database.db
        .update(categories)
        .set({ name: input.name, parentId: input.parentId })
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

  // Categories are two levels deep: a parent must itself be top-level.
  private async assertValidParent(parentId: string | null | undefined) {
    if (!parentId) return;
    const [parent] = await this.database.db
      .select({ parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.id, parentId));
    if (!parent) {
      throw new BadRequestException('Parent category not found');
    }
    if (parent.parentId !== null) {
      throw new BadRequestException(
        'Parent category must be a top-level category',
      );
    }
  }

  private rethrowDatabaseError(error: unknown): never {
    if (isPostgresConstraint(error, '23505', 'categories_name_unique')) {
      throw new ConflictException('Category name is already taken');
    }
    // ON DELETE RESTRICT reports 23001; a parent removed mid-insert reports 23503.
    if (
      isPostgresConstraint(
        error,
        '23001',
        'categories_parent_id_categories_id_fk',
      )
    ) {
      throw new ConflictException('Category still has subcategories');
    }
    if (
      isPostgresConstraint(
        error,
        '23503',
        'categories_parent_id_categories_id_fk',
      )
    ) {
      throw new BadRequestException('Parent category not found');
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
