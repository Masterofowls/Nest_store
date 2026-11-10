import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import {
  AdminBannersController,
  BannersController,
} from './banners.controller';
import { BannersService } from './banners.service';

const BANNER_ID = '00000000-0000-4000-8000-000000000020';

describe('Banners controllers', () => {
  let app: NestExpressApplication;
  const banner = { id: BANNER_ID, title: 'Sale' };
  const service = {
    findActive: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [BannersController, AdminBannersController],
      providers: [{ provide: BannersService, useValue: service }],
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

  it('lists active banners publicly', async () => {
    service.findActive.mockResolvedValue([banner]);
    await request(app.getHttpServer())
      .get('/banners')
      .expect(200)
      .expect([banner]);
  });

  it('pages the admin list and rejects search', async () => {
    service.findAll.mockResolvedValue([banner]);
    await request(app.getHttpServer())
      .get('/admin/banners?page=2&limit=5')
      .expect(200);
    expect(service.findAll).toHaveBeenCalledWith({ page: 2, limit: 5 });
    await request(app.getHttpServer())
      .get('/admin/banners?search=x')
      .expect(400);
  });

  it('creates a banner and sets Location', async () => {
    service.create.mockResolvedValue(banner);
    await request(app.getHttpServer())
      .post('/admin/banners')
      .send({ title: ' Sale ', linkUrl: '/catalog' })
      .expect(201)
      .expect('Location', `/admin/banners/${BANNER_ID}`);
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Sale', linkUrl: '/catalog' }),
    );
  });

  it('rejects an off-site protocol-relative link', async () => {
    await request(app.getHttpServer())
      .post('/admin/banners')
      .send({ title: 'Sale', linkUrl: '//evil.test' })
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('updates and deletes by UUID', async () => {
    service.update.mockResolvedValue(banner);
    await request(app.getHttpServer())
      .patch(`/admin/banners/${BANNER_ID}`)
      .send({ isActive: false })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(
      BANNER_ID,
      expect.objectContaining({ isActive: false }),
    );
    await request(app.getHttpServer())
      .delete(`/admin/banners/${BANNER_ID}`)
      .expect(204);
    await request(app.getHttpServer()).delete('/admin/banners/bad').expect(400);
    expect(service.delete).toHaveBeenCalledTimes(1);
  });
});
