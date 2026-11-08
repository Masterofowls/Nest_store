import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const maximumImageBytes = 5 * 1024 * 1024;

export async function prepareImage(buffer: Buffer): Promise<Buffer> {
  if (buffer.length === 0 || buffer.length > maximumImageBytes) {
    throw new BadRequestException('Image must be between 1 byte and 5 MiB');
  }
  try {
    const image = sharp(buffer, {
      limitInputPixels: 16_777_216,
      failOn: 'error',
    });
    const metadata = await image.metadata();
    if (
      !metadata.format ||
      !['jpeg', 'png', 'webp'].includes(metadata.format) ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 4096 ||
      metadata.height > 4096 ||
      (metadata.pages ?? 1) > 1
    ) {
      throw new BadRequestException(
        'Use a non-animated JPEG, PNG or WebP image up to 4096 pixels per side',
      );
    }
    return await image
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('Image cannot be decoded');
  }
}
