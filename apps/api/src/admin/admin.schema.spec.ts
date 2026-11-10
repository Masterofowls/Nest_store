import {
  adminCreateProductSchema,
  bulkDeleteProductsSchema,
  bulkDiscountProductsSchema,
  adminOrderQuerySchema,
  createAdminUserSchema,
  exportQuerySchema,
  importCsvSchema,
  MAX_IMPORT_CHARACTERS,
  updateAdminUserSchema,
  userIdSchema,
} from './admin.schema';
import {
  createBannerSchema,
  updateBannerSchema,
} from '../banners/banner.schema';

describe('admin schemas', () => {
  it.each(['abc_DEF-123', 'x'])('accepts user ID %j', (id) => {
    expect(userIdSchema.safeParse(id).success).toBe(true);
  });

  it.each(['', 'has space', 'a/b', 'x'.repeat(129)])(
    'rejects user ID %j',
    (id) => {
      expect(userIdSchema.safeParse(id).success).toBe(false);
    },
  );

  it('normalises a created user email', () => {
    expect(
      createAdminUserSchema.parse({
        name: ' Ann ',
        email: ' ANN@Example.TEST ',
        password: 'long-enough',
      }),
    ).toEqual({
      name: 'Ann',
      email: 'ann@example.test',
      password: 'long-enough',
    });
  });

  it.each([
    { name: 'A', email: 'bad', password: 'long-enough' },
    { name: 'A', email: 'a@b.test', password: 'short' },
    { name: 'A', email: 'a@b.test', password: 'long-enough', role: 'x' },
  ])('rejects created user %j', (input) => {
    expect(createAdminUserSchema.safeParse(input).success).toBe(false);
  });

  it('requires at least one user update field and forbids email changes', () => {
    expect(updateAdminUserSchema.safeParse({}).success).toBe(false);
    expect(
      updateAdminUserSchema.safeParse({ email: 'new@example.test' }).success,
    ).toBe(false);
    expect(updateAdminUserSchema.parse({ isAdmin: true })).toEqual({
      isAdmin: true,
    });
  });

  it('parses order filters', () => {
    expect(
      adminOrderQuerySchema.parse({
        page: '2',
        status: 'pending',
        userId: 'u1',
      }),
    ).toMatchObject({ page: 2, status: 'pending', userId: 'u1' });
    expect(adminOrderQuerySchema.safeParse({ status: 'paid' }).success).toBe(
      false,
    );
  });

  it('requires a seller UUID for admin-created products', () => {
    const product = {
      name: 'Desk',
      categoryId: '00000000-0000-4000-8000-000000000001',
      price: '10.00',
      stockQuantity: 1,
    };
    expect(adminCreateProductSchema.safeParse(product).success).toBe(false);
    expect(
      adminCreateProductSchema.safeParse({
        ...product,
        sellerId: '00000000-0000-4000-8000-000000000002',
      }).success,
    ).toBe(true);
  });

  it('limits the import size', () => {
    expect(importCsvSchema.safeParse({ csv: '' }).success).toBe(false);
    expect(
      importCsvSchema.safeParse({ csv: 'x'.repeat(MAX_IMPORT_CHARACTERS + 1) })
        .success,
    ).toBe(false);
  });

  it('validates bulk product counts, uniqueness and discounts', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(bulkDeleteProductsSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(bulkDeleteProductsSchema.safeParse({ ids: [id, id] }).success).toBe(
      false,
    );
    expect(
      bulkDeleteProductsSchema.safeParse({ ids: Array(101).fill(id) }).success,
    ).toBe(false);
    expect(
      bulkDiscountProductsSchema.safeParse({ ids: [id], discountPercent: 101 })
        .success,
    ).toBe(false);
    expect(
      bulkDiscountProductsSchema.safeParse({ ids: [id], discountPercent: 1.5 })
        .success,
    ).toBe(false);
    expect(
      bulkDiscountProductsSchema.safeParse({ ids: [id], discountPercent: 0 })
        .success,
    ).toBe(true);
    expect(
      bulkDiscountProductsSchema.safeParse({ ids: [id], discountPercent: 100 })
        .success,
    ).toBe(true);
  });

  it('defaults export format to JSON', () => {
    expect(exportQuerySchema.parse({})).toEqual({ format: 'json' });
    expect(exportQuerySchema.safeParse({ format: 'xml' }).success).toBe(false);
  });
});

describe('banner schemas', () => {
  it('turns empty optional text into null', () => {
    expect(
      createBannerSchema.parse({
        title: ' Sale ',
        description: '',
        linkUrl: '',
        imageUrl: '',
      }),
    ).toEqual({
      title: 'Sale',
      description: null,
      linkUrl: null,
      imageUrl: null,
    });
  });

  it.each(['/catalog?category=1', 'https://example.test/sale'])(
    'accepts link %j',
    (linkUrl) => {
      expect(
        createBannerSchema.safeParse({ title: 'T', linkUrl }).success,
      ).toBe(true);
    },
  );

  it.each([
    '//evil.test',
    '/\\evil.test',
    'javascript:alert(1)',
    'catalog',
    'https://user:pass@example.test',
  ])('rejects link %j', (linkUrl) => {
    expect(createBannerSchema.safeParse({ title: 'T', linkUrl }).success).toBe(
      false,
    );
  });

  it.each(['/banner.png', 'data:image/png;base64,AA', 'ftp://example.test/a'])(
    'rejects image URL %j',
    (imageUrl) => {
      expect(
        createBannerSchema.safeParse({ title: 'T', imageUrl }).success,
      ).toBe(false);
    },
  );

  it('validates sort order and the update payload', () => {
    expect(
      createBannerSchema.safeParse({ title: 'T', sortOrder: -1 }).success,
    ).toBe(false);
    expect(updateBannerSchema.safeParse({}).success).toBe(false);
    expect(updateBannerSchema.parse({ isActive: false })).toEqual({
      isActive: false,
    });
  });
});
