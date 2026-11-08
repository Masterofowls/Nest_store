import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';

describe('CategoriesController input and service mapping', () => {
  let app: NestExpressApplication;
  const category = {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Keyboards',
  };
  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    service.findAll.mockResolvedValue([category]);
    service.findOne.mockResolvedValue(category);
    service.create.mockResolvedValue(category);
    service.update.mockResolvedValue(category);
    service.delete.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: service }],
    })
      .overrideGuard(SessionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(WriteOriginGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication<NestExpressApplication>();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('parses public list pagination', async () => {
    await request(app.getHttpServer())
      .get('/categories?search=KEY&page=2&limit=1')
      .expect(200)
      .expect([category]);
    expect(service.findAll).toHaveBeenCalledWith({
      search: 'KEY',
      page: 2,
      limit: 1,
    });
  });

  it('reads a public category by UUID', async () => {
    await request(app.getHttpServer())
      .get(`/categories/${category.id}`)
      .expect(200)
      .expect(category);
    expect(service.findOne).toHaveBeenCalledWith(category.id);
  });

  it('validates creation and sets Location', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .send({ name: ' Keyboards ' })
      .expect(201)
      .expect('Location', `/categories/${category.id}`)
      .expect(category);
    expect(service.create).toHaveBeenCalledWith({ name: 'Keyboards' });
  });

  it('validates the renamed category', async () => {
    await request(app.getHttpServer())
      .patch(`/categories/${category.id}`)
      .send({ name: ' Mice ' })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(category.id, { name: 'Mice' });
  });

  it('deletes with 204 and no response body', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/categories/${category.id}`)
      .expect(204);
    expect(response.text).toBe('');
    expect(service.delete).toHaveBeenCalledWith(category.id);
  });

  it.each([
    {},
    { name: '' },
    { name: ' ' },
    { name: 42 },
    { name: 'Keyboards', id: 'forged' },
  ])('rejects invalid create and update input %j', async (body) => {
    await request(app.getHttpServer())
      .post('/categories')
      .send(body)
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/categories/${category.id}`)
      .send(body)
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it.each(['page=0', 'limit=101', 'search=a&search=b', 'unexpected=1'])(
    'rejects invalid list query %s',
    async (query) => {
      await request(app.getHttpServer())
        .get(`/categories?${query}`)
        .expect(400);
      expect(service.findAll).not.toHaveBeenCalled();
    },
  );

  it('rejects malformed IDs on all ID routes', async () => {
    await request(app.getHttpServer()).get('/categories/bad').expect(400);
    await request(app.getHttpServer())
      .patch('/categories/bad')
      .send({ name: 'Updated' })
      .expect(400);
    await request(app.getHttpServer()).delete('/categories/bad').expect(400);
    expect(service.findOne).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.delete).not.toHaveBeenCalled();
  });
});
