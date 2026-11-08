import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import request from 'supertest';
import { CartModule } from '../src/cart/cart.module';
import { OrdersModule } from '../src/orders/orders.module';
import { DatabaseService } from '../src/db/database/database.service';
import { configureApp } from '../src/configure-app';
import { testEnvSchema } from '../src/config/test-env.schema';
import * as schema from '../src/db/schema';

const environment = testEnvSchema.safeParse(process.env);
if (!environment.success) {
  throw new Error('Cart/order integration tests require local store_test');
}
const client = postgres(environment.data.TEST_DATABASE_URL, {
  ssl: false,
  connect_timeout: 10,
  max: 8,
});
const db = drizzle(client, { schema });
const origin = 'http://localhost:3000';
const emails: string[] = [];
const userIds = new Set<string>();
const orderIds = new Set<string>();
const categoryIds = new Set<string>();
let app: NestExpressApplication;

type Buyer = { id: string; cookie: string };
type ItemResponse = { id: string; productId: string; quantity: number };
type OrderResponse = {
  id: string;
  status: string;
  totalAmount: string;
  items: {
    productId: string | null;
    productName: string;
    unitPrice: string;
    quantity: number;
  }[];
};

function bodyAs<T>(response: { body: unknown }): T {
  return response.body as T;
}

function cookieFrom(response: { headers: Record<string, unknown> }): string {
  const cookies = response.headers['set-cookie'];
  if (
    !Array.isArray(cookies) ||
    cookies.some((cookie: unknown) => typeof cookie !== 'string')
  ) {
    throw new Error('Signup response is missing session cookies');
  }
  return (cookies as string[]).map((cookie) => cookie.split(';')[0]).join('; ');
}

async function buyer(): Promise<Buyer> {
  const email = `cart-orders-${randomUUID()}@example.test`;
  emails.push(email);
  const response = await request(app.getHttpServer())
    .post('/api/auth/sign-up/email')
    .set('Origin', origin)
    .send({
      name: 'Cart integration buyer',
      email,
      password: 'Fake-test-password-42!',
    });
  const [user] = await client<
    { id: string }[]
  >`SELECT id FROM "user" WHERE email = ${email}`;
  if (user) userIds.add(user.id);
  expect(response.status).toBe(200);
  if (!user) throw new Error('Signup user was not persisted');
  return { id: user.id, cookie: cookieFrom(response) };
}

async function product(stock = 10, price = '19.99', discount = 15) {
  const seller = await buyer();
  const categoryId = randomUUID();
  categoryIds.add(categoryId);
  await client`INSERT INTO categories (id, name) VALUES (${categoryId}, ${`Cart category ${categoryId}`})`;
  const sellerId = randomUUID();
  await client`INSERT INTO seller_profiles (id, user_id, store_name) VALUES (${sellerId}, ${seller.id}, ${`Cart store ${sellerId}`})`;
  const productId = randomUUID();
  const name = `Cart keyboard ${productId}`;
  await client`
    INSERT INTO products (id, name, seller_id, category_id, stock_quantity, price, discount_percent)
    VALUES (${productId}, ${name}, ${sellerId}, ${categoryId}, ${stock}, ${price}, ${discount})
  `;
  return { id: productId, name, seller };
}

async function add(buyer: Buyer, productId: string, quantity: number) {
  const response = await request(app.getHttpServer())
    .post('/cart/items')
    .set('Cookie', buyer.cookie)
    .set('Origin', origin)
    .send({ productId, quantity });
  return response;
}

async function checkout(buyer: Buyer, key: string = randomUUID()) {
  const response = await request(app.getHttpServer())
    .post('/orders')
    .set('Cookie', buyer.cookie)
    .set('Origin', origin)
    .set('Idempotency-Key', key)
    .send({});
  if (response.status === 201) orderIds.add(bodyAs<OrderResponse>(response).id);
  return response;
}

async function stock(productId: string) {
  const [product] = await client<
    { stock_quantity: number }[]
  >`SELECT stock_quantity FROM products WHERE id = ${productId}`;
  return product?.stock_quantity;
}

beforeAll(async () => {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        ignoreEnvVars: true,
        load: [
          () => ({
            DATABASE_URL: environment.data.TEST_DATABASE_URL,
            BETTER_AUTH_URL: origin,
            BETTER_AUTH_SECRET:
              'fake-cart-orders-secret-at-least-thirty-two-characters',
          }),
        ],
      }),
      CartModule,
      OrdersModule,
    ],
  })
    .overrideProvider(DatabaseService)
    .useValue({ db })
    .compile();
  app = module.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  configureApp(app);
  await app.init();
}, 30_000);

afterAll(async () => {
  try {
    // Discover only this suite's tracked signup fixtures if a request failed mid-test.
    for (const email of emails) {
      const rows = await client<
        { id: string }[]
      >`SELECT id FROM "user" WHERE email = ${email}`;
      for (const row of rows) userIds.add(row.id);
    }
    for (const userId of userIds) {
      const rows = await client<
        { id: string }[]
      >`SELECT id FROM orders WHERE user_id = ${userId}`;
      for (const row of rows) orderIds.add(row.id);
    }
    for (const id of orderIds)
      await client`DELETE FROM orders WHERE id = ${id}`;
    for (const id of userIds) await client`DELETE FROM "user" WHERE id = ${id}`;
    for (const id of categoryIds)
      await client`DELETE FROM categories WHERE id = ${id}`;
  } finally {
    if (app) await app.close();
    await client.end({ timeout: 5 });
  }
}, 30_000);

describe('Guarded cart and order routes', () => {
  it('requires a real session and a trusted origin for every write', async () => {
    const owner = await buyer();
    for (const path of ['/cart', '/orders', `/orders/${randomUUID()}`]) {
      await request(app.getHttpServer()).get(path).expect(401);
    }
    const paths = [
      ['post', '/cart/items', { productId: randomUUID(), quantity: 1 }],
      ['patch', `/cart/items/${randomUUID()}`, { quantity: 1 }],
      ['delete', `/cart/items/${randomUUID()}`, {}],
      ['post', '/orders', {}],
      ['patch', `/orders/${randomUUID()}`, { status: 'cancelled' }],
    ] as const;
    for (const [method, path, body] of paths) {
      await request(app.getHttpServer())
        [method](path)
        .set('Origin', origin)
        .send(body)
        .expect(401);
      await request(app.getHttpServer())
        [method](path)
        .set('Cookie', owner.cookie)
        .send(body)
        .expect(403);
      await request(app.getHttpServer())
        [method](path)
        .set('Cookie', owner.cookie)
        .set('Origin', 'https://untrusted.example.test')
        .send(body)
        .expect(403);
    }
  });

  it('validates quantities, UUIDs, pagination and checkout bodies', async () => {
    const owner = await buyer();
    const item = await product();
    for (const quantity of [0, -1, 1.1, 1000, '1']) {
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Cookie', owner.cookie)
        .set('Origin', origin)
        .send({ productId: item.id, quantity })
        .expect(400);
    }
    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Cookie', owner.cookie)
      .set('Origin', origin)
      .send({ productId: 'invalid', quantity: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .get('/cart?limit=101')
      .set('Cookie', owner.cookie)
      .expect(400);
    await request(app.getHttpServer())
      .get('/orders?page=0')
      .set('Cookie', owner.cookie)
      .expect(400);
    await request(app.getHttpServer())
      .get('/orders/not-a-uuid')
      .set('Cookie', owner.cookie)
      .expect(400);
    await request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', owner.cookie)
      .set('Origin', origin)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', owner.cookie)
      .set('Origin', origin)
      .set('Idempotency-Key', 'invalid')
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post('/orders')
      .set('Cookie', owner.cookie)
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({ totalAmount: '0.00' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/orders/${randomUUID()}`)
      .set('Cookie', owner.cookie)
      .set('Origin', origin)
      .send({ status: 'paid' })
      .expect(400);
    expect((await add(owner, randomUUID(), 1)).status).toBe(404);
  });

  it('serializes concurrent first-cart additions without losing quantities', async () => {
    const owner = await buyer();
    const item = await product(20);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => add(owner, item.id, 1)),
    );
    expect(results.map((result) => result.status)).toEqual(Array(8).fill(201));
    const response = await request(app.getHttpServer())
      .get('/cart')
      .set('Cookie', owner.cookie)
      .expect(200);
    const cart = bodyAs<{ items: ItemResponse[] }>(response);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(8);
    expect(await stock(item.id)).toBe(20);
  });

  it('enforces ownership and stock on cart updates and deletion', async () => {
    const owner = await buyer();
    const other = await buyer();
    const item = await product(3);
    const added = await add(owner, item.id, 2);
    expect(added.status).toBe(201);
    const id = bodyAs<ItemResponse>(added).id;
    expect((await add(owner, item.id, 2)).status).toBe(409);
    await request(app.getHttpServer())
      .patch(`/cart/items/${id}`)
      .set('Cookie', other.cookie)
      .set('Origin', origin)
      .send({ quantity: 1 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/cart/items/${id}`)
      .set('Cookie', other.cookie)
      .set('Origin', origin)
      .expect(404);
    const otherCart = await request(app.getHttpServer())
      .get('/cart')
      .set('Cookie', other.cookie)
      .expect(200);
    expect(bodyAs<{ items: unknown[] }>(otherCart).items).toEqual([]);
    await request(app.getHttpServer())
      .patch(`/cart/items/${id}`)
      .set('Cookie', owner.cookie)
      .set('Origin', origin)
      .send({ quantity: 4 })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/cart/items/${id}`)
      .set('Cookie', owner.cookie)
      .set('Origin', origin)
      .send({ quantity: 3 })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/cart/items/${id}`)
      .set('Cookie', owner.cookie)
      .set('Origin', origin)
      .expect(204);
    const empty = await request(app.getHttpServer())
      .get('/cart')
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(bodyAs<{ items: unknown[] }>(empty).items).toEqual([]);
    expect(await stock(item.id)).toBe(3);
  });

  it('checks out exact discounted snapshots and replays the same UUID key once', async () => {
    const owner = await buyer();
    const other = await buyer();
    const item = await product(10);
    expect((await add(owner, item.id, 3)).status).toBe(201);
    const key = randomUUID();
    const responses = await Promise.all([
      checkout(owner, key),
      checkout(owner, key),
    ]);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    const order = bodyAs<OrderResponse>(responses[0]);
    expect(bodyAs<OrderResponse>(responses[1]).id).toBe(order.id);
    expect(responses[0].headers.location).toBe(`/orders/${order.id}`);
    expect(order).toMatchObject({
      status: 'pending',
      totalAmount: '50.97',
      items: [
        {
          productId: item.id,
          productName: item.name,
          quantity: 3,
          unitPrice: '16.99',
        },
      ],
    });
    expect(await stock(item.id)).toBe(7);
    const cart = await request(app.getHttpServer())
      .get('/cart')
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(bodyAs<{ items: unknown[] }>(cart).items).toEqual([]);
    await client`UPDATE products SET name = ${'Changed keyboard'}, price = ${'1.00'} WHERE id = ${item.id}`;
    expect((await add(owner, item.id, 1)).status).toBe(201);
    const retry = await checkout(owner, key.toUpperCase());
    expect(retry.status).toBe(201);
    expect(bodyAs<OrderResponse>(retry)).toEqual(order);
    expect(await stock(item.id)).toBe(7);
    await request(app.getHttpServer())
      .get(`/orders/${order.id}`)
      .set('Cookie', other.cookie)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/orders/${order.id}`)
      .set('Cookie', other.cookie)
      .set('Origin', origin)
      .send({ status: 'cancelled' })
      .expect(404);
    const own = await request(app.getHttpServer())
      .get('/orders?status=pending')
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(bodyAs<{ id: string }[]>(own).map((value) => value.id)).toEqual([
      order.id,
    ]);
    const foreign = await request(app.getHttpServer())
      .get('/orders')
      .set('Cookie', other.cookie)
      .expect(200);
    expect(foreign.body).toEqual([]);
    const cancelled = await Promise.all(
      Array.from({ length: 3 }, () =>
        request(app.getHttpServer())
          .patch(`/orders/${order.id}`)
          .set('Cookie', owner.cookie)
          .set('Origin', origin)
          .send({ status: 'cancelled' }),
      ),
    );
    expect(cancelled.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
    expect(await stock(item.id)).toBe(10);
    expect(bodyAs<OrderResponse>(cancelled[0]).items[0].productName).toBe(
      item.name,
    );
    expect(bodyAs<OrderResponse>(await checkout(owner, key)).status).toBe(
      'cancelled',
    );
    expect(await stock(item.id)).toBe(10);
  });

  it('prevents concurrent buyers from overselling and rolls back the losing cart', async () => {
    const first = await buyer();
    const second = await buyer();
    const item = await product(1, '0.01', 50);
    expect((await add(first, item.id, 1)).status).toBe(201);
    expect((await add(second, item.id, 1)).status).toBe(201);
    const responses = await Promise.all([checkout(first), checkout(second)]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await stock(item.id)).toBe(0);
    const winner = responses.findIndex((response) => response.status === 201);
    expect(bodyAs<OrderResponse>(responses[winner]).totalAmount).toBe('0.01');
    const loser = winner === 0 ? second : first;
    const cart = await request(app.getHttpServer())
      .get('/cart')
      .set('Cookie', loser.cookie)
      .expect(200);
    expect(bodyAs<{ items: unknown[] }>(cart).items).toHaveLength(1);
    const orders = await request(app.getHttpServer())
      .get('/orders')
      .set('Cookie', loser.cookie)
      .expect(200);
    expect(orders.body).toEqual([]);
  });

  it('rolls back all products if one checkout line has insufficient stock', async () => {
    const owner = await buyer();
    const first = await product(5);
    const second = await product(5);
    expect((await add(owner, first.id, 2)).status).toBe(201);
    expect((await add(owner, second.id, 2)).status).toBe(201);
    await client`UPDATE products SET stock_quantity = 1 WHERE id = ${second.id}`;
    expect((await checkout(owner)).status).toBe(409);
    expect(await stock(first.id)).toBe(5);
    expect(await stock(second.id)).toBe(1);
    const cart = await request(app.getHttpServer())
      .get('/cart')
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(bodyAs<{ items: unknown[] }>(cart).items).toHaveLength(2);
  });

  it('rejects an empty cart and overflowing order totals without stock changes', async () => {
    const owner = await buyer();
    expect((await checkout(owner)).status).toBe(409);
    const item = await product(2, '99999999.99', 0);
    expect((await add(owner, item.id, 2)).status).toBe(201);
    const overflow = await checkout(owner);
    expect(overflow.status).toBe(409);
    expect(bodyAs<{ message: string }>(overflow).message).toBe(
      'Order amount exceeds the permitted range',
    );
    expect(await stock(item.id)).toBe(2);
  });

  it('returns 409 and rolls back cancellation if seller stock cannot fit the restoration', async () => {
    const owner = await buyer();
    const items = [await product(2), await product(2)].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    for (const item of items) {
      expect((await add(owner, item.id, 2)).status).toBe(201);
    }
    const placed = await checkout(owner);
    expect(placed.status).toBe(201);
    const order = bodyAs<OrderResponse>(placed);
    await client`UPDATE products SET stock_quantity = 2147483647 WHERE id = ${items[1].id}`;
    const rejected = await request(app.getHttpServer())
      .patch(`/orders/${order.id}`)
      .set('Cookie', owner.cookie)
      .set('Origin', origin)
      .send({ status: 'cancelled' })
      .expect(409);
    expect(bodyAs<{ message: string }>(rejected).message).toBe(
      'Restored stock exceeds the permitted range',
    );
    expect(await stock(items[0].id)).toBe(0);
    expect(await stock(items[1].id)).toBe(2_147_483_647);
    const pending = await request(app.getHttpServer())
      .get(`/orders/${order.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(bodyAs<OrderResponse>(pending).status).toBe('pending');

    await client`UPDATE products SET stock_quantity = 2147483645 WHERE id = ${items[1].id}`;
    await request(app.getHttpServer())
      .patch(`/orders/${order.id}`)
      .set('Cookie', owner.cookie)
      .set('Origin', origin)
      .send({ status: 'cancelled' })
      .expect(200);
    expect(await stock(items[0].id)).toBe(2);
    expect(await stock(items[1].id)).toBe(2_147_483_647);
  });

  it('locks multiple products in one order and replays stable item ordering', async () => {
    const owner = await buyer();
    const first = await product(5, '0.05', 10);
    const second = await product(5, '2.00', 100);
    // Add in reverse ID order to exercise the checkout's own lock ordering.
    for (const item of [first, second].sort((left, right) =>
      right.id.localeCompare(left.id),
    )) {
      expect((await add(owner, item.id, 2)).status).toBe(201);
    }
    const key = randomUUID();
    const placed = await checkout(owner, key);
    expect(placed.status).toBe(201);
    const order = bodyAs<OrderResponse>(placed);
    expect(order.totalAmount).toBe('0.10');
    expect(order.items).toHaveLength(2);
    expect(bodyAs<OrderResponse>(await checkout(owner, key))).toEqual(order);
    expect(await stock(first.id)).toBe(3);
    expect(await stock(second.id)).toBe(3);
  });

  it('preserves snapshots and permits cancellation after a seller/product is deleted', async () => {
    const owner = await buyer();
    const item = await product(2);
    expect((await add(owner, item.id, 2)).status).toBe(201);
    const placed = await checkout(owner);
    expect(placed.status).toBe(201);
    const order = bodyAs<OrderResponse>(placed);
    await client`DELETE FROM "user" WHERE id = ${item.seller.id}`;
    const detail = await request(app.getHttpServer())
      .get(`/orders/${order.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(bodyAs<OrderResponse>(detail).items[0]).toMatchObject({
      productId: null,
      productName: item.name,
      unitPrice: '16.99',
    });
    await request(app.getHttpServer())
      .patch(`/orders/${order.id}`)
      .set('Cookie', owner.cookie)
      .set('Origin', origin)
      .send({ status: 'cancelled' })
      .expect(200);
    expect(await stock(item.id)).toBeUndefined();
  });
});
