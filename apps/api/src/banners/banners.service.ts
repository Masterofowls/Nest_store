import { Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../db/database/database.service';
import { banners } from '../db/schema';
import type { PageOnlyQuery } from '../common/pagination.schema';
import type { CreateBannerInput, UpdateBannerInput } from './banner.schema';

export const MAX_ACTIVE_BANNERS = 10;

@Injectable()
export class BannersService {
  constructor(private readonly database: DatabaseService) {}

  findActive() {
    return this.database.db
      .select()
      .from(banners)
      .where(eq(banners.isActive, true))
      .orderBy(asc(banners.sortOrder), asc(banners.id))
      .limit(MAX_ACTIVE_BANNERS);
  }

  findAll(query: PageOnlyQuery) {
    return this.database.db
      .select()
      .from(banners)
      .orderBy(asc(banners.sortOrder), asc(banners.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
  }

  async create(input: CreateBannerInput) {
    const [banner] = await this.database.db
      .insert(banners)
      .values({
        title: input.title,
        description: input.description ?? null,
        linkUrl: input.linkUrl ?? null,
        imageUrl: input.imageUrl ?? null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    if (!banner) {
      throw new Error('Banner insert did not return a banner');
    }
    return banner;
  }

  async update(id: string, input: UpdateBannerInput) {
    const [banner] = await this.database.db
      .update(banners)
      .set({
        title: input.title,
        description: input.description,
        linkUrl: input.linkUrl,
        imageUrl: input.imageUrl,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(banners.id, id))
      .returning();
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    return banner;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.database.db
      .delete(banners)
      .where(eq(banners.id, id))
      .returning({ id: banners.id });
    if (deleted.length === 0) {
      throw new NotFoundException('Banner not found');
    }
  }
}
