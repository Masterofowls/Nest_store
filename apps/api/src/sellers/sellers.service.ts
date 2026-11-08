import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, asc } from 'drizzle-orm';
import { DatabaseService } from '../db/database/database.service';
import { sellerProfiles } from '../db/schema';
import type { PaginationQuery } from '../common/pagination.schema';
import { isPostgresConstraint } from '../common/postgres-constraint';
import type { CreateSellerInput, UpdateSellerInput } from './seller.schema';

const publicFields = {
  id: sellerProfiles.id,
  storeName: sellerProfiles.storeName,
  description: sellerProfiles.description,
  createdAt: sellerProfiles.createdAt,
  updatedAt: sellerProfiles.updatedAt,
};

@Injectable()
export class SellersService {
  constructor(private readonly database: DatabaseService) {}

  findAll(query: PaginationQuery) {
    const search = query.search?.toLowerCase();
    return this.database.db
      .select(publicFields)
      .from(sellerProfiles)
      .where(
        search
          ? sql`strpos(lower(${sellerProfiles.storeName}), ${search}) > 0`
          : undefined,
      )
      .orderBy(asc(sellerProfiles.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
  }

  async findOne(id: string) {
    const [profile] = await this.database.db
      .select(publicFields)
      .from(sellerProfiles)
      .where(eq(sellerProfiles.id, id));
    if (!profile) {
      throw new NotFoundException('Seller profile not found');
    }
    return profile;
  }

  async findOwn(userId: string) {
    const [profile] = await this.database.db
      .select(publicFields)
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId));
    if (!profile) {
      throw new NotFoundException('Seller profile not found');
    }
    return profile;
  }

  async requireSeller(userId: string) {
    const [profile] = await this.database.db
      .select()
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId));
    if (!profile) {
      throw new ForbiddenException('A seller profile is required');
    }
    return profile;
  }

  async create(userId: string, input: CreateSellerInput) {
    try {
      const [profile] = await this.database.db
        .insert(sellerProfiles)
        .values({
          userId,
          storeName: input.storeName,
          description: input.description,
        })
        .returning(publicFields);
      if (!profile) {
        throw new Error('Seller insert did not return a profile');
      }
      return profile;
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async updateOwn(userId: string, input: UpdateSellerInput) {
    try {
      const [profile] = await this.database.db
        .update(sellerProfiles)
        .set({
          storeName: input.storeName,
          description: input.description,
          updatedAt: new Date(),
        })
        .where(eq(sellerProfiles.userId, userId))
        .returning(publicFields);
      if (!profile) {
        throw new NotFoundException('Seller profile not found');
      }
      return profile;
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async deleteOwn(userId: string): Promise<void> {
    const deleted = await this.database.db
      .delete(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId))
      .returning({ id: sellerProfiles.id });
    if (deleted.length === 0) {
      throw new NotFoundException('Seller profile not found');
    }
  }

  private rethrowConflict(error: unknown): never {
    if (
      isPostgresConstraint(error, '23505', 'seller_profiles_user_id_unique')
    ) {
      throw new ConflictException('A seller profile already exists');
    }
    if (
      isPostgresConstraint(error, '23505', 'seller_profiles_store_name_unique')
    ) {
      throw new ConflictException('Store name is already taken');
    }
    throw error;
  }
}
