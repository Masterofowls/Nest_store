import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { isPostgresConstraint } from '../common/postgres-constraint';
import { DatabaseService } from '../db/database/database.service';
import { brands } from '../db/schema';
import type { BrandInput } from './brand.schema';

export const MAX_LISTED_BRANDS = 500;

@Injectable()
export class BrandsService {
  constructor(private readonly database: DatabaseService) {}

  findAll() {
    return this.database.db
      .select({ id: brands.id, name: brands.name })
      .from(brands)
      .orderBy(asc(brands.name), asc(brands.id))
      .limit(MAX_LISTED_BRANDS);
  }

  async create(input: BrandInput) {
    try {
      const [brand] = await this.database.db
        .insert(brands)
        .values({ name: input.name })
        .returning({ id: brands.id, name: brands.name });
      if (!brand) {
        throw new Error('Brand insert did not return a brand');
      }
      return brand;
    } catch (error) {
      this.rethrowDuplicateName(error);
    }
  }

  async update(id: string, input: BrandInput) {
    try {
      const [brand] = await this.database.db
        .update(brands)
        .set({ name: input.name })
        .where(eq(brands.id, id))
        .returning({ id: brands.id, name: brands.name });
      if (!brand) {
        throw new NotFoundException('Brand not found');
      }
      return brand;
    } catch (error) {
      this.rethrowDuplicateName(error);
    }
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.database.db
      .delete(brands)
      .where(eq(brands.id, id))
      .returning({ id: brands.id });
    if (deleted.length === 0) {
      throw new NotFoundException('Brand not found');
    }
  }

  private rethrowDuplicateName(error: unknown): never {
    if (isPostgresConstraint(error, '23505', 'brands_name_unique')) {
      throw new ConflictException('A brand with this name already exists');
    }
    throw error;
  }
}
