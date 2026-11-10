import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { isPostgresConstraint } from '../common/postgres-constraint';
import { DatabaseService } from '../db/database/database.service';
import { products } from '../db/schema';
import type { UpdateProductInput } from '../products/product.schema';
import type { AdminCreateProductInput } from './admin.schema';

export function rethrowProductReferenceError(error: unknown): never {
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
    throw new BadRequestException('Seller not found');
  }
  throw error;
}

@Injectable()
export class AdminProductsService {
  constructor(private readonly database: DatabaseService) {}

  async create(input: AdminCreateProductInput) {
    try {
      const [product] = await this.database.db
        .insert(products)
        .values({
          sellerId: input.sellerId,
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
      rethrowProductReferenceError(error);
    }
  }

  async update(id: string, input: UpdateProductInput) {
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
        .where(eq(products.id, id))
        .returning();
      if (!product) {
        throw new NotFoundException('Product not found');
      }
      return product;
    } catch (error) {
      rethrowProductReferenceError(error);
    }
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.database.db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });
    if (deleted.length === 0) {
      throw new NotFoundException('Product not found');
    }
  }

  async bulkDelete(ids: string[], sellerId?: string) {
    return this.bulkChange(ids, sellerId, { action: 'delete' });
  }

  async bulkDiscount(
    ids: string[],
    discountPercent: number,
    sellerId?: string,
  ) {
    return this.bulkChange(ids, sellerId, {
      action: 'discount',
      discountPercent,
    });
  }

  private async bulkChange(
    ids: string[],
    sellerId: string | undefined,
    change:
      { action: 'delete' } | { action: 'discount'; discountPercent: number },
  ) {
    return this.database.db.transaction(async (tx) => {
      const filter = and(
        inArray(products.id, ids),
        sellerId ? eq(products.sellerId, sellerId) : undefined,
      );
      const found = await tx
        .select({ id: products.id })
        .from(products)
        .where(filter)
        .orderBy(products.id)
        .for('update');
      if (found.length !== ids.length) {
        throw new NotFoundException('One or more products are unavailable');
      }
      if (change.action === 'delete') {
        await tx.delete(products).where(filter);
      } else {
        await tx
          .update(products)
          .set({ discountPercent: change.discountPercent })
          .where(filter);
      }
      return { changed: found.length };
    });
  }
}
