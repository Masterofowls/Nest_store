import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { isPostgresConstraint } from '../common/postgres-constraint';
import { DatabaseService } from '../db/database/database.service';
import { products, productViews } from '../db/schema';
import type { ViewQuery } from './view.schema';

@Injectable()
export class ViewsService {
  constructor(private readonly database: DatabaseService) {}

  async record(userId: string, productId: string) {
    try {
      return await this.database.db.transaction(async (tx) => {
        const [product] = await tx
          .select({ id: products.id })
          .from(products)
          .where(eq(products.id, productId))
          .for('share');
        if (!product) {
          throw new NotFoundException('Product not found');
        }
        const [view] = await tx
          .insert(productViews)
          .values({ userId, productId })
          .returning({
            id: productViews.id,
            productId: productViews.productId,
            viewedAt: productViews.viewedAt,
          });
        if (!view) {
          throw new Error('View insert did not return a view');
        }
        return view;
      });
    } catch (error) {
      if (
        isPostgresConstraint(error, '23503', 'product_views_user_id_user_id_fk')
      ) {
        throw new UnauthorizedException('User account no longer exists');
      }
      throw error;
    }
  }

  findOwn(userId: string, query: ViewQuery) {
    const search = query.search?.toLowerCase();
    return this.database.db
      .select({
        id: productViews.id,
        productId: productViews.productId,
        productName: products.name,
        viewedAt: productViews.viewedAt,
      })
      .from(productViews)
      .innerJoin(products, eq(products.id, productViews.productId))
      .where(
        and(
          eq(productViews.userId, userId),
          search
            ? sql`strpos(lower(${products.name}), ${search}) > 0`
            : undefined,
        ),
      )
      .orderBy(desc(productViews.viewedAt), desc(productViews.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
  }
}
