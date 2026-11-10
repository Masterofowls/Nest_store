import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { DatabaseService } from '../db/database/database.service';
import { categories, orderItems, products, ratings } from '../db/schema';
import { isPostgresConstraint } from '../common/postgres-constraint';
import type {
  CreateProductInput,
  ProductQuery,
  ProductSort,
  UpdateProductInput,
} from './product.schema';

// Matches the cart's rounding of discounted unit prices.
const effectivePrice = sql`round(${products.price} * (100 - ${products.discountPercent}) / 100.0, 2)`;

type ProductRow = typeof products.$inferSelect & {
  averageRating: string | null;
  ratingCount: number;
};

function withRatingNumbers({ averageRating, ...product }: ProductRow) {
  return {
    ...product,
    averageRating: averageRating === null ? null : Number(averageRating),
  };
}

@Injectable()
export class ProductsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(query: ProductQuery) {
    const { ratingStats, orderStats } = this.statsSubqueries();
    const search = query.search?.toLowerCase();
    const rows = await this.database.db
      .select(this.productColumns(ratingStats))
      .from(products)
      .leftJoin(ratingStats, eq(ratingStats.productId, products.id))
      .leftJoin(orderStats, eq(orderStats.productId, products.id))
      .where(
        and(
          search
            ? or(
                sql`strpos(lower(${products.name}), ${search}) > 0`,
                sql`cast(${products.id} as text) = ${search}`,
              )
            : undefined,
          query.categoryId
            ? or(
                eq(products.categoryId, query.categoryId),
                sql`${products.categoryId} in (select ${categories.id} from ${categories} where ${categories.parentId} = ${query.categoryId})`,
              )
            : undefined,
          query.sellerId ? eq(products.sellerId, query.sellerId) : undefined,
          query.minPrice !== undefined
            ? gte(effectivePrice, query.minPrice)
            : undefined,
          query.maxPrice !== undefined
            ? lte(effectivePrice, query.maxPrice)
            : undefined,
          query.discounted ? gt(products.discountPercent, 0) : undefined,
          query.inStock ? gt(products.stockQuantity, 0) : undefined,
        ),
      )
      .orderBy(
        ...this.sortOrder(query.sort, {
          averageRating: ratingStats.averageRating,
          ratingCount: ratingStats.ratingCount,
          orderedQuantity: orderStats.orderedQuantity,
        }),
      )
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
    return rows.map(withRatingNumbers);
  }

  async findOne(id: string) {
    const { ratingStats } = this.statsSubqueries();
    const [product] = await this.database.db
      .select(this.productColumns(ratingStats))
      .from(products)
      .leftJoin(ratingStats, eq(ratingStats.productId, products.id))
      .where(eq(products.id, id));
    return product === undefined ? undefined : withRatingNumbers(product);
  }

  private statsSubqueries() {
    const ratingStats = this.database.db
      .select({
        productId: ratings.productId,
        averageRating: sql<string | null>`round(avg(${ratings.score}), 1)`.as(
          'average_rating',
        ),
        ratingCount: sql<number>`count(*)::int`.as('rating_count'),
      })
      .from(ratings)
      .groupBy(ratings.productId)
      .as('rating_stats');
    const orderStats = this.database.db
      .select({
        productId: orderItems.productId,
        orderedQuantity: sql<number>`sum(${orderItems.quantity})::int`.as(
          'ordered_quantity',
        ),
      })
      .from(orderItems)
      .groupBy(orderItems.productId)
      .as('order_stats');
    return { ratingStats, orderStats };
  }

  private productColumns(ratingStats: {
    averageRating: SQL.Aliased<string | null>;
    ratingCount: SQL.Aliased<number>;
  }) {
    return {
      ...getTableColumns(products),
      averageRating: sql<string | null>`${ratingStats.averageRating}`,
      ratingCount: sql<number>`coalesce(${ratingStats.ratingCount}, 0)`,
    };
  }

  private sortOrder(
    sort: ProductSort | undefined,
    stats: {
      averageRating: SQL.Aliased<string | null>;
      ratingCount: SQL.Aliased<number>;
      orderedQuantity: SQL.Aliased<number>;
    },
  ): SQL[] {
    const byId = asc(products.id);
    switch (sort) {
      case 'popular':
        return [
          sql`coalesce(${stats.orderedQuantity}, 0) desc`,
          sql`coalesce(${stats.ratingCount}, 0) desc`,
          byId,
        ];
      case 'price_asc':
        return [asc(effectivePrice), byId];
      case 'price_desc':
        return [desc(effectivePrice), byId];
      case 'rating':
        return [
          sql`${stats.averageRating} desc nulls last`,
          sql`coalesce(${stats.ratingCount}, 0) desc`,
          byId,
        ];
      case 'newest':
        return [desc(products.createdAt), byId];
      default:
        return [byId];
    }
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
          deliveryDays: input.deliveryDays,
          badge: input.badge,
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
          deliveryDays: input.deliveryDays,
          badge: input.badge,
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
