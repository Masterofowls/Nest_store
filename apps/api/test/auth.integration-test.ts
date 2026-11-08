import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { testEnvSchema } from '../src/config/test-env.schema';
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
import type { Category, Product } from '../src/db/schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthModule } from '../src/auth/auth.module';
import { DbModule } from '../src/db/db.module';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { SessionGuard } from '../src/auth/guards/session/session.guard';
import type { Environment } from '../src/config/env.schema';
import { CategoriesModule } from '../src/categories/categories.module';
import { ImagesModule } from '../src/images/images.module';
import { StorageService } from '../src/images/storage.service';
import sharp from 'sharp';
import { ServiceUnavailableException } from '@nestjs/common';

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
const db = drizzle(client, { schema });
const config = new ConfigService<Environment, true>({
  DATABASE_URL: result.data.TEST_DATABASE_URL,
  BETTER_AUTH_SECRET: 'fake-test-secret-with-at-least-thirty-two-characters',
  BETTER_AUTH_URL: 'http://localhost:3000',
});
let auth: AuthService['auth'];
const password = 'Integration-test-password-42!';
let emails: string[] = [];
let app: NestExpressApplication;
let categoryIds: string[] = [];
let categoryNames: string[] = [];
let orderIds: string[] = [];
const ownedImagePaths = new Set<string>();
const storage = {
  bucket: 'test-product-images',
  publicUrl(path: string) {
    ownedImagePaths.add(path);
    return `https://storage.example.test/${path}`;
  },
  upload: jest.fn<Promise<void>, [string, Buffer]>(),
  remove: jest.fn<Promise<void>, [string, string]>(),
};

@Controller('test/admin')
class AdminProbeController {
  @Get()
  @UseGuards(SessionGuard, AdminGuard)
  check() {
    return { ok: true };
  }
}

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

async function signedInAdmin() {
  const buyer = await signedInBuyer();
  await client`UPDATE "user" SET is_admin = true WHERE id = ${buyer.userId}`;
  return buyer;
}

async function createApiCategory(
  cookie: string,
  name = `Test category ${randomUUID()}`,
) {
  categoryNames.push(name);
  const response = await request(app.getHttpServer())
    .post('/categories')
    .set('Cookie', cookie)
    .set('Origin', 'http://localhost:3000')
    .send({ name });
  if (response.status === 201) {
    categoryIds.push(responseId(response));
  }
  expect(response.status).toBe(201);
  const id = responseId(response);
  expect(response.headers.location).toBe(`/categories/${id}`);
  expect(response.body).toEqual({ id, name: name.trim() });
  return { id, name: name.trim() };
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
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      AuthModule,
      DbModule,
      UsersModule,
      SellersModule,
      ProductsModule,
      CategoriesModule,
      ImagesModule,
    ],
    controllers: [AdminProbeController],
  })
    .overrideProvider(ConfigService)
    .useValue(config)
    .overrideProvider(DatabaseService)
    .useValue({ db })
    .overrideProvider(StorageService)
    .useValue(storage)
    .compile();

  app = moduleFixture.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  auth = app.get(AuthService).auth;
  configureApp(app);
  await app.listen(0);
});

beforeEach(() => {
  emails = [];
  categoryIds = [];
  categoryNames = [];
  orderIds = [];
  storage.upload.mockReset().mockResolvedValue(undefined);
  storage.remove.mockReset().mockImplementation((bucket, path) => {
    if (bucket !== storage.bucket || !ownedImagePaths.has(path)) {
      return Promise.reject(
        new Error('Refusing to remove a storage object outside test fixtures'),
      );
    }
    return Promise.resolve();
  });
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
  for (const name of categoryNames) {
    await client`DELETE FROM categories WHERE name = ${name}`;
  }
  for (const [path] of storage.upload.mock.calls) {
    await client`DELETE FROM storage_cleanup WHERE bucket = ${storage.bucket} AND path = ${path}`;
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
  it('keeps signup and user updates from granting admin access', async () => {
    const email = testEmail();
    const signup = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Integration buyer', email, password, isAdmin: true })
      .expect(200);
    const cookie = httpSessionCookie(signup);
    expect(
      await client`SELECT is_admin FROM "user" WHERE email = ${email}`,
    ).toEqual([{ is_admin: false }]);
    await request(app.getHttpServer())
      .get('/test/admin')
      .set('Cookie', cookie)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/auth/update-user')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({ isAdmin: true })
      .expect(400);
    expect(
      await client`SELECT is_admin FROM "user" WHERE email = ${email}`,
    ).toEqual([{ is_admin: false }]);
  });

  it('requires a session and applies admin grants/revocation to the same cookie', async () => {
    await request(app.getHttpServer()).get('/test/admin').expect(401);
    const buyer = await signedInBuyer();
    await request(app.getHttpServer())
      .get('/test/admin')
      .set('Cookie', buyer.cookie)
      .expect(403);
    await client`UPDATE "user" SET is_admin = true WHERE id = ${buyer.userId}`;
    await request(app.getHttpServer())
      .get('/test/admin')
      .set('Cookie', buyer.cookie)
      .expect(200)
      .expect({ ok: true });
    await client`UPDATE "user" SET is_admin = false WHERE id = ${buyer.userId}`;
    await request(app.getHttpServer())
      .get('/test/admin')
      .set('Cookie', buyer.cookie)
      .expect(403);
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Cookie', buyer.cookie)
      .expect(200);
  });

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

describe('Categories through Nest', () => {
  it('lets admins create, rename and delete categories with public reads', async () => {
    const admin = await signedInAdmin();
    const category = await createApiCategory(
      admin.cookie,
      `  Keyboards ${randomUUID()}  `,
    );
    await request(app.getHttpServer())
      .get(`/categories/${category.id}`)
      .expect(200)
      .expect(category);
    const name = `Updated ${category.id}`;
    await request(app.getHttpServer())
      .patch(`/categories/${category.id}`)
      .set('Cookie', admin.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ name: ` ${name} ` })
      .expect(200)
      .expect({ id: category.id, name });
    await request(app.getHttpServer())
      .get(`/categories/${category.id}`)
      .expect(200)
      .expect({ id: category.id, name });
    const deleted = await request(app.getHttpServer())
      .delete(`/categories/${category.id}`)
      .set('Cookie', admin.cookie)
      .set('Origin', 'http://localhost:3000')
      .expect(204);
    expect(deleted.text).toBe('');
    await request(app.getHttpServer())
      .get(`/categories/${category.id}`)
      .expect(404);
  });

  describe('Product images through Nest with isolated storage', () => {
    async function fixture() {
      const owner = await signedInAdmin();
      const seller = await createSeller(owner.cookie);
      const categoryId = await createCategory();
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .send({
          name: 'Image keyboard',
          categoryId,
          stockQuantity: 2,
          price: '10.00',
        })
        .expect(201);
      const productId = responseId(response);
      const bytes = await sharp({
        create: { width: 4, height: 3, channels: 3, background: 'red' },
      })
        .png()
        .toBuffer();
      return { owner, seller, productId, bytes };
    }

    it('uploads validated WebP, lists public metadata and cleans up deletion', async () => {
      const { owner, productId, bytes } = await fixture();
      const response = await request(app.getHttpServer())
        .post(`/products/${productId}/images`)
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .attach('file', bytes, 'photo.png')
        .expect(201);
      const imageId = responseId(response);
      expect(storage.upload).toHaveBeenCalledTimes(1);
      const [path, uploaded] = storage.upload.mock.calls[0];
      expect(path).toBe(`${productId}/${imageId}.webp`);
      expect((await sharp(uploaded).metadata()).format).toBe('webp');
      const body: unknown = response.body;
      expect(body).not.toHaveProperty('path');
      expect(body).not.toHaveProperty('bucket');
      await request(app.getHttpServer())
        .get(`/products/${productId}/images`)
        .expect(200)
        .expect([response.body]);
      await request(app.getHttpServer())
        .delete(`/products/${productId}/images/${imageId}`)
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .expect(204);
      expect(storage.remove).toHaveBeenCalledWith(storage.bucket, path);
      expect(
        await client`SELECT path FROM storage_cleanup WHERE path = ${path}`,
      ).toEqual([]);
    });

    it('rejects unauthenticated, foreign seller and invalid uploads before storage writes', async () => {
      const { owner, productId, bytes } = await fixture();
      await request(app.getHttpServer())
        .post(`/products/${productId}/images`)
        .attach('file', bytes, 'photo.png')
        .expect(401);
      const other = await signedInBuyer();
      await createSeller(other.cookie);
      await request(app.getHttpServer())
        .post(`/products/${productId}/images`)
        .set('Cookie', other.cookie)
        .set('Origin', 'http://localhost:3000')
        .attach('file', bytes, 'photo.png')
        .expect(403);
      await request(app.getHttpServer())
        .post(`/products/${productId}/images`)
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .expect(400);
      await request(app.getHttpServer())
        .post(`/products/${productId}/images`)
        .set('Cookie', owner.cookie)
        .attach('file', bytes, 'photo.png')
        .expect(403);
      await request(app.getHttpServer())
        .post(`/products/${productId}/images`)
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'photo.png')
        .expect(413);
      await request(app.getHttpServer())
        .post(`/products/${productId}/images`)
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .attach('file', Buffer.from('not an image'), 'photo.png')
        .expect(400);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('enforces the image count and denies foreign deletion', async () => {
      const { owner, productId, bytes } = await fixture();
      let imageId = '';
      for (let count = 0; count < 7; count++) {
        const image = await request(app.getHttpServer())
          .post(`/products/${productId}/images`)
          .set('Cookie', owner.cookie)
          .set('Origin', 'http://localhost:3000')
          .attach('file', bytes, 'photo.png')
          .expect(201);
        imageId = responseId(image);
      }
      const competing = await Promise.all(
        [0, 1].map(() =>
          request(app.getHttpServer())
            .post(`/products/${productId}/images`)
            .set('Cookie', owner.cookie)
            .set('Origin', 'http://localhost:3000')
            .attach('file', bytes, 'photo.png'),
        ),
      );
      expect(competing.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      await request(app.getHttpServer())
        .post(`/products/${productId}/images`)
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .attach('file', bytes, 'photo.png')
        .expect(409);
      expect(storage.upload).toHaveBeenCalledTimes(8);
      const other = await signedInBuyer();
      await createSeller(other.cookie);
      await request(app.getHttpServer())
        .delete(`/products/${productId}/images/${imageId}`)
        .set('Cookie', other.cookie)
        .set('Origin', 'http://localhost:3000')
        .expect(403);
    });

    it('retains failed cleanup for retry and queues cascade-deleted images', async () => {
      const { owner, productId, bytes } = await fixture();
      const response = await request(app.getHttpServer())
        .post(`/products/${productId}/images`)
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .attach('file', bytes, 'photo.png')
        .expect(201);
      const imageId = responseId(response);
      const path = storage.upload.mock.calls[0][0];
      storage.remove.mockRejectedValueOnce(
        new ServiceUnavailableException('Product image cleanup failed'),
      );
      await request(app.getHttpServer())
        .delete(`/products/${productId}/images/${imageId}`)
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .expect(503);
      expect(
        await client`SELECT path FROM storage_cleanup WHERE path = ${path}`,
      ).toEqual([{ path }]);
      await request(app.getHttpServer())
        .post('/product-images/cleanup')
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .expect(201)
        .expect({ removed: 1 });
      const second = await request(app.getHttpServer())
        .post(`/products/${productId}/images`)
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .attach('file', bytes, 'photo.png')
        .expect(201);
      expect(responseId(second)).not.toBe(imageId);
      const secondPath = storage.upload.mock.calls[1][0];
      await request(app.getHttpServer())
        .delete('/sellers/me')
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .expect(204);
      expect(
        await client`SELECT path FROM storage_cleanup WHERE path = ${secondPath}`,
      ).toEqual([{ path: secondPath }]);
      await request(app.getHttpServer())
        .post('/product-images/cleanup')
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .expect(201)
        .expect({ removed: 1 });
    });

    it('does not publish an upload that fails in storage', async () => {
      const { owner, productId, bytes } = await fixture();
      storage.upload.mockRejectedValueOnce(
        new ServiceUnavailableException('Product image upload failed'),
      );
      await request(app.getHttpServer())
        .post(`/products/${productId}/images`)
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .attach('file', bytes, 'photo.png')
        .expect(503);
      await request(app.getHttpServer())
        .get(`/products/${productId}/images`)
        .expect(200)
        .expect([]);
      expect(storage.remove).not.toHaveBeenCalled();
      const path = storage.upload.mock.calls[0][0];
      expect(
        await client`SELECT path FROM storage_cleanup WHERE path = ${path}`,
      ).toEqual([{ path }]);
      await client`UPDATE storage_cleanup SET not_before = now() - interval '1 minute' WHERE path = ${path}`;
      await request(app.getHttpServer())
        .post('/product-images/cleanup')
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .expect(201)
        .expect({ removed: 1 });
    });

    it('keeps an in-flight cascade cleanup queued until the upload finishes', async () => {
      const { owner, productId, bytes } = await fixture();
      storage.upload.mockImplementationOnce(async () => {
        await request(app.getHttpServer())
          .delete(`/products/${productId}`)
          .set('Cookie', owner.cookie)
          .set('Origin', 'http://localhost:3000')
          .expect(204);
        await request(app.getHttpServer())
          .post('/product-images/cleanup')
          .set('Cookie', owner.cookie)
          .set('Origin', 'http://localhost:3000')
          .expect(201)
          .expect({ removed: 0 });
      });
      await request(app.getHttpServer())
        .post(`/products/${productId}/images`)
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .attach('file', bytes, {
          filename: 'mislabelled.svg',
          contentType: 'image/svg+xml',
        })
        .expect(404);
      const path = storage.upload.mock.calls[0][0];
      expect(storage.remove).not.toHaveBeenCalled();
      expect(
        await client`SELECT path FROM storage_cleanup WHERE path = ${path}`,
      ).toEqual([{ path }]);
      await client`UPDATE storage_cleanup SET not_before = now() - interval '1 minute' WHERE path = ${path}`;
      await request(app.getHttpServer())
        .post('/product-images/cleanup')
        .set('Cookie', owner.cookie)
        .set('Origin', 'http://localhost:3000')
        .expect(201)
        .expect({ removed: 1 });
    });
  });

  it('rejects anonymous and non-admin category writes, including signed-in sellers', async () => {
    const id = await createCategory();
    const [original] = await client<
      { name: string }[]
    >`SELECT name FROM categories WHERE id = ${id}`;
    const buyer = await signedInBuyer();
    await createSeller(buyer.cookie);
    const name = `Unauthorized ${randomUUID()}`;
    categoryNames.push(name);
    await request(app.getHttpServer())
      .post('/categories')
      .send({ name })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/categories/${id}`)
      .send({ name })
      .expect(401);
    await request(app.getHttpServer()).delete(`/categories/${id}`).expect(401);
    await request(app.getHttpServer())
      .post('/categories')
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ name })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/categories/${id}`)
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ name })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/categories/${id}`)
      .set('Cookie', buyer.cookie)
      .set('Origin', 'http://localhost:3000')
      .expect(403);
    expect(await client`SELECT name FROM categories WHERE id = ${id}`).toEqual([
      original,
    ]);
    expect(
      await client`SELECT id FROM categories WHERE name = ${name}`,
    ).toEqual([]);
  });

  it('revokes category write access without replacing the cookie', async () => {
    const admin = await signedInAdmin();
    const category = await createApiCategory(admin.cookie);
    await client`UPDATE "user" SET is_admin = false WHERE id = ${admin.userId}`;
    await request(app.getHttpServer())
      .patch(`/categories/${category.id}`)
      .set('Cookie', admin.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ name: `Revoked ${category.id}` })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/categories/${category.id}`)
      .set('Cookie', admin.cookie)
      .set('Origin', 'http://localhost:3000')
      .expect(403);
    await request(app.getHttpServer())
      .get(`/categories/${category.id}`)
      .expect(200)
      .expect(category);
  });

  it.each([undefined, 'https://attacker.example'])(
    'rejects category writes with origin %s',
    async (origin) => {
      const admin = await signedInAdmin();
      const id = await createCategory();
      const name = `Origin category ${randomUUID()}`;
      categoryNames.push(name);
      const create = request(app.getHttpServer())
        .post('/categories')
        .set('Cookie', admin.cookie);
      if (origin) create.set('Origin', origin);
      await create.send({ name }).expect(403);
      const update = request(app.getHttpServer())
        .patch(`/categories/${id}`)
        .set('Cookie', admin.cookie);
      if (origin) update.set('Origin', origin);
      await update.send({ name }).expect(403);
      const remove = request(app.getHttpServer())
        .delete(`/categories/${id}`)
        .set('Cookie', admin.cookie);
      if (origin) remove.set('Origin', origin);
      await remove.expect(403);
      expect(
        await client`SELECT id FROM categories WHERE id = ${id}`,
      ).toHaveLength(1);
      expect(
        await client`SELECT id FROM categories WHERE name = ${name}`,
      ).toEqual([]);
    },
  );

  it('returns 409 for duplicate category names and conflicting renames', async () => {
    const admin = await signedInAdmin();
    const first = await createApiCategory(admin.cookie);
    const second = await createApiCategory(admin.cookie);
    await request(app.getHttpServer())
      .post('/categories')
      .set('Cookie', admin.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ name: first.name })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/categories/${second.id}`)
      .set('Cookie', admin.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ name: first.name })
      .expect(409);
    await request(app.getHttpServer())
      .get(`/categories/${second.id}`)
      .expect(200)
      .expect(second);
  });

  it('allows only one category when requests race for the same name', async () => {
    const admin = await signedInAdmin();
    const name = `Race category ${randomUUID()}`;
    categoryNames.push(name);
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post('/categories')
          .set('Cookie', admin.cookie)
          .set('Origin', 'http://localhost:3000')
          .send({ name }),
      ),
    );
    for (const response of responses) {
      if (response.status === 201) categoryIds.push(responseId(response));
    }
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      await client`SELECT id FROM categories WHERE name = ${name}`,
    ).toHaveLength(1);
  });

  it('rejects deleting a used category without removing it or its products', async () => {
    const admin = await signedInAdmin();
    await createSeller(admin.cookie);
    const category = await createApiCategory(admin.cookie);
    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Cookie', admin.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'Category test keyboard',
        categoryId: category.id,
        stockQuantity: 1,
        price: '10.00',
      })
      .expect(201);
    const productId = responseId(product);
    await request(app.getHttpServer())
      .delete(`/categories/${category.id}`)
      .set('Cookie', admin.cookie)
      .set('Origin', 'http://localhost:3000')
      .expect(409);
    await request(app.getHttpServer())
      .get(`/categories/${category.id}`)
      .expect(200)
      .expect(category);
    await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/products/${productId}`)
      .set('Cookie', admin.cookie)
      .set('Origin', 'http://localhost:3000')
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/categories/${category.id}`)
      .set('Cookie', admin.cookie)
      .set('Origin', 'http://localhost:3000')
      .expect(204);
  });

  it('searches literal names case-insensitively and uses deterministic pagination', async () => {
    const admin = await signedInAdmin();
    const prefix = `Category batch ${randomUUID()}`;
    const categories: Category[] = [];
    for (const suffix of ['Keyboards', 'Mouse', '100% USB_C']) {
      categories.push(
        await createApiCategory(admin.cookie, `${prefix} ${suffix}`),
      );
    }
    const sorted = [...categories].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    await request(app.getHttpServer())
      .get('/categories')
      .query({ search: prefix })
      .expect(200)
      .expect(sorted);
    await request(app.getHttpServer())
      .get('/categories')
      .query({ search: prefix, page: 2, limit: 1 })
      .expect(200)
      .expect([sorted[1]]);
    await request(app.getHttpServer())
      .get('/categories')
      .query({ search: prefix, page: 4, limit: 1 })
      .expect(200)
      .expect([]);
    await request(app.getHttpServer())
      .get('/categories')
      .query({ search: `${prefix} KEY` })
      .expect(200)
      .expect([categories[0]]);
    await request(app.getHttpServer())
      .get('/categories')
      .query({ search: `${prefix} 100%` })
      .expect(200)
      .expect([categories[2]]);
    await request(app.getHttpServer())
      .get('/categories')
      .query({ search: `${prefix} missing` })
      .expect(200)
      .expect([]);
  });

  it('rejects invalid bodies and IDs, and returns 404 for missing category UUIDs', async () => {
    const admin = await signedInAdmin();
    const category = await createApiCategory(admin.cookie);
    for (const body of [
      {},
      { name: '' },
      { name: 42 },
      { name: category.name, isAdmin: true },
    ]) {
      const response = await request(app.getHttpServer())
        .post('/categories')
        .set('Cookie', admin.cookie)
        .set('Origin', 'http://localhost:3000')
        .send(body);
      if (response.status === 201) categoryIds.push(responseId(response));
      expect(response.status).toBe(400);
      await request(app.getHttpServer())
        .patch(`/categories/${category.id}`)
        .set('Cookie', admin.cookie)
        .set('Origin', 'http://localhost:3000')
        .send(body)
        .expect(400);
    }
    await request(app.getHttpServer())
      .get('/categories/not-a-uuid')
      .expect(400);
    await request(app.getHttpServer())
      .get(`/categories/${randomUUID()}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/categories/${randomUUID()}`)
      .set('Cookie', admin.cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Updated' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/categories/${randomUUID()}`)
      .set('Cookie', admin.cookie)
      .set('Origin', 'http://localhost:3000')
      .expect(404);
    await request(app.getHttpServer()).get('/categories?limit=101').expect(400);
    await request(app.getHttpServer()).get('/categories?page=abc').expect(400);
  });
});
