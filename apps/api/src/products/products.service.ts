import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/database/database.service';
import { products } from '../db/schema';
import { isPostgresConstraint } from '../common/postgres-constraint';
import type {
  CreateProductInput,
  ProductQuery,
  UpdateProductInput,
} from './product.schema';

@Injectable()
export class ProductsService {
  constructor(private readonly database: DatabaseService) {}

  findAll(query: ProductQuery) {
    const search = query.search?.toLowerCase();
    return this.database.db
      .select()
      .from(products)
      .where(
        and(
          search
            ? or(
                sql`strpos(lower(${products.name}), ${search}) > 0`,
                sql`cast(${products.id} as text) = ${search}`,
              )
            : undefined,
          query.categoryId
            ? eq(products.categoryId, query.categoryId)
            : undefined,
          query.sellerId ? eq(products.sellerId, query.sellerId) : undefined,
        ),
      )
      .orderBy(asc(products.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
  }

  async findOne(id: string) {
    const [product] = await this.database.db
      .select()
      .from(products)
      .where(eq(products.id, id));
    return product;
  }

  async postProduct(input: CreateProductInput, sellerId: string) {
    try {
      const [product] = await this.database.db
        .insert(products)
        .values({
          sellerId,
          name: input.name,
          categoryId: input.categoryId,
          stockQuantity: input.stockQuantity,
          price: input.price,
          description: input.description,
          discountPercent: input.discountPercent,
        })
        .returning();
      if (!product) {
        throw new Error('Product insert did not return a product');
      }
      return product;
    } catch (error) {
      this.rethrowReferenceError(error);
    }
  }

  async patchProduct(input: UpdateProductInput, id: string, sellerId: string) {
    try {
      const [product] = await this.database.db
        .update(products)
        .set({
          name: input.name,
          categoryId: input.categoryId,
          stockQuantity: input.stockQuantity,
          price: input.price,
          description: input.description,
          discountPercent: input.discountPercent,
        })
        .where(and(eq(products.id, id), eq(products.sellerId, sellerId)))
        .returning();
      if (!product) {
        await this.getOrThrow(id);
        throw new ForbiddenException('Product belongs to another seller');
      }
      return product;
    } catch (error) {
      this.rethrowReferenceError(error);
    }
  }

  async deleteProduct(id: string, sellerId: string): Promise<void> {
    const deleted = await this.database.db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.sellerId, sellerId)))
      .returning({ id: products.id });
    if (deleted.length === 0) {
      await this.getOrThrow(id);
      throw new ForbiddenException('Product belongs to another seller');
    }
  }

  async getOrThrow(id: string) {
    const result = await this.findOne(id);
    if (result === undefined) {
      throw new NotFoundException('Product not found');
    }
    return result;
  }

  private rethrowReferenceError(error: unknown): never {
    if (
      isPostgresConstraint(
        error,
        '23503',
        'products_category_id_categories_id_fk',
      )
    ) {
      throw new BadRequestException('Category not found');
    }
    if (
      isPostgresConstraint(
        error,
        '23503',
        'products_seller_id_seller_profiles_id_fk',
      )
    ) {
      throw new ForbiddenException('A seller profile is required');
    }
    throw error;
  }
}
