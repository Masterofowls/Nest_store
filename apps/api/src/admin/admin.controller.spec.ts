import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import { AdminDataService } from './admin-data.service';
import { AdminOrdersService } from './admin-orders.service';
import { AdminProductsService } from './admin-products.service';
import { AdminUsersService } from './admin-users.service';
import {
  AdminController,
  AdminOrdersController,
  AdminProductsController,
  AdminUsersController,
} from './admin.controller';

const ORDER_ID = '00000000-0000-4000-8000-000000000010';
const PRODUCT_ID = '00000000-0000-4000-8000-000000000011';
const CATEGORY_ID = '00000000-0000-4000-8000-000000000012';
const SELLER_ID = '00000000-0000-4000-8000-000000000013';

describe('Admin controllers', () => {
  let app: NestExpressApplication;
  const data = {
    stats: jest.fn(),
    importProducts: jest.fn(),
    importUsers: jest.fn(),
    exportResource: jest.fn(),
    exportCsv: jest.fn(),
    backup: jest.fn(),
  };
  const users = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const orders = { findAll: jest.fn(), findOne: jest.fn(), cancel: jest.fn() };
  const products = { create: jest.fn(), update: jest.fn(), delete: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [
        AdminController,
        AdminUsersController,
        AdminOrdersController,
        AdminProductsController,
      ],
      providers: [
        { provide: AdminDataService, useValue: data },
        { provide: AdminUsersService, useValue: users },
        { provide: AdminOrdersService, useValue: orders },
        { provide: AdminProductsService, useValue: products },
      ],
    })
      .overrideGuard(SessionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(WriteOriginGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication<NestExpressApplication>();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      Object.assign(req, { authSession: { user: { id: 'admin-1' } } });
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns dashboard stats', async () => {
    data.stats.mockResolvedValue({ users: 2 });
    await request(app.getHttpServer())
      .get('/admin/stats')
      .expect(200)
      .expect({ users: 2 });
  });

  it('imports products and users from a JSON csv field with status 200', async () => {
    data.importProducts.mockResolvedValue({ created: 1 });
    data.importUsers.mockResolvedValue({ created: 1, skipped: [] });
    await request(app.getHttpServer())
      .post('/admin/import/products')
      .send({ csv: 'a' })
      .expect(200)
      .expect({ created: 1 });
    await request(app.getHttpServer())
      .post('/admin/import/users')
      .send({ csv: 'b' })
      .expect(200);
    expect(data.importProducts).toHaveBeenCalledWith('a');
    expect(data.importUsers).toHaveBeenCalledWith('b');
  });

  it.each([{}, { csv: '' }, { csv: 'a', extra: 1 }])(
    'rejects import body %j',
    async (body) => {
      await request(app.getHttpServer())
        .post('/admin/import/products')
        .send(body)
        .expect(400);
      expect(data.importProducts).not.toHaveBeenCalled();
    },
  );

  it('exports JSON as an attachment', async () => {
    data.exportResource.mockResolvedValue({
      columns: ['id'],
      rows: [{ id: 1 }],
    });
    const response = await request(app.getHttpServer())
      .get('/admin/export/categories')
      .expect(200)
      .expect([{ id: 1 }]);
    expect(response.headers['content-disposition']).toMatch(
      /attachment; filename="categories-\d{4}-\d{2}-\d{2}\.json"/,
    );
  });

  it('exports CSV as an attachment', async () => {
    data.exportCsv.mockResolvedValue('id\r\n1\r\n');
    const response = await request(app.getHttpServer())
      .get('/admin/export/products?format=csv')
      .expect(200)
      .expect('Content-Type', /text\/csv/);
    expect(response.text).toBe('id\r\n1\r\n');
    expect(response.headers['content-disposition']).toMatch(/\.csv"/);
    expect(data.exportCsv).toHaveBeenCalledWith('products');
  });

  it('serves the backup route before the resource route', async () => {
    data.backup.mockResolvedValue({ products: [] });
    const response = await request(app.getHttpServer())
      .get('/admin/export/backup')
      .expect(200)
      .expect({ products: [] });
    expect(response.headers['content-disposition']).toMatch(/store-backup-/);
    expect(data.exportResource).not.toHaveBeenCalled();
  });

  it.each(['/admin/export/sessions', '/admin/export/users?format=xml'])(
    'rejects export %s',
    async (url) => {
      await request(app.getHttpServer()).get(url).expect(400);
    },
  );

  it('lists users with filters and passes the acting admin to writes', async () => {
    users.findAll.mockResolvedValue([]);
    users.update.mockResolvedValue({ id: 'u2' });
    users.delete.mockResolvedValue(undefined);
    await request(app.getHttpServer())
      .get('/admin/users?search=ann&role=admin&page=2')
      .expect(200);
    expect(users.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'ann', role: 'admin', page: 2 }),
    );
    await request(app.getHttpServer())
      .patch('/admin/users/u2')
      .send({ isAdmin: true })
      .expect(200);
    expect(users.update).toHaveBeenCalledWith('admin-1', 'u2', {
      isAdmin: true,
    });
    await request(app.getHttpServer()).delete('/admin/users/u2').expect(204);
    expect(users.delete).toHaveBeenCalledWith('admin-1', 'u2');
  });

  it('creates a user and sets Location', async () => {
    users.create.mockResolvedValue({ id: 'u3' });
    await request(app.getHttpServer())
      .post('/admin/users')
      .send({ name: 'Ann', email: 'ann@example.test', password: 'long-enough' })
      .expect(201)
      .expect('Location', '/admin/users/u3');
  });

  it('rejects malformed user IDs and bodies', async () => {
    await request(app.getHttpServer()).get('/admin/users/a%2Fb').expect(400);
    await request(app.getHttpServer())
      .patch('/admin/users/u2')
      .send({ email: 'x@example.test' })
      .expect(400);
    expect(users.findOne).not.toHaveBeenCalled();
    expect(users.update).not.toHaveBeenCalled();
  });

  it('lists, reads, and cancels orders', async () => {
    orders.findAll.mockResolvedValue([]);
    orders.findOne.mockResolvedValue({ id: ORDER_ID });
    orders.cancel.mockResolvedValue({ id: ORDER_ID, status: 'cancelled' });
    await request(app.getHttpServer())
      .get('/admin/orders?status=pending&userId=u1')
      .expect(200);
    expect(orders.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', userId: 'u1' }),
    );
    await request(app.getHttpServer())
      .get(`/admin/orders/${ORDER_ID}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/admin/orders/${ORDER_ID}`)
      .send({ status: 'cancelled' })
      .expect(200);
    expect(orders.cancel).toHaveBeenCalledWith(ORDER_ID, 'cancelled');
  });

  it('rejects order transitions other than cancellation', async () => {
    await request(app.getHttpServer())
      .patch(`/admin/orders/${ORDER_ID}`)
      .send({ status: 'pending' })
      .expect(400);
    await request(app.getHttpServer()).get('/admin/orders/bad').expect(400);
    expect(orders.cancel).not.toHaveBeenCalled();
  });

  it('creates, updates, and deletes any product', async () => {
    products.create.mockResolvedValue({ id: PRODUCT_ID });
    products.update.mockResolvedValue({ id: PRODUCT_ID });
    await request(app.getHttpServer())
      .post('/admin/products')
      .send({
        name: 'Desk',
        categoryId: CATEGORY_ID,
        sellerId: SELLER_ID,
        price: '10.00',
        stockQuantity: 2,
      })
      .expect(201)
      .expect('Location', `/products/${PRODUCT_ID}`);
    expect(products.create).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: SELLER_ID }),
    );
    await request(app.getHttpServer())
      .patch(`/admin/products/${PRODUCT_ID}`)
      .send({ stockQuantity: 0 })
      .expect(200);
    expect(products.update).toHaveBeenCalledWith(PRODUCT_ID, {
      stockQuantity: 0,
    });
    await request(app.getHttpServer())
      .delete(`/admin/products/${PRODUCT_ID}`)
      .expect(204);
    expect(products.delete).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it('rejects a product without a seller', async () => {
    await request(app.getHttpServer())
      .post('/admin/products')
      .send({
        name: 'Desk',
        categoryId: CATEGORY_ID,
        price: '10.00',
        stockQuantity: 2,
      })
      .expect(400);
    expect(products.create).not.toHaveBeenCalled();
  });
});
