import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { isPostgresConstraint } from '../common/postgres-constraint';
import { DatabaseService } from '../db/database/database.service';
import { products, ratings } from '../db/schema';
import type {
  CreateRatingInput,
  RatingQuery,
  UpdateRatingInput,
} from './rating.schema';

const ratingFields = {
  id: ratings.id,
  productId: ratings.productId,
  productName: ratings.productName,
  score: ratings.score,
  comment: ratings.comment,
  createdAt: ratings.createdAt,
  updatedAt: ratings.updatedAt,
};

@Injectable()
export class RatingsService {
  constructor(private readonly database: DatabaseService) {}

  async findForProduct(productId: string, query: RatingQuery) {
    const [product] = await this.database.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId));
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return this.list(query, undefined, productId);
  }

  findOwn(userId: string, query: RatingQuery) {
    return this.list(query, userId);
  }

  private list(query: RatingQuery, userId?: string, productId?: string) {
    const search = query.search?.toLowerCase();
    return this.database.db
      .select(ratingFields)
      .from(ratings)
      .where(
        and(
          userId ? eq(ratings.userId, userId) : undefined,
          productId ? eq(ratings.productId, productId) : undefined,
          search
            ? sql`strpos(lower(coalesce(${ratings.comment}, '')), ${search}) > 0`
            : undefined,
        ),
      )
      .orderBy(desc(ratings.createdAt), desc(ratings.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
  }

  async create(userId: string, input: CreateRatingInput) {
    try {
      return await this.database.db.transaction(async (tx) => {
        const [product] = await tx
          .select({ name: products.name })
          .from(products)
          .where(eq(products.id, input.productId))
          .for('share');
        if (!product) {
          throw new NotFoundException('Product not found');
        }
        const [rating] = await tx
          .insert(ratings)
          .values({
            userId,
            productId: input.productId,
            productName: product.name,
            score: input.score,
            comment: input.comment,
          })
          .returning(ratingFields);
        if (!rating) {
          throw new Error('Rating insert did not return a rating');
        }
        return rating;
      });
    } catch (error) {
      if (isPostgresConstraint(error, '23505', 'ratings_user_product_unique')) {
        throw new ConflictException('Product already has your rating');
      }
      if (isPostgresConstraint(error, '23503', 'ratings_user_id_user_id_fk')) {
        throw new UnauthorizedException('User account no longer exists');
      }
      throw error;
    }
  }

  async update(userId: string, id: string, input: UpdateRatingInput) {
    return this.database.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ productId: ratings.productId })
        .from(ratings)
        .where(and(eq(ratings.id, id), eq(ratings.userId, userId)));
      if (!existing) {
        throw new NotFoundException('Rating not found');
      }
      if (!existing.productId) {
        throw new NotFoundException('Rated product no longer exists');
      }
      const [product] = await tx
        .select({ name: products.name })
        .from(products)
        .where(eq(products.id, existing.productId))
        .for('share');
      if (!product) {
        throw new NotFoundException('Product not found');
      }
      const [rating] = await tx
        .update(ratings)
        .set({
          score: input.score,
          comment: input.comment,
          productName: product.name,
          updatedAt: new Date(),
        })
        .where(and(eq(ratings.id, id), eq(ratings.userId, userId)))
        .returning(ratingFields);
      if (!rating) {
        throw new NotFoundException('Rating not found');
      }
      return rating;
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const [deleted] = await this.database.db
      .delete(ratings)
      .where(and(eq(ratings.id, id), eq(ratings.userId, userId)))
      .returning({ id: ratings.id });
    if (!deleted) {
      throw new NotFoundException('Rating not found');
    }
  }
}
