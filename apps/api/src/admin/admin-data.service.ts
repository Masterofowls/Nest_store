import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/database/database.service';
import {
  banners,
  categories,
  carts,
  cartItems,
  favourites,
  orderItems,
  orders,
  products,
  productImages,
  productViews,
  ratings,
  sellerProfiles,
  user,
} from '../db/schema';
import { AdminUsersService, adminUserColumns } from './admin-users.service';
import { rethrowProductReferenceError } from './admin-products.service';
import {
  adminCreateProductSchema,
  createAdminUserSchema,
} from './admin.schema';
import type {
  AdminCreateProductInput,
  CreateAdminUserInput,
  ExportResource,
} from './admin.schema';
import { CsvFormatError, csvRecords, toCsv } from './csv';

export const MAX_IMPORT_ROWS = { products: 1_000, users: 100 } as const;
export const MAX_EXPORT_ROWS = 10_000;

const PRODUCT_COLUMNS = [
  'name',
  'categoryId',
  'sellerId',
  'price',
  'stockQuantity',
] as const;
const PRODUCT_OPTIONAL_COLUMNS = ['description', 'discountPercent'] as const;
const USER_COLUMNS = ['name', 'email', 'password'] as const;
const USER_OPTIONAL_COLUMNS = ['isAdmin'] as const;

export type RowError = { row: number; message: string };

function integerCell(value: string): number | string {
  return /^-?\d+$/.test(value) ? Number(value) : value;
}

function booleanCell(value: string | undefined): boolean | string | undefined {
  if (value === undefined || value === '') return undefined;
  const normalized = value.toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes')
    return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no')
    return false;
  return value;
}

function readRecords(
  csv: string,
  required: readonly string[],
  optional: readonly string[],
  maxRows: number,
) {
  let records: Record<string, string>[];
  try {
    records = csvRecords(csv, required, optional);
  } catch (error) {
    if (error instanceof CsvFormatError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
  if (records.length === 0) {
    throw new BadRequestException('CSV has no data rows');
  }
  if (records.length > maxRows) {
    throw new BadRequestException(
      `CSV has ${records.length} rows; the limit is ${maxRows}`,
    );
  }
  return records;
}

function rejectInvalidRows(errors: RowError[]) {
  if (errors.length > 0) {
    throw new BadRequestException({
      message: 'CSV has invalid rows; nothing was imported',
      errors: errors.slice(0, 50),
      error: 'Bad Request',
      statusCode: 400,
    });
  }
}

@Injectable()
export class AdminDataService {
  constructor(
    private readonly database: DatabaseService,
    private readonly users: AdminUsersService,
  ) {}

  async stats() {
    const db = this.database.db;
    const [
      userCount,
      adminCount,
      sellerCount,
      productCount,
      outOfStockCount,
      categoryCount,
      orderCount,
      pendingOrderCount,
      bannerCount,
      revenue,
    ] = await Promise.all([
      db.$count(user),
      db.$count(user, eq(user.isAdmin, true)),
      db.$count(sellerProfiles),
      db.$count(products),
      db.$count(products, eq(products.stockQuantity, 0)),
      db.$count(categories),
      db.$count(orders),
      db.$count(orders, eq(orders.status, 'pending')),
      db.$count(banners, eq(banners.isActive, true)),
      db
        .select({
          total: sql<string>`coalesce(sum(${orders.totalAmount}), 0)::text`,
        })
        .from(orders)
        .where(ne(orders.status, 'cancelled')),
    ]);
    return {
      users: userCount,
      admins: adminCount,
      sellers: sellerCount,
      products: productCount,
      outOfStockProducts: outOfStockCount,
      categories: categoryCount,
      orders: orderCount,
      pendingOrders: pendingOrderCount,
      activeBanners: bannerCount,
      revenue: revenue[0]?.total ?? '0',
    };
  }

  async importProducts(csv: string, sellerId?: string) {
    const records = readRecords(
      csv,
      sellerId
        ? PRODUCT_COLUMNS.filter((column) => column !== 'sellerId')
        : PRODUCT_COLUMNS,
      PRODUCT_OPTIONAL_COLUMNS,
      MAX_IMPORT_ROWS.products,
    );
    const errors: RowError[] = [];
    const values: AdminCreateProductInput[] = [];
    records.forEach((record, index) => {
      const parsed = adminCreateProductSchema.safeParse({
        name: record.name,
        categoryId: record.categoryId,
        sellerId: sellerId ?? record.sellerId,
        price: record.price,
        stockQuantity: integerCell(record.stockQuantity),
        description: record.description || null,
        discountPercent: record.discountPercent
          ? integerCell(record.discountPercent)
          : undefined,
      });
      if (parsed.success) values.push(parsed.data);
      else errors.push({ row: index + 2, message: describeIssues(parsed) });
    });
    rejectInvalidRows(errors);
    try {
      const created = await this.database.db.transaction((tx) =>
        tx
          .insert(products)
          .values(
            values.map((input) => ({
              sellerId: input.sellerId,
              name: input.name,
              categoryId: input.categoryId,
              stockQuantity: input.stockQuantity,
              price: input.price,
              description: input.description,
              discountPercent: input.discountPercent,
            })),
          )
          .returning({ id: products.id }),
      );
      return { created: created.length };
    } catch (error) {
      rethrowProductReferenceError(error);
    }
  }

  async importUsers(csv: string) {
    const records = readRecords(
      csv,
      USER_COLUMNS,
      USER_OPTIONAL_COLUMNS,
      MAX_IMPORT_ROWS.users,
    );
    const errors: RowError[] = [];
    const inputs: { row: number; input: CreateAdminUserInput }[] = [];
    const seen = new Set<string>();
    records.forEach((record, index) => {
      const parsed = createAdminUserSchema.safeParse({
        name: record.name,
        email: record.email,
        password: record.password,
        isAdmin: booleanCell(record.isAdmin),
      });
      if (!parsed.success) {
        errors.push({ row: index + 2, message: describeIssues(parsed) });
      } else if (seen.has(parsed.data.email)) {
        errors.push({
          row: index + 2,
          message: 'email: duplicated earlier in this file',
        });
      } else {
        seen.add(parsed.data.email);
        inputs.push({ row: index + 2, input: parsed.data });
      }
    });
    rejectInvalidRows(errors);
    let created = 0;
    const skipped: RowError[] = [];
    // Better Auth hashes each password; accounts are created one at a time.
    for (const { row, input } of inputs) {
      try {
        await this.users.create(input);
        created++;
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        skipped.push({ row, message: `${input.email} already exists` });
      }
    }
    return { created, skipped };
  }

  async exportResource(resource: ExportResource) {
    const db = this.database.db;
    switch (resource) {
      case 'products':
        return {
          columns: [
            'id',
            'name',
            'categoryId',
            'sellerId',
            'price',
            'stockQuantity',
            'discountPercent',
            'description',
          ] as const,
          rows: await db
            .select()
            .from(products)
            .orderBy(asc(products.id))
            .limit(MAX_EXPORT_ROWS),
        };
      case 'categories':
        return {
          columns: ['id', 'name'] as const,
          rows: await db
            .select()
            .from(categories)
            .orderBy(asc(categories.name))
            .limit(MAX_EXPORT_ROWS),
        };
      case 'users':
        return {
          columns: [
            'id',
            'name',
            'email',
            'emailVerified',
            'isAdmin',
            'createdAt',
          ] as const,
          rows: await db
            .select(adminUserColumns)
            .from(user)
            .orderBy(asc(user.createdAt), asc(user.id))
            .limit(MAX_EXPORT_ROWS),
        };
      case 'orders':
        return {
          columns: [
            'id',
            'userId',
            'status',
            'totalAmount',
            'createdAt',
            'updatedAt',
          ] as const,
          rows: await db
            .select()
            .from(orders)
            .orderBy(asc(orders.createdAt), asc(orders.id))
            .limit(MAX_EXPORT_ROWS),
        };
      case 'banners':
        return {
          columns: [
            'id',
            'title',
            'description',
            'linkUrl',
            'imageUrl',
            'isActive',
            'sortOrder',
            'createdAt',
            'updatedAt',
          ] as const,
          rows: await db
            .select()
            .from(banners)
            .orderBy(asc(banners.sortOrder), asc(banners.id))
            .limit(MAX_EXPORT_ROWS),
        };
    }
  }

  async exportCsv(resource: ExportResource): Promise<string> {
    const { columns, rows } = await this.exportResource(resource);
    return toCsv<Record<string, unknown>>(columns, rows);
  }

  async backup() {
    return this.database.db.transaction(
      async (db) => {
        const [
          productRows,
          categoryRows,
          userRows,
          sellerRows,
          orderRows,
          orderItemRows,
          bannerRows,
          imageRows,
          cartRows,
          cartItemRows,
          favouriteRows,
          viewRows,
          ratingRows,
        ] = await Promise.all([
          db.select().from(products).orderBy(asc(products.id)),
          db.select().from(categories).orderBy(asc(categories.id)),
          db.select(adminUserColumns).from(user).orderBy(asc(user.id)),
          db.select().from(sellerProfiles).orderBy(asc(sellerProfiles.id)),
          db.select().from(orders).orderBy(asc(orders.id)),
          db.select().from(orderItems).orderBy(asc(orderItems.id)),
          db.select().from(banners).orderBy(asc(banners.id)),
          db
            .select({
              id: productImages.id,
              productId: productImages.productId,
              url: productImages.url,
              createdAt: productImages.createdAt,
            })
            .from(productImages)
            .where(eq(productImages.status, 'ready'))
            .orderBy(asc(productImages.id)),
          db.select().from(carts).orderBy(asc(carts.id)),
          db.select().from(cartItems).orderBy(asc(cartItems.id)),
          db.select().from(favourites).orderBy(asc(favourites.id)),
          db.select().from(productViews).orderBy(asc(productViews.id)),
          db.select().from(ratings).orderBy(asc(ratings.id)),
        ]);
        return {
          exportedAt: new Date().toISOString(),
          products: productRows,
          categories: categoryRows,
          users: userRows,
          sellers: sellerRows,
          orders: orderRows,
          orderItems: orderItemRows,
          banners: bannerRows,
          images: imageRows,
          carts: cartRows,
          cartItems: cartItemRows,
          favourites: favouriteRows,
          productViews: viewRows,
          ratings: ratingRows,
        };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }

  async sellerBackup(sellerId: string) {
    const db = this.database.db;
    return db.transaction(
      async (tx) => {
        const [seller] = await tx
          .select({
            id: sellerProfiles.id,
            storeName: sellerProfiles.storeName,
            description: sellerProfiles.description,
            createdAt: sellerProfiles.createdAt,
            updatedAt: sellerProfiles.updatedAt,
          })
          .from(sellerProfiles)
          .where(eq(sellerProfiles.id, sellerId));
        if (!seller) throw new BadRequestException('Seller profile not found');
        const productRows = await tx
          .select()
          .from(products)
          .where(eq(products.sellerId, sellerId))
          .orderBy(asc(products.id));
        const categoryRows = await tx
          .selectDistinct({
            id: categories.id,
            name: categories.name,
          })
          .from(categories)
          .innerJoin(products, eq(products.categoryId, categories.id))
          .where(eq(products.sellerId, sellerId))
          .orderBy(asc(categories.id));
        const imageRows = await tx
          .select({
            id: productImages.id,
            productId: productImages.productId,
            url: productImages.url,
            createdAt: productImages.createdAt,
          })
          .from(productImages)
          .innerJoin(products, eq(products.id, productImages.productId))
          .where(
            and(
              eq(products.sellerId, sellerId),
              eq(productImages.status, 'ready'),
            ),
          )
          .orderBy(asc(productImages.id));
        return {
          exportedAt: new Date().toISOString(),
          seller,
          products: productRows,
          categories: categoryRows,
          images: imageRows,
        };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }
}

function describeIssues(result: {
  error: { issues: { path: PropertyKey[]; message: string }[] };
}): string {
  return result.error.issues
    .map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`)
    .join('; ');
}
