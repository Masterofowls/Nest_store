import sharp from 'sharp';
import { prepareImage, maximumImageBytes } from './image-validation';

describe('Product image validation', () => {
  it('decodes and converts PNG to metadata-free WebP', async () => {
    const input = await sharp({
      create: { width: 3, height: 2, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    const output = await prepareImage(input);
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(3);
    expect(metadata.exif).toBeUndefined();
  });

  it.each([
    Buffer.alloc(0),
    Buffer.from('not an image'),
    Buffer.alloc(maximumImageBytes + 1),
  ])('rejects empty, corrupt or oversized content', async (buffer) => {
    await expect(prepareImage(buffer)).rejects.toThrow();
  });

  it('rejects SVG even when the filename could pretend to be PNG', async () => {
    await expect(
      prepareImage(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>',
        ),
      ),
    ).rejects.toThrow('Use a non-animated');
  });

  it('rejects images beyond the dimension limit', async () => {
    const buffer = await sharp({
      create: { width: 4097, height: 1, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(prepareImage(buffer)).rejects.toThrow('Use a non-animated');
  });

  it.each(['jpeg', 'webp'] as const)(
    'accepts %s and limits output to 2048 pixels',
    async (format) => {
      const input = await sharp({
        create: { width: 4096, height: 2, channels: 3, background: 'red' },
      })
        .withExif({ IFD0: { Copyright: 'Test image metadata' } })
        .toFormat(format)
        .toBuffer();
      const output = await prepareImage(input);
      const metadata = await sharp(output).metadata();
      expect(metadata.width).toBe(2048);
      expect(metadata.format).toBe('webp');
      expect(metadata.exif).toBeUndefined();
    },
  );
});
