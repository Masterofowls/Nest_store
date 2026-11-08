import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../src/configure-app';
import { AuthService } from '../src/auth/auth.service';
import type { AuthSession } from '../src/auth/session-request';
import { ProductsService } from '../src/products/products.service';
import { SellersService } from '../src/sellers/sellers.service';
import {
  productFixture,
  sellerFixture,
  sessionFixture,
} from './marketplace.fixtures';
import { NotFoundException } from '@nestjs/common';

describe('AppController (e2e)', () => {
  let app: NestExpressApplication;
  const products = {
    findAll: jest.fn(),
    getOrThrow: jest.fn(),
    postProduct: jest.fn(),
    patchProduct: jest.fn(),
    deleteProduct: jest.fn(),
  };
  const sellers = { requireSeller: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    products.findAll.mockResolvedValue([productFixture]);
    products.getOrThrow.mockResolvedValue(productFixture);
    products.postProduct.mockResolvedValue(productFixture);
    products.patchProduct.mockResolvedValue(productFixture);
    products.deleteProduct.mockResolvedValue(undefined);
    sellers.requireSeller.mockResolvedValue(sellerFixture);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProductsService)
      .useValue(products)
      .overrideProvider(SellersService)
      .useValue(sellers)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureApp(app);
    await app.init();
    jest
      .spyOn(app.get(AuthService).auth.api, 'getSession')
      .mockImplementation((input) => {
        const headers = input?.headers;
        return Promise.resolve(
          headers instanceof Headers && headers.get('cookie') === 'test-session'
            ? sessionFixture
            : null,
        );
      });
  });

  it('/hello (GET)', () => {
    return request(app.getHttpServer())
      .get('/hello')
      .expect(200)
      .expect('Online Store API');
  });

  it('/ (GET) returns 404', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  it('/products (GET) returns the products', () => {
    return request(app.getHttpServer())
      .get('/products')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect([productFixture]);
  });

  it('/products?search=key (GET) returns search and product', () => {
    return request(app.getHttpServer())
      .get('/products?search=key')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect([productFixture])
      .expect(() =>
        expect(products.findAll).toHaveBeenCalledWith({
          search: 'key',
          page: 1,
          limit: 10,
        }),
      );
  });

  it('/products?search=monitor (GET) returns search for missing product', () => {
    products.findAll.mockResolvedValue([]);
    return request(app.getHttpServer())
      .get('/products?search=monitor')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect([]);
  });

  it('/products/p1 (GET) returns one product', () => {
    return request(app.getHttpServer())
      .get(`/products/${productFixture.id}`)
      .expect(200)
      .expect('Content-Type', /json/)
      .expect(productFixture);
  });

  it('/products/missing (GET) returns error for missing product', () => {
    products.getOrThrow.mockRejectedValue(
      new NotFoundException('Product not found'),
    );
    return request(app.getHttpServer())
      .get('/products/00000000-0000-4000-8000-000000000099')
      .expect(404)
      .expect('Content-Type', /json/)
      .expect({
        message: 'Product not found',
        error: 'Not Found',
        statusCode: 404,
      });
  });

  it('/products?page=1&limit=1 (GET) returns one product', () => {
    return request(app.getHttpServer())
      .get('/products?page=1&limit=1')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect([productFixture])
      .expect(() =>
        expect(products.findAll).toHaveBeenCalledWith({ page: 1, limit: 1 }),
      );
  });

  it('/products?page=2&limit=1 (GET) returns one product', () => {
    return request(app.getHttpServer())
      .get('/products?page=2&limit=1')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect([productFixture])
      .expect(() =>
        expect(products.findAll).toHaveBeenCalledWith({ page: 2, limit: 1 }),
      );
  });

  it('/products?page=abc (GET) returns error', () => {
    return request(app.getHttpServer())
      .get('/products?page=abc')
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('/products?page=0 (GET) returns error', () => {
    return request(app.getHttpServer())
      .get('/products?page=0')
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('/products?page=-1 (GET) returns error', () => {
    return request(app.getHttpServer())
      .get('/products?page=-1')
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('/products?limit=0 (GET) returns error', () => {
    return request(app.getHttpServer())
      .get('/products?limit=0')
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('/products?limit=-1 (GET) returns error', () => {
    return request(app.getHttpServer())
      .get('/products?limit=-1')
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('/products?search=mouse&page=1&limit=1 (GET) returns only p2', () => {
    return request(app.getHttpServer())
      .get('/products?search=mouse&page=1&limit=1')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect([productFixture])
      .expect(() =>
        expect(products.findAll).toHaveBeenCalledWith({
          search: 'mouse',
          page: 1,
          limit: 1,
        }),
      );
  });

  it('/products?page=3&limit=1 (GET) returns nothing', () => {
    products.findAll.mockResolvedValue([]);
    return request(app.getHttpServer())
      .get('/products?page=3&limit=1')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect([]);
  });

  it('/products?limit=abc (GET) returns error', () => {
    return request(app.getHttpServer())
      .get('/products?limit=abc')
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('/products?page=1.5 (GET) returns error', () => {
    return request(app.getHttpServer())
      .get('/products?page=1.5')
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('/products (POST)  post product', () => {
    return request(app.getHttpServer())
      .post('/products')
      .set('Cookie', 'test-session')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: '  USB-C Hub  ',
        categoryId: productFixture.categoryId,
        stockQuantity: 1,
        price: '10.00',
      })
      .expect(201)
      .expect('Content-Type', /json/)
      .expect((response) => {
        const body: unknown = response.body;

        expect(body).toHaveProperty('name', productFixture.name);
        expect(body).toHaveProperty('id', expect.stringMatching(/^.+$/));
        expect(products.postProduct).toHaveBeenCalledWith(
          {
            name: 'USB-C Hub',
            categoryId: productFixture.categoryId,
            stockQuantity: 1,
            price: '10.00',
          },
          sellerFixture.id,
        );
      });
  });

  it('POST /products rejects a missing name', () => {
    return request(app.getHttpServer())
      .post('/products')
      .set('Cookie', 'test-session')
      .set('Origin', 'http://localhost:3000')
      .send({})
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('POST /products rejects a numeric name', () => {
    return request(app.getHttpServer())
      .post('/products')
      .set('Cookie', 'test-session')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 42 })
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('POST /products rejects an empty name', () => {
    return request(app.getHttpServer())
      .post('/products')
      .set('Cookie', 'test-session')
      .set('Origin', 'http://localhost:3000')
      .send({ name: '' })
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('POST /products rejects a whitespace-only name', () => {
    return request(app.getHttpServer())
      .post('/products')
      .set('Cookie', 'test-session')
      .set('Origin', 'http://localhost:3000')
      .send({ name: '   ' })
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('PATCH /products/p1', () => {
    return request(app.getHttpServer())
      .patch(`/products/${productFixture.id}`)
      .set('Cookie', 'test-session')
      .set('Origin', 'http://localhost:3000')
      .send({ name: ' Compact Keyboard  ' })
      .expect(200)
      .expect('Content-Type', /json/)
      .expect(productFixture)
      .expect(() =>
        expect(products.patchProduct).toHaveBeenCalledWith(
          { name: 'Compact Keyboard' },
          productFixture.id,
          sellerFixture.id,
        ),
      );
  });

  it('PATCH rejects an unknown product', () => {
    products.patchProduct.mockRejectedValue(
      new NotFoundException('Product not found'),
    );
    return request(app.getHttpServer())
      .patch('/products/00000000-0000-4000-8000-000000000099')
      .set('Cookie', 'test-session')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Keyboard' })
      .expect(404);
  });

  it('PATCH rejects a missing name', () => {
    return request(app.getHttpServer())
      .patch(`/products/${productFixture.id}`)
      .set('Cookie', 'test-session')
      .set('Origin', 'http://localhost:3000')
      .send({})
      .expect(400);
  });

  it('PATCH rejects a numeric name', () => {
    return request(app.getHttpServer())
      .patch(`/products/${productFixture.id}`)
      .set('Cookie', 'test-session')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 42 })
      .expect(400);
  });

  it('PATCH rejects an empty name', () => {
    return request(app.getHttpServer())
      .patch(`/products/${productFixture.id}`)
      .set('Cookie', 'test-session')
      .set('Origin', 'http://localhost:3000')
      .send({ name: '' })
      .expect(400);
  });

  it('PATCH rejects a whitespace-only name', () => {
    return request(app.getHttpServer())
      .patch(`/products/${productFixture.id}`)
      .set('Cookie', 'test-session')
      .set('Origin', 'http://localhost:3000')
      .send({ name: '   ' })
      .expect(400);
  });

  it('DELETE product', async () => {
    await request(app.getHttpServer())
      .delete(`/products/${productFixture.id}`)
      .set('Cookie', 'test-session')
      .set('Origin', 'http://localhost:3000')
      .expect(204);
    expect(products.deleteProduct).toHaveBeenCalledWith(
      productFixture.id,
      sellerFixture.id,
    );
    products.getOrThrow.mockRejectedValue(
      new NotFoundException('Product not found'),
    );
    await request(app.getHttpServer())
      .get(`/products/${productFixture.id}`)
      .expect(404);
  });

  it('DELETE rejects an unknown product', () => {
    products.deleteProduct.mockRejectedValue(
      new NotFoundException('Product not found'),
    );
    return request(app.getHttpServer())
      .delete('/products/00000000-0000-4000-8000-000000000099')
      .set('Cookie', 'test-session')
      .set('Origin', 'http://localhost:3000')
      .expect(404);
  });

  it('GET auth', () => {
    return request(app.getHttpServer())
      .get('/api/auth/ok')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({ ok: true });
  });

  it('GET user without cookie', () => {
    return request(app.getHttpServer())
      .get('/users/me')
      .expect(401)
      .expect('Content-Type', /json/)
      .expect({
        statusCode: 401,
        message: 'Unauthorized',
      });
  });

  it('GET /users/me returns only public user fields for a valid session', async () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const validSession: AuthSession = {
      user: {
        id: 'test-user',
        name: 'Test buyer',
        email: 'buyer@example.test',
        emailVerified: false,
        isAdmin: false,
        image: null,
        createdAt: date,
        updatedAt: date,
      },
      session: {
        id: 'test-session',
        userId: 'test-user',
        token: 'fake-session-token',
        expiresAt: new Date('2026-01-02T00:00:00Z'),
        createdAt: date,
        updatedAt: date,
        ipAddress: null,
        userAgent: null,
      },
    };
    const authService = app.get(AuthService);
    const lookup = jest
      .spyOn(authService.auth.api, 'getSession')
      .mockResolvedValue(validSession);

    try {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Cookie', 'better-auth.session_token=fake-cookie')
        .expect(200)
        .expect('Content-Type', /json/)
        .expect({
          id: 'test-user',
          name: 'Test buyer',
          email: 'buyer@example.test',
          emailVerified: false,
          image: null,
        });
      expect(lookup).toHaveBeenCalledTimes(1);
    } finally {
      lookup.mockRestore();
    }
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
  });
});
