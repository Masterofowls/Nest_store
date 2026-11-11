import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq, isNull, or, sql } from 'drizzle-orm';
import { isPostgresConstraint } from '../common/postgres-constraint';
import { DatabaseService } from '../db/database/database.service';
import { attributes, categories } from '../db/schema';
import type {
  AttributeQuery,
  CreateAttributeInput,
  UpdateAttributeInput,
} from './attribute.schema';

export const MAX_LISTED_ATTRIBUTES = 500;

@Injectable()
export class AttributesService {
  constructor(private readonly database: DatabaseService) {}

  // With a category: attributes offered for it, its parent, or everywhere.
  findAll(query: AttributeQuery) {
    return this.database.db
      .select()
      .from(attributes)
      .where(
        query.categoryId
          ? or(
              isNull(attributes.categoryId),
              eq(attributes.categoryId, query.categoryId),
              sql`${attributes.categoryId} = (select ${categories.parentId} from ${categories} where ${categories.id} = ${query.categoryId})`,
            )
          : undefined,
      )
      .orderBy(asc(attributes.sortOrder), asc(attributes.name))
      .limit(MAX_LISTED_ATTRIBUTES);
  }

  async create(input: CreateAttributeInput) {
    try {
      const [attribute] = await this.database.db
        .insert(attributes)
        .values({
          name: input.name,
          slug: input.slug,
          type: input.type,
          unit: input.unit ?? null,
          categoryId: input.categoryId ?? null,
          sortOrder: input.sortOrder ?? 0,
        })
        .returning();
      if (!attribute) {
        throw new Error('Attribute insert did not return an attribute');
      }
      return attribute;
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async update(id: string, input: UpdateAttributeInput) {
    try {
      const [attribute] = await this.database.db
        .update(attributes)
        .set({
          name: input.name,
          unit: input.unit,
          categoryId: input.categoryId,
          sortOrder: input.sortOrder,
        })
        .where(eq(attributes.id, id))
        .returning();
      if (!attribute) {
        throw new NotFoundException('Attribute not found');
      }
      return attribute;
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.database.db
      .delete(attributes)
      .where(eq(attributes.id, id))
      .returning({ id: attributes.id });
    if (deleted.length === 0) {
      throw new NotFoundException('Attribute not found');
    }
  }

  private rethrowDatabaseError(error: unknown): never {
    if (isPostgresConstraint(error, '23505', 'attributes_slug_unique')) {
      throw new ConflictException('An attribute with this slug already exists');
    }
    if (
      isPostgresConstraint(
        error,
        '23503',
        'attributes_category_id_categories_id_fk',
      )
    ) {
      throw new BadRequestException('Category not found');
    }
    throw error;
  }
}
