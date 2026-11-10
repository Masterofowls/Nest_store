import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import request from 'supertest';
import { z } from 'zod';
import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import type { Environment } from '../src/config/env.schema';
import { testEnvSchema } from '../src/config/test-env.schema';
import { configureApp } from '../src/configure-app';
import { DatabaseService } from '../src/db/database/database.service';
import { DbModule } from '../src/db/db.module';
import * as schema from '../src/db/schema';
import { FavouritesModule } from '../src/favourites/favourites.module';
import { RatingsModule } from '../src/ratings/ratings.module';
import { RecommendationsModule } from '../src/recommendations/recommendations.module';
import { UsersModule } from '../src/users/users.module';
import { ViewsModule } from '../src/views/views.module';

const environment = testEnvSchema.safeParse(process.env);
if (!environment.success) {
  throw new Error(
    'Collections integration requires local TEST_DATABASE_URL for store_test',
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
  BETTER_AUTH_SECRET:
    'fake-collections-test-secret-at-least-thirty-two-characters',
  BETTER_AUTH_URL: origin,
});
const idSchema = z.object({ id: z.string() });
const favouriteSchema = z.object({
  id: z.uuid(),
  productId: z.uuid().nullable(),
  productName: z.string(),
});
const ratingSchema = favouriteSchema.extend({
  score: z.number().int(),
  comment: z.string().nullable(),
});
const viewSchema = z.object({ id: z.uuid(), productId: z.uuid() });
const recommendationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  coViewers: z.number().int().positive(),
});
let app: NestExpressApplication;
let emails: string[] = [];
let categoryIds: string[] = [];
let orderIds: string[] = [];

async function buyer() {
  const email = `collections-${randomUUID()}@example.test`;
  emails.push(email);
  const signup = await request(app.getHttpServer())
    .post('/api/auth/sign-up/email')
    .set('Origin', origin)
    .send({
      name: 'Collections buyer',
      email,
      password: 'Collections-test-password-42!',
    })
    .expect(200);
  const cookies = z.array(z.string()).parse(signup.headers['set-cookie']);
  const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
  const me = await request(app.getHttpServer())
    .get('/users/me')
    .set('Cookie', cookie)
    .expect(200);
  return { id: idSchema.parse(me.body).id, cookie, email };
}

async function catalogue(names = ['Keyboard']) {
  const owner = await buyer();
  const [category] = await db
    .insert(schema.categories)
    .values({ name: `collections-${randomUUID()}` })
    .returning();
  if (!category) throw new Error('Category fixture insert failed');
  categoryIds.push(category.id);
  const [seller] = await db
    .insert(schema.sellerProfiles)
    .values({
      userId: owner.id,
      storeName: `Collections ${randomUUID()}`,
    })
    .returning();
  if (!seller) throw new Error('Seller fixture insert failed');
  const products = await db
    .insert(schema.products)
    .values(
      names.map((name) => ({
        name,
        sellerId: seller.id,
        categoryId: category.id,
        price: '12.34',
        stockQuantity: 5,
      })),
    )
    .returning();
  return { owner, category, seller, products };
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

async function save(cookie: string, productId: string) {
  const response = await write('post', '/favourites', cookie, {
    productId,
  }).expect(201);
  expect(response.body).not.toHaveProperty('userId');
  return favouriteSchema.parse(response.body);
}

async function rate(cookie: string, productId: string, score = 4) {
  const response = await write('post', '/ratings', cookie, {
    productId,
    score,
  }).expect(201);
  expect(response.body).not.toHaveProperty('userId');
  return ratingSchema.parse(response.body);
}

async function record(cookie: string, productId: string) {
  const response = await write(
    'post',
    `/products/${productId}/views`,
    cookie,
  ).expect(201);
  expect(response.body).not.toHaveProperty('userId');
  return viewSchema.parse(response.body);
}

beforeAll(async () => {
  const fixture = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      DbModule,
      AuthModule,
      UsersModule,
      FavouritesModule,
      RatingsModule,
      ViewsModule,
      RecommendationsModule,
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
  expect(app.get(AuthService).auth).toBeDefined();
  configureApp(app);
  await app.init();
});

beforeEach(() => {
  emails = [];
  categoryIds = [];
  orderIds = [];
});

afterEach(async () => {
  for (const id of orderIds) {
    await db.delete(schema.orders).where(eq(schema.orders.id, id));
  }
  for (const email of emails) {
    await db.delete(schema.user).where(eq(schema.user.email, email));
  }
  for (const id of categoryIds) {
    await db.delete(schema.categories).where(eq(schema.categories.id, id));
  }
});

afterAll(async () => {
  try {
    await app?.close();
  } finally {
    await client.end({ timeout: 5 });
  }
});

describe('Collections with real Better Auth and local PostgreSQL', () => {
  it('saves only own favourites, maps duplicates, and retains deleted product snapshots', async () => {
    const {
      products: [product],
    } = await catalogue();
    const actor = await buyer();
    const other = await buyer();
    await request(app.getHttpServer()).get('/favourites').expect(401);
    await request(app.getHttpServer())
      .post('/favourites')
      .send({ productId: product.id })
      .expect(401);
    await request(app.getHttpServer())
      .post('/favourites')
      .set('Cookie', actor.cookie)
      .send({ productId: product.id })
      .expect(403);
    await write('post', '/favourites', actor.cookie, {
      productId: product.id,
      userId: other.id,
    }).expect(400);
    await write('post', '/favourites', actor.cookie, {
      productId: 'invalid',
    }).expect(400);
    await write('post', '/favourites', actor.cookie, {
      productId: randomUUID(),
    }).expect(404);
    const attempts = await Promise.all([
      write('post', '/favourites', actor.cookie, { productId: product.id }),
      write('post', '/favourites', actor.cookie, { productId: product.id }),
    ]);
    expect(attempts.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const success = attempts.find((response) => response.status === 201);
    if (!success) throw new Error('No successful favourite insert');
    const favourite = favouriteSchema.parse(success.body);
    expect(success.headers.location).toBe(`/favourites/${favourite.id}`);
    expect(success.body).not.toHaveProperty('userId');
    const empty = await request(app.getHttpServer())
      .get('/favourites')
      .set('Cookie', other.cookie)
      .expect(200);
    expect(empty.body).toEqual([]);
    await write('delete', `/favourites/${favourite.id}`, other.cookie).expect(
      404,
    );
    await write('delete', '/favourites/invalid', actor.cookie).expect(400);
    await request(app.getHttpServer())
      .get('/favourites?limit=101')
      .set('Cookie', actor.cookie)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/favourites?userId=${other.id}`)
      .set('Cookie', actor.cookie)
      .expect(400);
    await db.delete(schema.products).where(eq(schema.products.id, product.id));
    const saved = await request(app.getHttpServer())
      .get('/favourites?search=Keyboard&limit=1')
      .set('Cookie', actor.cookie)
      .expect(200);
    expect(saved.body).toEqual([
      expect.objectContaining({
        id: favourite.id,
        productId: null,
        productName: product.name,
      }),
    ]);
    await write('delete', `/favourites/${favourite.id}`, actor.cookie, {
      userId: other.id,
    }).expect(400);
    await write('delete', `/favourites/${favourite.id}`, actor.cookie).expect(
      204,
    );
    await write('delete', `/favourites/${favourite.id}`, actor.cookie).expect(
      404,
    );
  });

  it('publishes safe ratings, enforces ownership and bounds, and refreshes snapshots on edits', async () => {
    const {
      products: [product],
    } = await catalogue();
    const actor = await buyer();
    const other = await buyer();
    await request(app.getHttpServer())
      .post('/ratings')
      .send({ productId: product.id, score: 5 })
      .expect(401);
    await request(app.getHttpServer())
      .post('/ratings')
      .set('Cookie', actor.cookie)
      .set('Origin', 'https://untrusted.example')
      .send({ productId: product.id, score: 5 })
      .expect(403);
    for (const score of [0, 6, 1.5, '5']) {
      await write('post', '/ratings', actor.cookie, {
        productId: product.id,
        score,
      }).expect(400);
    }
    await write('post', '/ratings', actor.cookie, {
      productId: product.id,
      score: 4,
      comment: 'x'.repeat(2001),
    }).expect(400);
    await write('post', '/ratings', actor.cookie, {
      productId: product.id,
      score: 4,
      productName: 'Fabricated',
    }).expect(400);
    await write('post', '/ratings', actor.cookie, {
      productId: randomUUID(),
      score: 4,
    }).expect(404);
    const attempts = await Promise.all([
      write('post', '/ratings', actor.cookie, {
        productId: product.id,
        score: 4,
        comment: 'Accurate keys',
      }),
      write('post', '/ratings', actor.cookie, {
        productId: product.id,
        score: 4,
        comment: 'Accurate keys',
      }),
    ]);
    expect(attempts.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const success = attempts.find((response) => response.status === 201);
    if (!success) throw new Error('No successful rating insert');
    const rating = ratingSchema.parse(success.body);
    expect(success.headers.location).toBe(`/ratings/${rating.id}`);
    const publicList = await request(app.getHttpServer())
      .get(`/products/${product.id}/ratings?limit=1`)
      .expect(200);
    expect(z.array(ratingSchema).parse(publicList.body)).toEqual([rating]);
    for (const value of z
      .array(z.record(z.string(), z.unknown()))
      .parse(publicList.body)) {
      expect(value).not.toHaveProperty('userId');
    }
    await request(app.getHttpServer())
      .get('/products/invalid/ratings')
      .expect(400);
    await request(app.getHttpServer())
      .get(`/products/${randomUUID()}/ratings`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/products/${product.id}/ratings?limit=101`)
      .expect(400);
    await request(app.getHttpServer()).get('/ratings').expect(401);
    const otherList = await request(app.getHttpServer())
      .get('/ratings')
      .set('Cookie', other.cookie)
      .expect(200);
    expect(otherList.body).toEqual([]);
    await write('patch', `/ratings/${rating.id}`, other.cookie, {
      score: 1,
    }).expect(404);
    await write('delete', `/ratings/${rating.id}`, other.cookie).expect(404);
    await write('patch', `/ratings/${rating.id}`, actor.cookie).expect(400);
    await write('patch', `/ratings/${rating.id}`, actor.cookie, {
      score: 6,
    }).expect(400);
    await write('patch', '/ratings/invalid', actor.cookie, { score: 5 }).expect(
      400,
    );
    await write('patch', `/ratings/${rating.id}`, actor.cookie, {
      score: 5,
      userId: other.id,
    }).expect(400);
    const otherRating = await rate(other.cookie, product.id, 3);
    const bothRatings = await request(app.getHttpServer())
      .get(`/products/${product.id}/ratings?limit=100`)
      .expect(200);
    expect(
      z
        .array(ratingSchema)
        .parse(bothRatings.body)
        .map((value) => value.id)
        .sort(),
    ).toEqual([rating.id, otherRating.id].sort());
    await db
      .update(schema.products)
      .set({ name: 'Revised keyboard' })
      .where(eq(schema.products.id, product.id));
    const updated = await write(
      'patch',
      `/ratings/${rating.id}`,
      actor.cookie,
      { score: 5, comment: null },
    ).expect(200);
    expect(ratingSchema.parse(updated.body)).toMatchObject({
      score: 5,
      comment: null,
      productName: 'Revised keyboard',
    });
    await db.delete(schema.products).where(eq(schema.products.id, product.id));
    const own = await request(app.getHttpServer())
      .get('/ratings')
      .set('Cookie', actor.cookie)
      .expect(200);
    expect(z.array(ratingSchema).parse(own.body)).toEqual([
      expect.objectContaining({
        productId: null,
        productName: 'Revised keyboard',
        score: 5,
      }),
    ]);
    await write('patch', `/ratings/${rating.id}`, actor.cookie, {
      score: 3,
    }).expect(404);
    await write('delete', `/ratings/${rating.id}`, actor.cookie, {
      score: 3,
    }).expect(400);
    await write('delete', `/ratings/${rating.id}`, actor.cookie).expect(204);
  });

  it('records repeatable real views and recommends by distinct shared viewers only', async () => {
    const {
      products: [target, popular, second, tied, unrelated],
    } = await catalogue([
      'Target keyboard',
      'Popular keyboard',
      'Second keyboard',
      'Tied keyboard',
      'Unrelated keyboard',
    ]);
    const actor = await buyer();
    const other = await buyer();
    const isolated = await buyer();
    await request(app.getHttpServer())
      .post(`/products/${target.id}/views`)
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .post(`/products/${target.id}/views`)
      .set('Cookie', actor.cookie)
      .send({})
      .expect(403);
    await write('post', `/products/${target.id}/views`, actor.cookie, {
      userId: other.id,
    }).expect(400);
    await write('post', '/products/invalid/views', actor.cookie).expect(400);
    await write('post', `/products/${randomUUID()}/views`, actor.cookie).expect(
      404,
    );
    const initial = await request(app.getHttpServer())
      .get(`/products/${target.id}/recommendations`)
      .expect(200);
    expect(initial.body).toEqual([]);
    const first = await record(actor.cookie, target.id);
    const repeat = await record(actor.cookie, target.id);
    expect(first.id).not.toBe(repeat.id);
    await record(actor.cookie, popular.id);
    await record(actor.cookie, popular.id);
    await record(actor.cookie, second.id);
    await record(actor.cookie, tied.id);
    await record(other.cookie, target.id);
    await record(other.cookie, popular.id);
    await record(other.cookie, popular.id);
    await record(isolated.cookie, unrelated.id);
    // Anonymous events have no durable shared viewer identity.
    await db
      .insert(schema.productViews)
      .values([{ productId: target.id }, { productId: unrelated.id }]);
    const recommendations = await request(app.getHttpServer())
      .get(`/products/${target.id}/recommendations`)
      .expect(200);
    const parsed = z.array(recommendationSchema).parse(recommendations.body);
    expect(parsed[0]).toMatchObject({
      id: popular.id,
      name: popular.name,
      coViewers: 2,
    });
    expect(parsed.slice(1).map((value) => value.id)).toEqual(
      [second.id, tied.id].sort(),
    );
    expect(parsed.slice(1).every((value) => value.coViewers === 1)).toBe(true);
    expect(parsed.map((value) => value.id)).not.toContain(target.id);
    expect(parsed.map((value) => value.id)).not.toContain(unrelated.id);
    for (const value of z
      .array(z.record(z.string(), z.unknown()))
      .parse(recommendations.body)) {
      expect(value).not.toHaveProperty('userId');
      expect(value).not.toHaveProperty('email');
    }
    const page = await request(app.getHttpServer())
      .get(`/products/${target.id}/recommendations?page=2&limit=1`)
      .expect(200);
    expect(z.array(recommendationSchema).parse(page.body)).toEqual([parsed[1]]);
    await request(app.getHttpServer())
      .get(`/products/${target.id}/recommendations?limit=101`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/products/${target.id}/recommendations?userId=${actor.id}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/products/invalid/recommendations')
      .expect(400);
    await request(app.getHttpServer())
      .get(`/products/${randomUUID()}/recommendations`)
      .expect(404);
    await request(app.getHttpServer()).get('/users/me/views').expect(401);
    const history = await request(app.getHttpServer())
      .get('/users/me/views?limit=100')
      .set('Cookie', actor.cookie)
      .expect(200);
    expect(z.array(viewSchema).parse(history.body)).toHaveLength(6);
    const otherHistory = await request(app.getHttpServer())
      .get('/users/me/views?limit=100')
      .set('Cookie', other.cookie)
      .expect(200);
    expect(z.array(viewSchema).parse(otherHistory.body)).toHaveLength(3);
    const historyPage = await request(app.getHttpServer())
      .get('/users/me/views?page=2&limit=2')
      .set('Cookie', actor.cookie)
      .expect(200);
    expect(historyPage.body).toEqual(
      z.array(z.unknown()).parse(history.body).slice(2, 4),
    );
    await request(app.getHttpServer())
      .get('/users/me/views?limit=101')
      .set('Cookie', actor.cookie)
      .expect(400);
    await db.delete(schema.products).where(eq(schema.products.id, popular.id));
    const afterDelete = await request(app.getHttpServer())
      .get(`/products/${target.id}/recommendations`)
      .expect(200);
    expect(
      z
        .array(recommendationSchema)
        .parse(afterDelete.body)
        .map((value) => value.id),
    ).not.toContain(popular.id);
    expect(
      await db
        .select()
        .from(schema.productViews)
        .where(eq(schema.productViews.productId, popular.id)),
    ).toEqual([]);
  });

  it('updates only the account name and deletes its sessions and marketplace data through existing cascades', async () => {
    const {
      owner: actor,
      products: [product],
      seller,
    } = await catalogue();
    const other = await buyer();
    await request(app.getHttpServer())
      .patch('/users/me')
      .send({ name: 'Renamed' })
      .expect(401);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', actor.cookie)
      .send({ name: 'Renamed' })
      .expect(403);
    for (const body of [
      {},
      { name: '' },
      { name: 'x'.repeat(101) },
      { name: 'Buyer', image: 'https://example.test/avatar.png' },
      { name: 'Buyer', email: 'changed@example.test' },
      { name: 'Buyer', isAdmin: true },
      { name: 'Buyer', id: other.id },
    ]) {
      await write('patch', '/users/me', actor.cookie, body).expect(400);
    }
    const updated = await write('patch', '/users/me', actor.cookie, {
      name: 'Renamed account',
    }).expect(200);
    expect(updated.body).toEqual({
      id: actor.id,
      name: 'Renamed account',
      email: actor.email,
      emailVerified: false,
      image: null,
      isAdmin: false,
    });
    const me = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', actor.cookie)
      .expect(200);
    expect(me.body).toEqual(updated.body);
    const otherMe = await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', other.cookie)
      .expect(200);
    expect(otherMe.body).toMatchObject({
      id: other.id,
      name: 'Collections buyer',
    });
    await save(actor.cookie, product.id);
    await rate(actor.cookie, product.id);
    await record(actor.cookie, product.id);
    const otherFavourite = await save(other.cookie, product.id);
    const otherRating = await rate(other.cookie, product.id);
    await record(other.cookie, product.id);
    const [cart] = await db
      .insert(schema.carts)
      .values({ userId: actor.id })
      .returning();
    if (!cart) throw new Error('Cart fixture insert failed');
    await db
      .insert(schema.cartItems)
      .values({ cartId: cart.id, productId: product.id, quantity: 1 });
    const [order] = await db
      .insert(schema.orders)
      .values({ userId: actor.id, totalAmount: '12.34' })
      .returning();
    if (!order) throw new Error('Order fixture insert failed');
    orderIds.push(order.id);
    await db.insert(schema.orderItems).values({
      orderId: order.id,
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: '12.34',
    });
    await request(app.getHttpServer()).delete('/users/me').expect(401);
    await request(app.getHttpServer())
      .delete('/users/me')
      .set('Cookie', actor.cookie)
      .expect(403);
    await write('delete', '/users/me', actor.cookie, { id: other.id }).expect(
      400,
    );
    await write('delete', '/users/me', actor.cookie).expect(204);
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', actor.cookie)
      .expect(401);
    await write('patch', '/users/me', actor.cookie, { name: 'Revived' }).expect(
      401,
    );
    for (const table of [
      schema.session,
      schema.account,
      schema.sellerProfiles,
      schema.carts,
      schema.favourites,
      schema.ratings,
      schema.productViews,
    ]) {
      expect(
        await db
          .select({ userId: table.userId })
          .from(table)
          .where(eq(table.userId, actor.id)),
      ).toEqual([]);
    }
    expect(
      await db
        .select()
        .from(schema.cartItems)
        .where(eq(schema.cartItems.cartId, cart.id)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.sellerId, seller.id)),
    ).toEqual([]);
    const [retainedOrder] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, order.id));
    expect(retainedOrder).toMatchObject({
      id: order.id,
      userId: null,
      totalAmount: '12.34',
    });
    const [retainedItem] = await db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, order.id));
    expect(retainedItem).toMatchObject({
      productId: null,
      productName: product.name,
      unitPrice: '12.34',
    });
    const retainedFavourites = await request(app.getHttpServer())
      .get('/favourites')
      .set('Cookie', other.cookie)
      .expect(200);
    expect(z.array(favouriteSchema).parse(retainedFavourites.body)).toEqual([
      { ...otherFavourite, productId: null },
    ]);
    const retainedRatings = await request(app.getHttpServer())
      .get('/ratings')
      .set('Cookie', other.cookie)
      .expect(200);
    expect(z.array(ratingSchema).parse(retainedRatings.body)).toEqual([
      { ...otherRating, productId: null },
    ]);
    const views = await request(app.getHttpServer())
      .get('/users/me/views')
      .set('Cookie', other.cookie)
      .expect(200);
    expect(views.body).toEqual([]);
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', other.cookie)
      .expect(200);
  });
});
