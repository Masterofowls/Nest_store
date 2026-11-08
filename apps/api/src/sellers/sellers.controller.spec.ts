import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { SellersController } from './sellers.controller';
import { SellersService } from './sellers.service';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import type { SessionRequest } from '../auth/session-request';
import { sellerFixture, sessionFixture } from '../../test/marketplace.fixtures';

describe('SellersController input and service mapping', () => {
  let app: NestExpressApplication;
  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOwn: jest.fn(),
    create: jest.fn(),
    updateOwn: jest.fn(),
    deleteOwn: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    service.findAll.mockResolvedValue([sellerFixture]);
    service.findOne.mockResolvedValue(sellerFixture);
    service.findOwn.mockResolvedValue(sellerFixture);
    service.create.mockResolvedValue(sellerFixture);
    service.updateOwn.mockResolvedValue(sellerFixture);
    service.deleteOwn.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      controllers: [SellersController],
      providers: [{ provide: SellersService, useValue: service }],
    })
      .overrideGuard(SessionGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest<SessionRequest>().authSession =
            sessionFixture;
          return true;
        },
      })
      .overrideGuard(WriteOriginGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication<NestExpressApplication>();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('validates public list pagination', async () => {
    await request(app.getHttpServer())
      .get('/sellers?search=Store&page=2&limit=1')
      .expect(200);
    expect(service.findAll).toHaveBeenCalledWith({
      search: 'Store',
      page: 2,
      limit: 1,
    });
  });

  it('reads public sellers by UUID', async () => {
    await request(app.getHttpServer())
      .get(`/sellers/${sellerFixture.id}`)
      .expect(200);
    expect(service.findOne).toHaveBeenCalledWith(sellerFixture.id);
  });

  it('routes me separately from UUID public reads', async () => {
    await request(app.getHttpServer()).get('/sellers/me').expect(200);
    expect(service.findOwn).toHaveBeenCalledWith(sessionFixture.user.id);
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('creates with the session user and a Location header', async () => {
    await request(app.getHttpServer())
      .post('/sellers')
      .send({ storeName: ' Store ' })
      .expect(201)
      .expect('Location', `/sellers/${sellerFixture.id}`);
    expect(service.create).toHaveBeenCalledWith(sessionFixture.user.id, {
      storeName: 'Store',
    });
  });

  it.each([
    {},
    { storeName: '' },
    { storeName: ' ' },
    { storeName: 42 },
    { storeName: 'Store', userId: 'another' },
  ])('rejects invalid creation %j', async (body) => {
    await request(app.getHttpServer()).post('/sellers').send(body).expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('updates the session user profile and allows null descriptions', async () => {
    await request(app.getHttpServer())
      .patch('/sellers/me')
      .send({ description: null })
      .expect(200);
    expect(service.updateOwn).toHaveBeenCalledWith(sessionFixture.user.id, {
      description: null,
    });
  });

  it.each([{}, { storeName: ' ' }, { userId: 'another' }])(
    'rejects invalid update %j',
    async (body) => {
      await request(app.getHttpServer())
        .patch('/sellers/me')
        .send(body)
        .expect(400);
      expect(service.updateOwn).not.toHaveBeenCalled();
    },
  );

  it('deletes only the session user profile and returns an empty response', async () => {
    const response = await request(app.getHttpServer())
      .delete('/sellers/me')
      .expect(204);
    expect(response.text).toBe('');
    expect(service.deleteOwn).toHaveBeenCalledWith(sessionFixture.user.id);
  });

  it('does not expose updates or deletes by a client-supplied seller ID', async () => {
    await request(app.getHttpServer())
      .patch(`/sellers/${sellerFixture.id}`)
      .send({ storeName: 'Stolen' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/sellers/${sellerFixture.id}`)
      .expect(404);
    expect(service.updateOwn).not.toHaveBeenCalled();
    expect(service.deleteOwn).not.toHaveBeenCalled();
  });

  it.each(['/sellers/bad', '/sellers?page=0', '/sellers?limit=101'])(
    'rejects invalid public input %s',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(400);
    },
  );
});
