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

  afterEach(async () => {
    await app.close();
  });
});
