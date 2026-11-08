import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { testEnvSchema } from '../src/config/test-env.schema';
import { user, session, account, verification } from '../src/db/schema';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { UsersModule } from '../src/users/users.module';
import { AuthService } from '../src/auth/auth.service';
import { DatabaseService } from '../src/db/database/database.service';
import { configureApp } from '../src/configure-app';
import request from 'supertest';
import { ProductsModule } from '../src/products/products.module';
import { SellersModule } from '../src/sellers/sellers.module';
import * as schema from '../src/db/schema';
import type { Product } from '../src/db/schema';

const result = testEnvSchema.safeParse(process.env);

if (!result.success) {
  throw new Error(
    'Auth integration tests require a valid local TEST_DATABASE_URL',
  );
}

const client = postgres(result.data.TEST_DATABASE_URL, {
  ssl: false,
  connect_timeout: 10,
  max: 1,
});
const authSchema = { user, session, account, verification };
const db = drizzle(client, { schema });
const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
  secret: 'fake-test-secret-with-at-least-thirty-two-characters',
  baseURL: 'http://localhost:3000',
  emailAndPassword: { enabled: true },
});
const password = 'Integration-test-password-42!';
let emails: string[] = [];
let app: NestExpressApplication;
let categoryIds: string[] = [];
let orderIds: string[] = [];

function testEmail(): string {
  const email = `auth-test-${randomUUID()}@example.test`;
  emails.push(email);
  return email;
}

function send(path: string, body?: object, cookie?: string): Promise<Response> {
  const headers = new Headers({ origin: 'http://localhost:3000' });
  if (body) {
    headers.set('content-type', 'application/json');
  }
  if (cookie) {
    headers.set('cookie', cookie);
  }
  return auth.handler(
    new Request(`http://localhost:3000/api/auth/${path}`, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

function sessionCookie(response: Response | string[]): string {
  const cookies =
    response instanceof Response ? response.headers.getSetCookie() : response;
  expect(cookies.some((cookie) => cookie.includes('session_token='))).toBe(
    true,
  );
  expect(cookies.some((cookie) => /httponly/i.test(cookie))).toBe(true);
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

function httpSessionCookie(response: {
  headers: Record<string, unknown>;
}): string {
  const cookies = response.headers['set-cookie'];
  if (!Array.isArray(cookies)) {
    throw new Error('Signup response is missing Set-Cookie headers');
  }
  return sessionCookie(
    cookies.map((value: unknown) => {
      if (typeof value !== 'string') {
        throw new Error('Signup Set-Cookie header must be a string');
      }
      return value;
    }),
  );
}

function responseId(response: { body: unknown }): string {
  const body = response.body;
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    typeof body.id !== 'string'
  ) {
    throw new Error('Response is missing a resource ID');
  }
  return body.id;
}

async function signedInBuyer() {
  const email = testEmail();
  const signup = await request(app.getHttpServer())
    .post('/api/auth/sign-up/email')
    .set('Origin', 'http://localhost:3000')
    .send({ name: 'Integration buyer', email, password })
    .expect(200);
  const users = await client<
    { id: string }[]
  >`SELECT id FROM "user" WHERE email = ${email}`;
  expect(users).toHaveLength(1);
  return { cookie: httpSessionCookie(signup), userId: users[0].id, email };
}

async function createCategory(): Promise<string> {
  const id = randomUUID();
  categoryIds.push(id);
  await client`INSERT INTO categories (id, name) VALUES (${id}, ${`Test category ${id}`})`;
  return id;
}

async function createSeller(cookie: string) {
  const storeName = `Test electronics ${randomUUID()}`;
  const response = await request(app.getHttpServer())
    .post('/sellers')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', cookie)
    .send({ storeName })
    .expect(201);
  const id = responseId(response);
  expect(response.headers.location).toBe(`/sellers/${id}`);
  const body: unknown = response.body;
  expect(body).not.toHaveProperty('userId');
  return { id, storeName };
}

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [UsersModule, SellersModule, ProductsModule],
  })
    .overrideProvider(AuthService)
    .useValue({ auth })
    .overrideProvider(DatabaseService)
    .useValue({ db })
    .compile();

  app = moduleFixture.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
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
    await client`DELETE FROM orders WHERE id = ${id}`;
  }
  for (const email of emails) {
    const deleted = await client<{ id: string }[]>`
      DELETE FROM "user" WHERE email = ${email} RETURNING id
    `;
    for (const { id } of deleted) {
      expect(
        await client`SELECT id FROM account WHERE user_id = ${id}`,
      ).toEqual([]);
      expect(
        await client`SELECT id FROM session WHERE user_id = ${id}`,
      ).toEqual([]);
    }
    expect(await client`SELECT id FROM "user" WHERE email = ${email}`).toEqual(
      [],
    );
  }
  for (const id of categoryIds) {
    await client`DELETE FROM categories WHERE id = ${id}`;
  }
});

afterAll(async () => {
  try {
    await app?.close();
  } finally {
    await client.end({ timeout: 5 });
  }
});

describe('Better Auth local PostgreSQL integration', () => {
  it('returns the public profile through Nest and rejects the cookie after sign-out', async () => {
    const email = testEmail();
    const signup = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Integration buyer', email, password })
      .expect(200);

    const cookie = httpSessionCookie(signup);
    const users = await client<{ id: string }[]>`
      SELECT id FROM "user" WHERE email = ${email}
    `;
    expect(users).toHaveLength(1);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', cookie)
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({
        id: users[0].id,
        name: 'Integration buyer',
        email,
        emailVerified: false,
        image: null,
      });

    await request(app.getHttpServer())
      .post('/api/auth/sign-out')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', cookie)
      .expect(401)
      .expect('Content-Type', /json/)
      .expect({ statusCode: 401, message: 'Unauthorized' });
  });

  it('signs up, stores a hashed credential, and creates an authenticated session', async () => {
    const email = testEmail();
    const response = await send('sign-up/email', {
      name: 'Integration buyer',
      email,
      password,
    });
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toMatchObject({ user: { email, name: 'Integration buyer' } });

    const credentials = await client<
      { password: string | null; provider_id: string }[]
    >`
      SELECT account.password, account.provider_id
      FROM account JOIN "user" ON account.user_id = "user".id
      WHERE "user".email = ${email}
    `;
    expect(credentials).toHaveLength(1);
    expect(credentials[0].provider_id).toBe('credential');
    expect(typeof credentials[0].password).toBe('string');
    expect(credentials[0].password).not.toBe(password);
    expect(credentials[0].password?.length).toBeGreaterThan(0);

    const session = await send(
      'get-session',
      undefined,
      sessionCookie(response),
    );
    expect(session.status).toBe(200);
    const sessionBody: unknown = await session.json();
    expect(sessionBody).toMatchObject({ user: { email } });
  });

  it('signs in and invalidates the session on sign-out', async () => {
    const email = testEmail();
    const signup = await send('sign-up/email', {
      name: 'Integration buyer',
      email,
      password,
    });
    expect(signup.status).toBe(200);
    const signupCookie = sessionCookie(signup);
    expect((await send('sign-out', {}, signupCookie)).status).toBe(200);

    const signin = await send('sign-in/email', { email, password });
    expect(signin.status).toBe(200);
    const cookie = sessionCookie(signin);
    const authenticated = await send('get-session', undefined, cookie);
    const authenticatedBody: unknown = await authenticated.json();
    expect(authenticatedBody).toMatchObject({ user: { email } });

    const signout = await send('sign-out', {}, cookie);
    expect(signout.status).toBe(200);
    const expired = await send('get-session', undefined, cookie);
    expect(expired.status).toBe(200);
    expect(await expired.json()).toBeNull();
    expect(
      await client`
      SELECT session.id FROM session JOIN "user" ON session.user_id = "user".id
      WHERE "user".email = ${email}
    `,
    ).toEqual([]);
  });

  it('rejects an incorrect password without creating a session', async () => {
    const email = testEmail();
    const signup = await send('sign-up/email', {
      name: 'Integration buyer',
      email,
      password,
    });
    expect(signup.status).toBe(200);
    expect((await send('sign-out', {}, sessionCookie(signup))).status).toBe(
      200,
    );

    const response = await send('sign-in/email', {
      email,
      password: 'Wrong-password-42!',
    });
    expect(response.status).toBe(401);
    expect(
      await client`
      SELECT session.id FROM session JOIN "user" ON session.user_id = "user".id
      WHERE "user".email = ${email}
    `,
    ).toEqual([]);
  });

  it('rejects an unknown account', async () => {
    const response = await send('sign-in/email', {
      email: testEmail(),
      password,
    });
    expect(response.status).toBe(401);
  });

  it('rejects duplicate signup without creating a second account', async () => {
    const email = testEmail();
    const body = { name: 'Integration buyer', email, password };
    expect((await send('sign-up/email', body)).status).toBe(200);
    const duplicate = await send('sign-up/email', body);
    expect(duplicate.status).toBe(422);
    const users = await client`SELECT id FROM "user" WHERE email = ${email}`;
    expect(users).toHaveLength(1);
    expect(
      await client`
      SELECT account.id FROM account JOIN "user" ON account.user_id = "user".id
      WHERE "user".email = ${email}
    `,
    ).toHaveLength(1);
  });

  it.each([
    ['short password', { password: 'short' }],
    ['invalid email', { email: 'invalid-email' }],
  ])('rejects signup with %s', async (_label, fields) => {
    const email = testEmail();
    const response = await send('sign-up/email', {
      name: 'Integration buyer',
      email,
      password,
      ...fields,
    });
    expect(response.status).toBe(400);
    expect(await client`SELECT id FROM "user" WHERE email = ${email}`).toEqual(
      [],
    );
  });

  it('returns no session without a cookie', async () => {
    const response = await send('get-session');
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it('rejects a forged session cookie', async () => {
    const response = await send(
      'get-session',
      undefined,
      'better-auth.session_token=forged-token',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });
});

describe('Seller profiles and owned products through Nest', () => {
  it('creates, reads and updates the signed-in buyer seller profile', async () => {
    const buyer = await signedInBuyer();
    await request(app.getHttpServer())
      .get('/sellers/me')
      .set('Cookie', buyer.cookie)
      .expect(404);
    const seller = await createSeller(buyer.cookie);
    await request(app.getHttpServer())
      .get(`/sellers/${seller.id}`)
      .expect(200)
      .expect((response) => {
        const body: unknown = response.body;
        expect(body).toMatchObject({
          id: seller.id,
          storeName: seller.storeName,
          description: null,
        });
        expect(body).not.toHaveProperty('userId');
      });
    await request(app.getHttpServer())
      .get('/sellers/me')
      .set('Cookie', buyer.cookie)
      .expect(200);
    await request(app.getHttpServer())
      .patch('/sellers/me')
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({
        storeName: `Renamed ${seller.id}`,
        description: '  Electronics  ',
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/sellers/me')
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ description: null })
      .expect(200);
    const rows =
      await client`SELECT store_name, description FROM seller_profiles WHERE id = ${seller.id}`;
    expect(rows).toEqual([
      { store_name: `Renamed ${seller.id}`, description: null },
    ]);
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', buyer.cookie)
      .expect(200);
  });

  it('rejects duplicate profiles and store-name collisions, including updates', async () => {
    const first = await signedInBuyer();
    const second = await signedInBuyer();
    const seller = await createSeller(first.cookie);
    await request(app.getHttpServer())
      .post('/sellers')
      .set('Cookie', first.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ storeName: `Another ${randomUUID()}` })
      .expect(409);
    await request(app.getHttpServer())
      .post('/sellers')
      .set('Cookie', second.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ storeName: seller.storeName })
      .expect(409);
    const other = await createSeller(second.cookie);
    await request(app.getHttpServer())
      .patch('/sellers/me')
      .set('Cookie', second.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ storeName: seller.storeName })
      .expect(409);
    const rows =
      await client`SELECT store_name FROM seller_profiles WHERE id = ${other.id}`;
    expect(rows).toEqual([{ store_name: other.storeName }]);
  });

  it('allows only one profile when creation races for the same user', async () => {
    const buyer = await signedInBuyer();
    const responses = await Promise.all(
      [1, 2].map((number) =>
        request(app.getHttpServer())
          .post('/sellers')
          .set('Cookie', buyer.cookie)
          .set('Origin', 'http://localhost:3000')
          .send({ storeName: `Race ${buyer.userId} ${number}` }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      await client`SELECT id FROM seller_profiles WHERE user_id = ${buyer.userId}`,
    ).toHaveLength(1);
  });

  it.each([
    {},
    { storeName: ' ' },
    { storeName: 5 },
    { storeName: 'Store', userId: 'another' },
    { storeName: 'Store', role: 'admin' },
  ])('rejects invalid seller creation %j', async (input) => {
    const buyer = await signedInBuyer();
    await request(app.getHttpServer())
      .post('/sellers')
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .send(input)
      .expect(400);
    expect(
      await client`SELECT id FROM seller_profiles WHERE user_id = ${buyer.userId}`,
    ).toEqual([]);
  });

  it('requires a session for seller writes and a seller profile for product writes', async () => {
    const categoryId = await createCategory();
    const input = {
      name: 'Keyboard',
      categoryId,
      stockQuantity: 1,
      price: '10.00',
    };
    await request(app.getHttpServer())
      .post('/sellers')
      .send({ storeName: 'Store' })
      .expect(401);
    await request(app.getHttpServer()).get('/sellers/me').expect(401);
    await request(app.getHttpServer())
      .post('/products')
      .send(input)
      .expect(401);
    const buyer = await signedInBuyer();
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .send(input)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/products/${randomUUID()}`)
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Keyboard' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/products/${randomUUID()}`)
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .expect(403);
  });

  it('rejects missing and untrusted write origins without changing the profile', async () => {
    const buyer = await signedInBuyer();
    for (const origin of [undefined, 'https://attacker.example']) {
      const call = request(app.getHttpServer())
        .post('/sellers')
        .set('Cookie', buyer.cookie);
      if (origin) call.set('Origin', origin);
      await call.send({ storeName: `Origin test ${randomUUID()}` }).expect(403);
    }
    expect(
      await client`SELECT id FROM seller_profiles WHERE user_id = ${buyer.userId}`,
    ).toEqual([]);
  });

  it('persists products, searches literal names or IDs and applies category/seller pagination', async () => {
    const buyer = await signedInBuyer();
    const seller = await createSeller(buyer.cookie);
    const categoryId = await createCategory();
    const secondCategory = await createCategory();
    const items: Product[] = [];
    for (const input of [
      {
        name: 'Mechanical Keyboard',
        categoryId,
        stockQuantity: 1,
        price: '10.0',
      },
      { name: 'Wireless Mouse', categoryId, stockQuantity: 0, price: '0' },
      {
        name: '100% USB_C Hub',
        categoryId: secondCategory,
        stockQuantity: 2,
        price: '15.99',
      },
    ]) {
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Cookie', buyer.cookie)
        .set('Origin', 'http://localhost:3000')
        .send(input)
        .expect(201);
      const id = responseId(response);
      expect(response.headers.location).toBe(`/products/${id}`);
      items.push({
        ...input,
        id,
        sellerId: seller.id,
        description: null,
        discountPercent: 0,
        price: Number(input.price).toFixed(2),
      });
    }
    const sorted = [...items].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    await request(app.getHttpServer())
      .get(`/products?sellerId=${seller.id}`)
      .expect(200)
      .expect(sorted);
    await request(app.getHttpServer())
      .get(`/products?sellerId=${seller.id}&page=2&limit=1`)
      .expect(200)
      .expect([sorted[1]]);
    await request(app.getHttpServer())
      .get(`/products?sellerId=${seller.id}&page=4&limit=1`)
      .expect(200)
      .expect([]);
    await request(app.getHttpServer())
      .get(`/products?sellerId=${seller.id}&search=KEY`)
      .expect(200)
      .expect([items[0]]);
    await request(app.getHttpServer())
      .get(`/products?sellerId=${seller.id}&search=${items[1].id}`)
      .expect(200)
      .expect([items[1]]);
    await request(app.getHttpServer())
      .get(`/products?sellerId=${seller.id}&search=monitor`)
      .expect(200)
      .expect([]);
    await request(app.getHttpServer())
      .get(`/products?sellerId=${seller.id}&search=%25`)
      .expect(200)
      .expect([items[2]]);
    await request(app.getHttpServer())
      .get(`/products?sellerId=${seller.id}&categoryId=${categoryId}`)
      .expect(200)
      .expect(sorted.filter((item) => item.categoryId === categoryId));
    await request(app.getHttpServer())
      .get(`/products/${items[0].id}`)
      .expect(200)
      .expect(items[0]);
    await request(app.getHttpServer())
      .get(`/sellers?search=${encodeURIComponent(seller.storeName)}&limit=1`)
      .expect(200)
      .expect((response) => {
        const body: unknown = response.body;
        expect(body).toEqual([expect.objectContaining({ id: seller.id })]);
      });
  });

  it('allows only owners to update or delete, rejects forged ownership, and preserves omitted fields', async () => {
    const owner = await signedInBuyer();
    const other = await signedInBuyer();
    const seller = await createSeller(owner.cookie);
    const otherSeller = await createSeller(other.cookie);
    const categoryId = await createCategory();
    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', owner.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'Keyboard',
        categoryId,
        stockQuantity: 3,
        price: '10.00',
        description: 'Original',
      })
      .expect(201);
    const id = responseId(response);
    await request(app.getHttpServer())
      .patch(`/products/${id}`)
      .set('Cookie', other.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Stolen' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/products/${id}`)
      .set('Cookie', other.cookie)
      .set('Origin', 'http://localhost:3000')
      .expect(403);
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', owner.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'Forged',
        categoryId,
        stockQuantity: 1,
        price: '1.00',
        sellerId: otherSeller.id,
      })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/products/${id}`)
      .set('Cookie', owner.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ sellerId: otherSeller.id })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/products/${id}`)
      .set('Cookie', owner.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ stockQuantity: 0, description: null, discountPercent: 0 })
      .expect(200)
      .expect({
        id,
        sellerId: seller.id,
        name: 'Keyboard',
        categoryId,
        stockQuantity: 0,
        description: null,
        price: '10.00',
        discountPercent: 0,
      });
    await request(app.getHttpServer())
      .delete(`/products/${id}`)
      .set('Cookie', owner.cookie)
      .set('Origin', 'http://localhost:3000')
      .expect(204);
    await request(app.getHttpServer()).get(`/products/${id}`).expect(404);
  });

  it('returns 400 for unknown categories and 404 for unknown products', async () => {
    const buyer = await signedInBuyer();
    await createSeller(buyer.cookie);
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'Keyboard',
        categoryId: randomUUID(),
        stockQuantity: 1,
        price: '10',
      })
      .expect(400);
    const categoryId = await createCategory();
    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Keyboard', categoryId, stockQuantity: 1, price: '10' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/products/${responseId(created)}`)
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ categoryId: randomUUID() })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/products/${randomUUID()}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/products/${randomUUID()}`)
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Keyboard' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/products/${randomUUID()}`)
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .expect(404);
  });

  it('deletes only the caller seller profile and preserves buyer history snapshots', async () => {
    const owner = await signedInBuyer();
    const buyer = await signedInBuyer();
    const seller = await createSeller(owner.cookie);
    const otherSeller = await createSeller(buyer.cookie);
    const categoryId = await createCategory();
    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', owner.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'Saved keyboard',
        categoryId,
        stockQuantity: 1,
        price: '25.00',
      })
      .expect(201);
    const id = responseId(response);
    const orderId = randomUUID();
    orderIds.push(orderId);
    const otherProduct = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'Other seller mouse',
        categoryId,
        stockQuantity: 1,
        price: '15.00',
      })
      .expect(201);
    const otherProductId = responseId(otherProduct);
    await client`INSERT INTO orders (id, user_id, total_amount) VALUES (${orderId}, ${buyer.userId}, '25.00')`;
    await client`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
      VALUES (${orderId}, ${id}, 'Saved keyboard', 1, '25.00')`;
    await client`INSERT INTO favourites (user_id, product_id, product_name) VALUES (${buyer.userId}, ${id}, 'Saved keyboard')`;
    await client`INSERT INTO ratings (user_id, product_id, product_name, score) VALUES (${buyer.userId}, ${id}, 'Saved keyboard', 5)`;
    await request(app.getHttpServer())
      .delete('/sellers/me')
      .set('Cookie', owner.cookie)
      .set('Origin', 'http://localhost:3000')
      .expect(204);
    await request(app.getHttpServer()).get(`/sellers/${seller.id}`).expect(404);
    await request(app.getHttpServer()).get(`/products/${id}`).expect(404);
    await request(app.getHttpServer())
      .get(`/sellers/${otherSeller.id}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/products/${otherProductId}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(
      await client`SELECT product_id, product_name, unit_price FROM order_items WHERE order_id = ${orderId}`,
    ).toEqual([
      { product_id: null, product_name: 'Saved keyboard', unit_price: '25.00' },
    ]);
    expect(
      await client`SELECT user_id, total_amount FROM orders WHERE id = ${orderId}`,
    ).toEqual([{ user_id: buyer.userId, total_amount: '25.00' }]);
    expect(
      await client`SELECT product_id, product_name FROM favourites WHERE user_id = ${buyer.userId}`,
    ).toEqual([{ product_id: null, product_name: 'Saved keyboard' }]);
    expect(
      await client`SELECT product_id, product_name, score FROM ratings WHERE user_id = ${buyer.userId}`,
    ).toEqual([{ product_id: null, product_name: 'Saved keyboard', score: 5 }]);
    await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', owner.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Keyboard', categoryId, stockQuantity: 1, price: '25' })
      .expect(403);
    await request(app.getHttpServer())
      .delete('/sellers/me')
      .set('Cookie', owner.cookie)
      .set('Origin', 'http://localhost:3000')
      .expect(404);
    await createSeller(owner.cookie);
  });
});
