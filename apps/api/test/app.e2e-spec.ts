import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
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
      .expect([
        { id: 'p1', name: 'Mechanical Keyboard' },
        { id: 'p2', name: 'Wireless Mouse' },
      ]);
  });

  it('/products?search=key (GET) returns search and product', () => {
    return request(app.getHttpServer())
      .get('/products?search=key')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect([{ id: 'p1', name: 'Mechanical Keyboard' }]);
  });

  it('/products?search=monitor (GET) returns search for missing product', () => {
    return request(app.getHttpServer())
      .get('/products?search=monitor')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect([]);
  });

  it('/products/p1 (GET) returns one product', () => {
    return request(app.getHttpServer())
      .get('/products/p1')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({ id: 'p1', name: 'Mechanical Keyboard' });
  });

  it('/products/missing (GET) returns error for missing product', () => {
    return request(app.getHttpServer())
      .get('/products/missing')
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
      .expect([{ id: 'p1', name: 'Mechanical Keyboard' }]);
  });

  it('/products?page=2&limit=1 (GET) returns one product', () => {
    return request(app.getHttpServer())
      .get('/products?page=2&limit=1')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect([{ id: 'p2', name: 'Wireless Mouse' }]);
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
      .expect([{ id: 'p2', name: 'Wireless Mouse' }]);
  });

  it('/products?page=3&limit=1 (GET) returns nothing', () => {
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
      .send({ name: '  USB-C Hub  ' })
      .expect(201)
      .expect('Content-Type', /json/)
      .expect((response) => {
        const body: unknown = response.body;

        expect(body).toHaveProperty('name', 'USB-C Hub');
        expect(body).toHaveProperty('id', expect.stringMatching(/^.+$/));
      });
  });

  it('POST /products rejects a missing name', () => {
    return request(app.getHttpServer())
      .post('/products')
      .send({})
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('POST /products rejects a numeric name', () => {
    return request(app.getHttpServer())
      .post('/products')
      .send({ name: 42 })
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('POST /products rejects an empty name', () => {
    return request(app.getHttpServer())
      .post('/products')
      .send({ name: '' })
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('POST /products rejects a whitespace-only name', () => {
    return request(app.getHttpServer())
      .post('/products')
      .send({ name: '   ' })
      .expect(400)
      .expect('Content-Type', /json/);
  });

  it('PATCH /products/p1', () => {
    return request(app.getHttpServer())
      .patch('/products/p1')
      .send({ name: ' Compact Keyboard  ' })
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({ id: 'p1', name: 'Compact Keyboard' });
  });

  it('PATCH rejects an unknown product', () => {
    return request(app.getHttpServer())
      .patch('/products/missing')
      .send({ name: 'Keyboard' })
      .expect(404);
  });

  it('PATCH rejects a missing name', () => {
    return request(app.getHttpServer())
      .patch('/products/p1')
      .send({})
      .expect(400);
  });

  it('PATCH rejects a numeric name', () => {
    return request(app.getHttpServer())
      .patch('/products/p1')
      .send({ name: 42 })
      .expect(400);
  });

  it('PATCH rejects an empty name', () => {
    return request(app.getHttpServer())
      .patch('/products/p1')
      .send({ name: '' })
      .expect(400);
  });

  it('PATCH rejects a whitespace-only name', () => {
    return request(app.getHttpServer())
      .patch('/products/p1')
      .send({ name: '   ' })
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});
