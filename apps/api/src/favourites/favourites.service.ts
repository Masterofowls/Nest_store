import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { isPostgresConstraint } from '../common/postgres-constraint';
import { DatabaseService } from '../db/database/database.service';
import { favourites, products } from '../db/schema';
import type { FavouriteQuery } from './favourite.schema';

const favouriteFields = {
  id: favourites.id,
  productId: favourites.productId,
  productName: favourites.productName,
  createdAt: favourites.createdAt,
};

@Injectable()
export class FavouritesService {
  constructor(private readonly database: DatabaseService) {}

  findAll(userId: string, query: FavouriteQuery) {
    const search = query.search?.toLowerCase();
    return this.database.db
      .select(favouriteFields)
      .from(favourites)
      .where(
        and(
          eq(favourites.userId, userId),
          search
            ? sql`strpos(lower(${favourites.productName}), ${search}) > 0`
            : undefined,
        ),
      )
      .orderBy(desc(favourites.createdAt), desc(favourites.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
  }

  async create(userId: string, productId: string) {
    try {
      return await this.database.db.transaction(async (tx) => {
        const [product] = await tx
          .select({ name: products.name })
          .from(products)
          .where(eq(products.id, productId))
          .for('share');
        if (!product) {
          throw new NotFoundException('Product not found');
        }
        const [favourite] = await tx
          .insert(favourites)
          .values({ userId, productId, productName: product.name })
          .returning(favouriteFields);
        if (!favourite) {
          throw new Error('Favourite insert did not return a favourite');
        }
        return favourite;
      });
    } catch (error) {
      if (
        isPostgresConstraint(error, '23505', 'favourites_user_product_unique')
      ) {
        throw new ConflictException('Product is already in favourites');
      }
      if (
        isPostgresConstraint(error, '23503', 'favourites_user_id_user_id_fk')
      ) {
        throw new UnauthorizedException('User account no longer exists');
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const [deleted] = await this.database.db
      .delete(favourites)
      .where(and(eq(favourites.id, id), eq(favourites.userId, userId)))
      .returning({ id: favourites.id });
    if (!deleted) {
      throw new NotFoundException('Favourite not found');
    }
  }
}
