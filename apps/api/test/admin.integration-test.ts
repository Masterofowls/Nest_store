import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import request from 'supertest';
import { z } from 'zod';
import { AdminModule } from '../src/admin/admin.module';
import { AuthModule } from '../src/auth/auth.module';
import { BannersModule } from '../src/banners/banners.module';
import type { Environment } from '../src/config/env.schema';
import { testEnvSchema } from '../src/config/test-env.schema';
import { configureApp } from '../src/configure-app';
import { DatabaseService } from '../src/db/database/database.service';
import { DbModule } from '../src/db/db.module';
import * as schema from '../src/db/schema';
import { UsersModule } from '../src/users/users.module';

const environment = testEnvSchema.safeParse(process.env);
if (!environment.success) {
  throw new Error(
    'Admin integration requires local TEST_DATABASE_URL for store_test',
  );
}
const client = postgres(environment.data.TEST_DATABASE_URL, {
  ssl: false,
  connect_timeout: 10,
  max: 3,
});
const db = drizzle(client, { schema });
const origin = 'http://localhost:3000';
const config = new ConfigService<Environment, true>({
  DATABASE_URL: environment.data.TEST_DATABASE_URL,
  BETTER_AUTH_SECRET: 'fake-admin-test-secret-at-least-thirty-two-characters',
  BETTER_AUTH_URL: origin,
});
const idSchema = z.object({ id: z.string() });
let app: NestExpressApplication;
let emails: string[] = [];
let categoryIds: string[] = [];
let bannerIds: string[] = [];

async function account(prefix = 'admin-it') {
  const email = `${prefix}-${randomUUID()}@example.test`;
  emails.push(email);
  const signup = await request(app.getHttpServer())
    .post('/api/auth/sign-up/email')
    .set('Origin', origin)
    .send({ name: 'Admin test', email, password: 'Admin-test-password-42!' })
    .expect(200);
  const cookies = z.array(z.string()).parse(signup.headers['set-cookie']);
  const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
  const me = await request(app.getHttpServer())
    .get('/users/me')
    .set('Cookie', cookie)
    .expect(200);
  return { id: idSchema.parse(me.body).id, cookie, email };
}

async function admin() {
  const actor = await account();
  await db
    .update(schema.user)
    .set({ isAdmin: true })
    .where(eq(schema.user.id, actor.id));
  return actor;
}

async function catalogue() {
  const owner = await account('admin-seller');
  const [category] = await db
    .insert(schema.categories)
    .values({ name: `admin-it-${randomUUID()}` })
    .returning();
  if (!category) throw new Error('Category fixture insert failed');
  categoryIds.push(category.id);
  const [seller] = await db
    .insert(schema.sellerProfiles)
    .values({ userId: owner.id, storeName: `Admin IT ${randomUUID()}` })
    .returning();
  if (!seller) throw new Error('Seller fixture insert failed');
  const [product] = await db
    .insert(schema.products)
    .values({
      name: 'Admin IT desk',
      sellerId: seller.id,
      categoryId: category.id,
      price: '20.00',
      stockQuantity: 3,
    })
    .returning();
  if (!product) throw new Error('Product fixture insert failed');
  return { owner, category, seller, product };
}

function write(
  method: 'post' | 'patch' | 'delete',
  path: string,
  cookie: string,
  body: object = {},
) {
  return request(app.getHttpServer())
    [method](path)
    .set('Cookie', cookie)
    .set('Origin', origin)
    .send(body);
}

function read(path: string, cookie: string) {
  return request(app.getHttpServer()).get(path).set('Cookie', cookie);
}

beforeAll(async () => {
  const fixture = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      DbModule,
      AuthModule,
      UsersModule,
      BannersModule,
      AdminModule,
    ],
  })
    .overrideProvider(ConfigService)
    .useValue(config)
    .overrideProvider(DatabaseService)
    .useValue({ db })
    .compile();
  app = fixture.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  configureApp(app);
  await app.init();
});

beforeEach(() => {
  emails = [];
  categoryIds = [];
  bannerIds = [];
});

afterEach(async () => {
  if (bannerIds.length > 0) {
    await db
      .delete(schema.banners)
      .where(inArray(schema.banners.id, bannerIds));
  }
  if (emails.length > 0) {
    await db.delete(schema.user).where(inArray(schema.user.email, emails));
  }
  if (categoryIds.length > 0) {
    await db
      .delete(schema.categories)
      .where(inArray(schema.categories.id, categoryIds));
  }
});

afterAll(async () => {
  try {
    await app?.close();
  } finally {
    await client.end({ timeout: 5 });
  }
});

describe('Admin API with real Better Auth and local PostgreSQL', () => {
  it('blocks anonymous users and non-admins from every admin area', async () => {
    const customer = await account();
    for (const path of [
      '/admin/stats',
      '/admin/users',
      '/admin/orders',
      '/admin/banners',
      '/admin/export/backup',
    ]) {
      await request(app.getHttpServer()).get(path).expect(401);
      await read(path, customer.cookie).expect(403);
    }
    await write('post', '/admin/banners', customer.cookie, {
      title: 'Nope',
    }).expect(403);
  });

  it('reports admin flags in /users/me', async () => {
    const actor = await admin();
    const me = await read('/users/me', actor.cookie).expect(200);
    expect(me.body).toMatchObject({ id: actor.id, isAdmin: true });
  });

  it('manages banners and publishes only active ones in sort order', async () => {
    const actor = await admin();
    const later = await write('post', '/admin/banners', actor.cookie, {
      title: 'Later',
      sortOrder: 9_000,
      linkUrl: '/catalog',
    }).expect(201);
    const first = await write('post', '/admin/banners', actor.cookie, {
      title: 'First',
      sortOrder: 8_999,
    }).expect(201);
    const hidden = await write('post', '/admin/banners', actor.cookie, {
      title: 'Hidden',
      isActive: false,
    }).expect(201);
    bannerIds.push(
      ...[later, first, hidden].map((r) => idSchema.parse(r.body).id),
    );
    const published = await request(app.getHttpServer())
      .get('/banners')
      .expect(200);
    const titles = z
      .array(z.object({ title: z.string() }))
      .parse(published.body)
      .map((banner) => banner.title);
    expect(titles).not.toContain('Hidden');
    expect(titles.indexOf('First')).toBeLessThan(titles.indexOf('Later'));

    const hiddenId = idSchema.parse(hidden.body).id;
    await write('patch', `/admin/banners/${hiddenId}`, actor.cookie, {
      isActive: true,
      title: 'Shown',
    })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({ isActive: true, title: 'Shown' }),
      );
    await write('delete', `/admin/banners/${hiddenId}`, actor.cookie).expect(
      204,
    );
    await write('delete', `/admin/banners/${hiddenId}`, actor.cookie).expect(
      404,
    );
  });

  it('creates, promotes, inspects, and deletes users with self-protection', async () => {
    const actor = await admin();
    const email = `admin-created-${randomUUID()}@example.test`;
    emails.push(email);
    const created = await write('post', '/admin/users', actor.cookie, {
      name: 'Created user',
      email: email.toUpperCase(),
      password: 'Created-password-42!',
    }).expect(201);
    const createdId = idSchema.parse(created.body).id;
    expect(created.body).toMatchObject({
      email,
      isAdmin: false,
      orderCount: 0,
      seller: null,
    });
    expect(created.body).not.toHaveProperty('password');
    const sessions = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, createdId));
    expect(sessions).toHaveLength(0);

    await write('post', '/admin/users', actor.cookie, {
      name: 'Duplicate',
      email,
      password: 'Created-password-42!',
    }).expect(409);

    const search = await read(
      `/admin/users?search=${encodeURIComponent(email)}`,
      actor.cookie,
    ).expect(200);
    expect(search.body).toEqual([expect.objectContaining({ id: createdId })]);

    await write('patch', `/admin/users/${createdId}`, actor.cookie, {
      isAdmin: true,
    })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({ isAdmin: true }),
      );
    await write('patch', `/admin/users/${actor.id}`, actor.cookie, {
      isAdmin: false,
    }).expect(400);
    await write('delete', `/admin/users/${actor.id}`, actor.cookie).expect(400);
    await write('delete', `/admin/users/${createdId}`, actor.cookie).expect(
      204,
    );
    await read(`/admin/users/${createdId}`, actor.cookie).expect(404);
  });

  it('edits any product, lists orders, and cancels with stock restored', async () => {
    const actor = await admin();
    const customer = await account();
    const { product, seller, category } = await catalogue();

    await write('patch', `/admin/products/${product.id}`, actor.cookie, {
      stockQuantity: 2,
      discountPercent: 10,
    })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          stockQuantity: 2,
          discountPercent: 10,
        }),
      );

    const [order] = await db
      .insert(schema.orders)
      .values({ userId: customer.id, totalAmount: '20.00' })
      .returning();
    if (!order) throw new Error('Order fixture insert failed');
    await db.insert(schema.orderItems).values({
      orderId: order.id,
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: '20.00',
    });

    const list = await read(
      `/admin/orders?userId=${customer.id}`,
      actor.cookie,
    ).expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({ id: order.id, customerEmail: customer.email }),
    ]);
    const detail = await read(`/admin/orders/${order.id}`, actor.cookie).expect(
      200,
    );
    expect(detail.body).toMatchObject({
      id: order.id,
      items: [expect.objectContaining({ productId: product.id, quantity: 1 })],
    });
    await write('patch', `/admin/orders/${order.id}`, actor.cookie, {
      status: 'cancelled',
    })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({ status: 'cancelled' }),
      );
    const [restored] = await db
      .select({ stockQuantity: schema.products.stockQuantity })
      .from(schema.products)
      .where(eq(schema.products.id, product.id));
    expect(restored?.stockQuantity).toBe(3);

    const createdProduct = await write(
      'post',
      '/admin/products',
      actor.cookie,
      {
        name: 'Admin chair',
        categoryId: category.id,
        sellerId: seller.id,
        price: '5.00',
        stockQuantity: 1,
      },
    ).expect(201);
    const createdId = idSchema.parse(createdProduct.body).id;
    await write('post', '/admin/products', actor.cookie, {
      name: 'Orphan',
      categoryId: category.id,
      sellerId: randomUUID(),
      price: '5.00',
      stockQuantity: 1,
    }).expect(400);
    await write('delete', `/admin/products/${createdId}`, actor.cookie).expect(
      204,
    );
    await write('delete', `/admin/products/${createdId}`, actor.cookie).expect(
      404,
    );
  });

  it('imports products atomically and users with duplicates skipped', async () => {
    const actor = await admin();
    const { seller, category } = await catalogue();
    const valid = `Imported A,${category.id},${seller.id},1.00,1`;
    await write('post', '/admin/import/products', actor.cookie, {
      csv: `name,categoryId,sellerId,price,stockQuantity\n${valid}\nBad,${category.id},${randomUUID()},1.00,1`,
    }).expect(400);
    expect(
      await db.$count(
        schema.products,
        eq(schema.products.categoryId, category.id),
      ),
    ).toBe(1);
    await write('post', '/admin/import/products', actor.cookie, {
      csv: `name,categoryId,sellerId,price,stockQuantity\n${valid}\nImported B,${category.id},${seller.id},2.00,0`,
    })
      .expect(200)
      .expect({ created: 2 });

    const newEmail = `admin-import-${randomUUID()}@example.test`;
    emails.push(newEmail);
    const imported = await write('post', '/admin/import/users', actor.cookie, {
      csv: `name,email,password,isAdmin\nNew,${newEmail},Import-password-42!,false\nOld,${actor.email},Import-password-42!,`,
    }).expect(200);
    expect(imported.body).toEqual({
      created: 1,
      skipped: [{ row: 3, message: `${actor.email} already exists` }],
    });
  });

  it('imports seller CSV into the signed-in store and rejects foreign ownership and invalid rows', async () => {
    const { owner, seller, category } = await catalogue();
    const other = await catalogue();
    const csv = `name,categoryId,price,stockQuantity\nSeller item,${category.id},12.50,2`;
    await request(app.getHttpServer())
      .post('/seller/import/products')
      .send({ csv })
      .expect(401);
    await request(app.getHttpServer())
      .post('/seller/import/products')
      .set('Cookie', owner.cookie)
      .send({ csv })
      .expect(403);
    await write('post', '/seller/import/products', owner.cookie, {
      csv: `name,categoryId,sellerId,price,stockQuantity\nBad,${category.id},${other.seller.id},1.00,1`,
    }).expect(400);
    await write('post', '/seller/import/products', owner.cookie, {
      csv: `${csv}\nBad,${category.id},bad,1`,
    }).expect(400);
    await write('post', '/seller/import/products', owner.cookie, { csv })
      .expect(200)
      .expect({ created: 1 });
    const rows = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.sellerId, seller.id));
    expect(rows.map((row) => row.name)).toContain('Seller item');
    expect(rows).toHaveLength(2);
  });

  it('applies and deletes batches atomically with seller ownership enforcement', async () => {
    const one = await catalogue();
    const two = await catalogue();
    const actor = await admin();
    const ids = [one.product.id, two.product.id];
    await write('post', '/seller/products/bulk/discount', one.owner.cookie, {
      ids,
      discountPercent: 25,
    }).expect(404);
    expect(
      (
        await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, one.product.id))
      )[0]?.discountPercent,
    ).toBe(0);
    await write('post', '/seller/products/bulk/discount', one.owner.cookie, {
      ids: [one.product.id],
      discountPercent: 10,
    })
      .expect(200)
      .expect({ changed: 1 });
    expect(
      (
        await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, one.product.id))
      )[0]?.discountPercent,
    ).toBe(10);
    await write('post', '/seller/products/bulk/delete', one.owner.cookie, {
      ids,
    }).expect(404);
    expect(
      await db.$count(schema.products, inArray(schema.products.id, ids)),
    ).toBe(2);
    await write('post', '/seller/products/bulk/discount', one.owner.cookie, {
      ids: [one.product.id, one.product.id],
      discountPercent: 25,
    }).expect(400);
    await write('post', '/admin/products/bulk/discount', actor.cookie, {
      ids,
      discountPercent: 101,
    }).expect(400);
    await write('post', '/admin/products/bulk/discount', actor.cookie, {
      ids,
      discountPercent: 25,
    })
      .expect(200)
      .expect({ changed: 2 });
    const updated = await db
      .select()
      .from(schema.products)
      .where(inArray(schema.products.id, ids));
    expect(updated.map((row) => row.discountPercent)).toEqual([25, 25]);
    await write('post', '/seller/products/bulk/delete', one.owner.cookie, {
      ids: [one.product.id],
    })
      .expect(200)
      .expect({ changed: 1 });
    await write('post', '/admin/products/bulk/delete', actor.cookie, {
      ids: [two.product.id],
    })
      .expect(200)
      .expect({ changed: 1 });
    expect(
      await db.$count(schema.products, inArray(schema.products.id, ids)),
    ).toBe(0);
  });

  it('exports only the current seller’s product data', async () => {
    const one = await catalogue();
    const two = await catalogue();
    await request(app.getHttpServer()).get('/seller/export/backup').expect(401);
    const backup = await read('/seller/export/backup', one.owner.cookie)
      .expect(200)
      .expect('Cache-Control', /no-store/);
    const body = z
      .object({
        seller: z.object({ id: z.uuid() }),
        products: z.array(z.object({ id: z.uuid() })),
        categories: z.array(z.object({ id: z.uuid() })),
        images: z.array(z.unknown()),
      })
      .parse(backup.body);
    expect(body.seller.id).toBe(one.seller.id);
    expect(body.products.map((item) => item.id)).toEqual([one.product.id]);
    expect(body.categories.map((item) => item.id)).toEqual([one.category.id]);
    expect(JSON.stringify(body)).not.toContain(two.product.id);
    expect(JSON.stringify(body)).not.toMatch(/password|token/i);
  });

  it('exports CSV and JSON without credentials and returns stats', async () => {
    const actor = await admin();
    const stats = await read('/admin/stats', actor.cookie).expect(200);
    const parsedStats = z
      .object({
        users: z.number().int(),
        admins: z.number().int(),
        revenue: z.string().regex(/^\d+(\.\d+)?$/),
      })
      .parse(stats.body);
    expect(parsedStats.admins).toBeGreaterThanOrEqual(1);

    const csv = await read('/admin/export/users?format=csv', actor.cookie)
      .expect(200)
      .expect('Content-Type', /text\/csv/);
    expect(csv.text.split('\r\n')[0]).toBe(
      'id,name,email,emailVerified,isAdmin,createdAt',
    );
    expect(csv.text).toContain(actor.email);
    expect(csv.text).not.toMatch(/password/i);

    const backup = await read('/admin/export/backup', actor.cookie).expect(200);
    expect(backup.headers['content-disposition']).toMatch(/attachment/);
    const backupBody = z.record(z.string(), z.unknown()).parse(backup.body);
    expect(Object.keys(backupBody)).toEqual(
      expect.arrayContaining([
        'products',
        'users',
        'orders',
        'orderItems',
        'images',
        'carts',
        'cartItems',
        'favourites',
        'productViews',
        'ratings',
      ]),
    );
    expect(JSON.stringify(backupBody)).not.toMatch(/password|token/i);
  });
});
