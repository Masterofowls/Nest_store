import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import type { Environment } from '../config/env.schema';

describe('Supabase product storage', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fails explicitly when storage settings are absent', async () => {
    const service = new StorageService(new ConfigService<Environment, true>());
    expect(() => service.publicUrl('image.webp')).toThrow('not configured');
    await expect(
      service.upload('image.webp', Buffer.from('bytes')),
    ).rejects.toThrow('not configured');
  });

  it('uses the pinned SDK with server-only auth and reports storage failures', async () => {
    const response = new Response('{"message":"Storage unavailable"}', {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    const service = new StorageService(
      new ConfigService<Environment, true>({
        SUPABASE_URL: 'https://storage.example.test',
        SUPABASE_SERVICE_ROLE_KEY: 'fake-server-key-at-least-twenty-characters',
      }),
    );
    expect(service.publicUrl('product/image.webp')).toContain(
      '/storage/v1/object/public/product-images/product/image.webp',
    );
    await expect(
      service.upload('product/image.webp', Buffer.from('bytes')),
    ).rejects.toThrow('upload failed');
    await expect(
      service.remove('product-images', 'product/image.webp'),
    ).rejects.toThrow('cleanup failed');
    expect(fetch).toHaveBeenCalled();
  });
});
