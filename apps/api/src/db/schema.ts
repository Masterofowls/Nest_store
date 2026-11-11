import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  primaryKey,
  pgTable,
  type AnyPgColumn,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// Transliterates Cyrillic so Russian product names still give readable URLs.
const PRODUCT_SLUG_SQL = `coalesce(nullif(trim(both '-' from regexp_replace(translate(replace(replace(replace(replace(replace(replace(replace(replace(lower("name"), 'ж', 'zh'), 'ч', 'ch'), 'ш', 'sh'), 'щ', 'sch'), 'ю', 'yu'), 'я', 'ya'), 'ё', 'yo'), 'х', 'kh'), 'абвгдезийклмнопрстуфцыэъь', 'abvgdezijklmnoprstufcye'), '[^a-z0-9]+', '-', 'g')), ''), 'item') || '-' || right("id"::text, 8)`;

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull().unique(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    index('categories_parent_id_idx').on(table.parentId),
    check('categories_not_own_parent', sql`${table.parentId} <> ${table.id}`),
  ],
);

export const productBadge = pgEnum('product_badge', [
  'bestseller',
  'low_price',
]);

export const attributeType = pgEnum('attribute_type', [
  'text',
  'number',
  'boolean',
]);

export const brands = pgTable('brands', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// category_id is a hint for product forms: the attribute is offered for that
// category and its subcategories. Null means it is offered everywhere.
export const attributes = pgTable(
  'attributes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    type: attributeType('type').notNull(),
    unit: text('unit'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    index('attributes_category_id_idx').on(table.categoryId),
    check(
      'attributes_slug_format',
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
  ],
);

export const sellerProfiles = pgTable(
  'seller_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    storeName: text('store_name').notNull().unique(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('seller_profiles_user_id_unique').on(table.userId)],
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    brandId: uuid('brand_id').references(() => brands.id, {
      onDelete: 'set null',
    }),
    // Products sharing a group are variants of one item (for example colours).
    variantGroupId: uuid('variant_group_id'),
    // Derived from name and id so every insert path gets one. The id suffix
    // keeps it unique and lets a renamed product still resolve from old links.
    slug: text('slug').notNull().generatedAlwaysAs(sql.raw(PRODUCT_SLUG_SQL)),
    description: text('description'),
    stockQuantity: integer('stock_quantity').notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    discountPercent: integer('discount_percent').notNull().default(0),
    deliveryDays: integer('delivery_days').notNull().default(3),
    badge: productBadge('badge'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('products_seller_id_idx').on(table.sellerId),
    index('products_category_id_idx').on(table.categoryId),
    index('products_created_at_idx').on(table.createdAt),
    index('products_brand_id_idx').on(table.brandId),
    index('products_variant_group_id_idx').on(table.variantGroupId),
    uniqueIndex('products_slug_unique').on(table.slug),
    check(
      'products_delivery_days_range',
      sql`${table.deliveryDays} BETWEEN 0 AND 60`,
    ),
    check('products_stock_nonnegative', sql`${table.stockQuantity} >= 0`),
    check('products_price_nonnegative', sql`${table.price} >= 0`),
    check(
      'products_discount_percent_range',
      sql`${table.discountPercent} BETWEEN 0 AND 100`,
    ),
  ],
);

export const productAttributeValues = pgTable(
  'product_attribute_values',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    valueText: text('value_text'),
    valueNumber: numeric('value_number', { precision: 12, scale: 3 }),
    valueBoolean: boolean('value_boolean'),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.attributeId] }),
    index('product_attribute_values_attribute_idx').on(
      table.attributeId,
      table.valueText,
    ),
    check(
      'product_attribute_values_one_value',
      sql`num_nonnulls(${table.valueText}, ${table.valueNumber}, ${table.valueBoolean}) = 1`,
    ),
  ],
);

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('carts_user_id_unique').on(table.userId)],
);

export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    bucket: text('bucket').notNull(),
    path: text('path').notNull().unique(),
    url: text('url').notNull(),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('product_images_product_id_idx').on(table.productId),
    check(
      'product_images_status_check',
      sql`${table.status} IN ('pending', 'ready')`,
    ),
  ],
).enableRLS();

export const storageCleanup = pgTable(
  'storage_cleanup',
  {
    bucket: text('bucket').notNull(),
    path: text('path').notNull(),
    notBefore: timestamp('not_before', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.bucket, table.path] })],
).enableRLS();

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('cart_items_cart_product_unique').on(
      table.cartId,
      table.productId,
    ),
    check('cart_items_quantity_positive', sql`${table.quantity} > 0`),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('pending'),
    checkoutKey: text('checkout_key'),
    totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('orders_user_id_idx').on(table.userId),
    uniqueIndex('orders_user_checkout_key_unique').on(
      table.userId,
      table.checkoutKey,
    ),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    productName: text('product_name').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  },
  (table) => [
    index('order_items_order_id_idx').on(table.orderId),
    index('order_items_product_id_idx').on(table.productId),
    check('order_items_quantity_positive', sql`${table.quantity} > 0`),
    check('order_items_unit_price_nonnegative', sql`${table.unitPrice} >= 0`),
  ],
);

export const favourites = pgTable(
  'favourites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    productName: text('product_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('favourites_user_product_unique').on(
      table.userId,
      table.productId,
    ),
    index('favourites_product_id_idx').on(table.productId),
  ],
);

export const productViews = pgTable(
  'product_views',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    viewedAt: timestamp('viewed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('product_views_user_viewed_at_idx').on(table.userId, table.viewedAt),
    index('product_views_product_viewed_at_idx').on(
      table.productId,
      table.viewedAt,
    ),
  ],
);

export const ratings = pgTable(
  'ratings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    productName: text('product_name').notNull(),
    score: integer('score').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('ratings_user_product_unique').on(
      table.userId,
      table.productId,
    ),
    index('ratings_product_id_idx').on(table.productId),
    check('ratings_score_range', sql`${table.score} BETWEEN 1 AND 5`),
  ],
);

export const banners = pgTable(
  'banners',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    linkUrl: text('link_url'),
    imageUrl: text('image_url'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('banners_active_sort_idx').on(table.isActive, table.sortOrder),
  ],
);

export type AuthUser = typeof user.$inferSelect;
export type NewAuthUser = typeof user.$inferInsert;
export type AuthSession = typeof session.$inferSelect;
export type NewAuthSession = typeof session.$inferInsert;
export type AuthAccount = typeof account.$inferSelect;
export type NewAuthAccount = typeof account.$inferInsert;
export type AuthVerification = typeof verification.$inferSelect;
export type NewAuthVerification = typeof verification.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type SellerProfile = typeof sellerProfiles.$inferSelect;
export type NewSellerProfile = typeof sellerProfiles.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
export type StoreOrder = typeof orders.$inferSelect;
export type NewStoreOrder = typeof orders.$inferInsert;
export type StoreOrderItem = typeof orderItems.$inferSelect;
export type NewStoreOrderItem = typeof orderItems.$inferInsert;
export type Favourite = typeof favourites.$inferSelect;
export type NewFavourite = typeof favourites.$inferInsert;
export type ProductView = typeof productViews.$inferSelect;
export type NewProductView = typeof productViews.$inferInsert;
export type Rating = typeof ratings.$inferSelect;
export type NewRating = typeof ratings.$inferInsert;
export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type Attribute = typeof attributes.$inferSelect;
export type NewAttribute = typeof attributes.$inferInsert;
export type ProductAttributeValue = typeof productAttributeValues.$inferSelect;
export type Banner = typeof banners.$inferSelect;
export type NewBanner = typeof banners.$inferInsert;
