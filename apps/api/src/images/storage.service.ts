import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import type { Environment } from '../config/env.schema';

@Injectable()
export class StorageService {
  readonly bucket: string;
  private readonly client?: ReturnType<typeof createClient>;

  constructor(config: ConfigService<Environment, true>) {
    this.bucket =
      config.get('SUPABASE_STORAGE_BUCKET', { infer: true }) ??
      'product-images';
    const url = config.get('SUPABASE_URL', { infer: true });
    const key = config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });
    if (url && key) {
      this.client = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: (
            input: Parameters<typeof fetch>[0],
            init?: Parameters<typeof fetch>[1],
          ) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }),
        },
      });
    }
  }

  publicUrl(path: string): string {
    return this.requireClient().storage.from(this.bucket).getPublicUrl(path)
      .data.publicUrl;
  }

  async upload(path: string, buffer: Buffer): Promise<void> {
    const { error } = await this.requireClient()
      .storage.from(this.bucket)
      .upload(path, buffer, {
        contentType: 'image/webp',
        upsert: false,
        cacheControl: '31536000',
      });
    if (error)
      throw new ServiceUnavailableException('Product image upload failed');
  }

  async remove(bucket: string, path: string): Promise<void> {
    const { error } = await this.requireClient()
      .storage.from(bucket)
      .remove([path]);
    if (error)
      throw new ServiceUnavailableException('Product image cleanup failed');
  }

  private requireClient() {
    if (!this.client)
      throw new ServiceUnavailableException(
        'Product storage is not configured',
      );
    return this.client;
  }
}
