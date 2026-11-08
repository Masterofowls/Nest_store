import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, getTableColumns, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DatabaseService } from '../db/database/database.service';
import { products, productViews } from '../db/schema';
import type { RecommendationQuery } from './recommendation.schema';

@Injectable()
export class RecommendationsService {
  constructor(private readonly database: DatabaseService) {}

  async findForProduct(productId: string, query: RecommendationQuery) {
    const [product] = await this.database.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId));
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const targetViews = alias(productViews, 'target_views');
    const relatedViews = alias(productViews, 'related_views');
    const coViewers =
      sql<number>`count(distinct ${targetViews.userId})`.mapWith(Number);

    return this.database.db
      .select({ ...getTableColumns(products), coViewers })
      .from(products)
      .innerJoin(relatedViews, eq(relatedViews.productId, products.id))
      .innerJoin(
        targetViews,
        and(
          eq(targetViews.productId, productId),
          eq(targetViews.userId, relatedViews.userId),
        ),
      )
      .where(ne(products.id, productId))
      .groupBy(products.id)
      .orderBy(desc(coViewers), asc(products.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
  }
}
