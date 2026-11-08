import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/database/database.service';
import { productImages, storageCleanup } from '../db/schema';
import { StorageService } from './storage.service';

@Injectable()
export class ImageCleanupService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  async flush() {
    await this.database.db
      .delete(productImages)
      .where(
        and(
          eq(productImages.status, 'pending'),
          sql`${productImages.createdAt} < now() - interval '1 hour'`,
        ),
      );
    const pending = await this.database.db
      .select()
      .from(storageCleanup)
      .where(
        and(
          sql`${storageCleanup.notBefore} <= now()`,
          sql`not exists (select 1 from ${productImages} where ${productImages.path} = ${storageCleanup.path})`,
        ),
      )
      .orderBy(storageCleanup.createdAt, storageCleanup.path)
      .limit(100);
    let removed = 0;
    for (const item of pending) {
      await this.storage.remove(item.bucket, item.path);
      await this.database.db
        .delete(storageCleanup)
        .where(
          and(
            eq(storageCleanup.bucket, item.bucket),
            eq(storageCleanup.path, item.path),
          ),
        );
      removed++;
    }
    return { removed };
  }
}
