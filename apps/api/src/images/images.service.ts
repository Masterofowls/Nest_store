import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../db/database/database.service';
import { productImages, products, storageCleanup } from '../db/schema';
import { StorageService } from './storage.service';
import { ImageCleanupService } from './image-cleanup.service';
import { prepareImage } from './image-validation';

const publicFields = {
  id: productImages.id,
  productId: productImages.productId,
  url: productImages.url,
  createdAt: productImages.createdAt,
};
type ImageActor = { role: 'admin' } | { role: 'seller'; sellerId: string };

@Injectable()
export class ImagesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
    private readonly cleanup: ImageCleanupService,
  ) {}

  async list(productId: string) {
    const [product] = await this.database.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId));
    if (!product) throw new NotFoundException('Product not found');
    return this.database.db
      .select(publicFields)
      .from(productImages)
      .where(
        and(
          eq(productImages.productId, productId),
          eq(productImages.status, 'ready'),
        ),
      )
      .orderBy(productImages.createdAt, productImages.id)
      .limit(8);
  }

  async upload(productId: string, sellerId: string, bytes: Buffer) {
    return this.uploadFor(productId, { role: 'seller', sellerId }, bytes);
  }

  async uploadAsAdmin(productId: string, bytes: Buffer) {
    return this.uploadFor(productId, { role: 'admin' }, bytes);
  }

  private async uploadFor(productId: string, actor: ImageActor, bytes: Buffer) {
    const buffer = await prepareImage(bytes);
    const id = randomUUID();
    const path = `${productId}/${id}.webp`;
    const bucket = this.storage.bucket;
    const url = this.storage.publicUrl(path);
    await this.cleanup.flush();
    await this.database.db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .for('update');
      if (!product) throw new NotFoundException('Product not found');
      if (actor.role === 'seller' && product.sellerId !== actor.sellerId)
        throw new ForbiddenException('Product belongs to another seller');
      const [images] = await tx
        .select({ total: count() })
        .from(productImages)
        .where(eq(productImages.productId, productId));
      if (images.total >= 8)
        throw new ConflictException('A product can have at most 8 images');
      await tx
        .insert(productImages)
        .values({ id, productId, bucket, path, url });
      await tx
        .insert(storageCleanup)
        .values({
          bucket,
          path,
          notBefore: new Date(Date.now() + 60_000),
        })
        .onConflictDoNothing();
    });
    try {
      await this.storage.upload(path, buffer);
      return await this.database.db.transaction(async (tx) => {
        const [image] = await tx
          .update(productImages)
          .set({ status: 'ready' })
          .where(eq(productImages.id, id))
          .returning(publicFields);
        if (!image)
          throw new NotFoundException('Product was deleted during upload');
        await tx
          .delete(storageCleanup)
          .where(
            and(
              eq(storageCleanup.bucket, bucket),
              eq(storageCleanup.path, path),
            ),
          );
        return image;
      });
    } catch (error) {
      await this.database.db
        .delete(productImages)
        .where(eq(productImages.id, id));
      // A cascade may have queued this object while its upload was still running.
      await this.database.db
        .insert(storageCleanup)
        .values({
          bucket,
          path,
          notBefore: new Date(Date.now() + 60_000),
        })
        .onConflictDoNothing();
      await this.cleanup.flush();
      throw error;
    }
  }

  async delete(
    productId: string,
    imageId: string,
    sellerId: string,
  ): Promise<void> {
    return this.deleteFor(productId, imageId, { role: 'seller', sellerId });
  }

  async deleteAsAdmin(productId: string, imageId: string): Promise<void> {
    return this.deleteFor(productId, imageId, { role: 'admin' });
  }

  private async deleteFor(
    productId: string,
    imageId: string,
    actor: ImageActor,
  ): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .for('update');
      if (!product) throw new NotFoundException('Product not found');
      if (actor.role === 'seller' && product.sellerId !== actor.sellerId)
        throw new ForbiddenException('Product belongs to another seller');
      const deleted = await tx
        .delete(productImages)
        .where(
          and(
            eq(productImages.id, imageId),
            eq(productImages.productId, productId),
          ),
        )
        .returning({ id: productImages.id });
      if (deleted.length === 0)
        throw new NotFoundException('Product image not found');
    });
    await this.cleanup.flush();
  }
}
