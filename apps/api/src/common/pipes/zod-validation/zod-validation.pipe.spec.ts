import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';
import { ZodValidationPipe } from './zod-validation.pipe';

it('returns validated and trimmed data', () => {
  const schema = z.strictObject({
    name: z.string().trim().min(1),
  });
  const pipe = new ZodValidationPipe(schema);

  expect(pipe.transform({ name: ' Keyboard ' })).toEqual({ name: 'Keyboard' });
});

describe('ZodValidationPipe invalid input', () => {
  const schema = z.strictObject({
    name: z.string().trim().min(1),
  });
  const pipe = new ZodValidationPipe(schema);

  it.each([
    undefined,
    null,
    {},
    { name: 123 },
    { name: '' },
    { name: '   ' },
    { name: 'Keyboard', sellerId: 'another-seller' },
  ])('throws BadRequestException for invalid input %#', (input) => {
    expect(() => pipe.transform(input)).toThrow(BadRequestException);
  });

  it('returns HTTP 400 with field paths and messages without submitted values', () => {
    const nestedSchema = z.strictObject({
      product: z.strictObject({
        name: z.string().min(1, 'Name is required'),
        stock: z.number().min(0, 'Stock must be nonnegative'),
      }),
    });
    const nestedPipe = new ZodValidationPipe(nestedSchema);
    let caught: unknown;

    try {
      nestedPipe.transform({ product: { name: '', stock: -1 } });
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BadRequestException);
    if (caught instanceof BadRequestException) {
      expect(caught.getStatus()).toBe(400);
      expect(caught.getResponse()).toEqual({
        message: 'Validation failed',
        errors: [
          { path: ['product', 'name'], message: 'Name is required' },
          { path: ['product', 'stock'], message: 'Stock must be nonnegative' },
        ],
      });
    }
  });
});
