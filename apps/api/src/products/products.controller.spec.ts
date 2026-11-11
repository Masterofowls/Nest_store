import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import { SellerGuard } from '../sellers/seller.guard';
import type { SellerRequest } from '../sellers/seller-request';
import { productFixture, sellerFixture } from '../../test/marketplace.fixtures';

const productJson = JSON.parse(JSON.stringify(productFixture)) as object;

describe('ProductsController input and service mapping', () => {
  let app: NestExpressApplication;
  const service = {
    findAll: jest.fn(),
    findDetail: jest.fn(),
    findFacets: jest.fn(),
    findCompared: jest.fn(),
    postProduct: jest.fn(),
    patchProduct: jest.fn(),
    deleteProduct: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    service.findAll.mockResolvedValue([productFixture]);
    service.findDetail.mockResolvedValue(productFixture);
    service.findFacets.mockResolvedValue({ brands: [], attributes: [] });
    service.findCompared.mockResolvedValue([productFixture]);
    service.postProduct.mockResolvedValue(productFixture);
    service.patchProduct.mockResolvedValue(productFixture);
    service.deleteProduct.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: service }],
    })
      .overrideGuard(SessionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(WriteOriginGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SellerGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest<SellerRequest>().sellerProfile =
            sellerFixture;
          return true;
        },
      })
      .compile();
    app = module.createNestApplication<NestExpressApplication>();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('parses pagination and filters before calling the service', async () => {
    await request(app.getHttpServer())
      .get(
        `/products?search=KEY&page=2&limit=1&categoryId=${productFixture.categoryId}`,
      )
      .expect(200)
      .expect([productJson]);
    expect(service.findAll).toHaveBeenCalledWith({
      search: 'KEY',
      page: 2,
      limit: 1,
      categoryId: productFixture.categoryId,
    });
  });

  it('reads a UUID product', async () => {
    await request(app.getHttpServer())
      .get(`/products/${productFixture.id}`)
      .expect(200)
      .expect(productJson);
    expect(service.findDetail).toHaveBeenCalledWith(productFixture.id);
  });

  it('reads a product by slug', async () => {
    await request(app.getHttpServer())
      .get(`/products/${productFixture.slug}`)
      .expect(200);
    expect(service.findDetail).toHaveBeenCalledWith(productFixture.slug);
  });

  it('parses brand and attribute filters for the list and facets', async () => {
    const brandId = '00000000-0000-4000-8000-000000000009';
    const query = `brandIds=${brandId}&attrs=color:black|white;anc:true`;
    const parsed = expect.objectContaining({
      brandIds: [brandId],
      attrs: [
        { slug: 'color', values: ['black', 'white'] },
        { slug: 'anc', values: ['true'] },
      ],
    }) as unknown;
    await request(app.getHttpServer()).get(`/products?${query}`).expect(200);
    expect(service.findAll).toHaveBeenCalledWith(parsed);
    await request(app.getHttpServer())
      .get(`/products/facets?${query}`)
      .expect(200);
    expect(service.findFacets).toHaveBeenCalledWith(parsed);
    expect(service.findDetail).not.toHaveBeenCalled();
  });

  it.each([
    'attrs=color',
    'attrs=Color:black',
    'attrs=color:',
    'attrs=color:a;color:b',
    'brandIds=not-a-uuid',
  ])('rejects the malformed filter %s', async (query) => {
    await request(app.getHttpServer()).get(`/products?${query}`).expect(400);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('compares up to four products and rejects a fifth', async () => {
    const ids = [1, 2, 3, 4, 5].map(
      (n) => `00000000-0000-4000-8000-00000000000${n}`,
    );
    await request(app.getHttpServer())
      .get(`/products/compare?ids=${ids.slice(0, 4).join(',')}`)
      .expect(200);
    expect(service.findCompared).toHaveBeenCalledWith(ids.slice(0, 4));
    await request(app.getHttpServer())
      .get(`/products/compare?ids=${ids.join(',')}`)
      .expect(400);
    expect(service.findCompared).toHaveBeenCalledTimes(1);
  });

  it('creates a validated product with server-derived seller and Location', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send({
        name: '  Keyboard  ',
        categoryId: productFixture.categoryId,
        stockQuantity: 0,
        price: '0',
      })
      .expect(201)
      .expect('Location', `/products/${productFixture.id}`);
    expect(service.postProduct).toHaveBeenCalledWith(
      {
        name: 'Keyboard',
        categoryId: productFixture.categoryId,
        stockQuantity: 0,
        price: '0',
      },
      sellerFixture.id,
    );
  });

  it.each([
    {},
    { name: 42 },
    { name: '' },
    { name: ' ' },
    { sellerId: sellerFixture.id },
  ])('rejects an invalid or empty update %j', async (body) => {
    await request(app.getHttpServer())
      .patch(`/products/${productFixture.id}`)
      .send(body)
      .expect(400);
    expect(service.patchProduct).not.toHaveBeenCalled();
  });

  it('preserves null and zero in partial updates', async () => {
    await request(app.getHttpServer())
      .patch(`/products/${productFixture.id}`)
      .send({ description: null, stockQuantity: 0 })
      .expect(200);
    expect(service.patchProduct).toHaveBeenCalledWith(
      { description: null, stockQuantity: 0 },
      productFixture.id,
      sellerFixture.id,
    );
  });

  it('deletes with the server-derived seller and returns no body', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/products/${productFixture.id}`)
      .expect(204);
    expect(response.text).toBe('');
    expect(service.deleteProduct).toHaveBeenCalledWith(
      productFixture.id,
      sellerFixture.id,
    );
  });

  it.each([
    'page=0',
    'page=abc',
    'page=1.5',
    'page=-1',
    'limit=0',
    'limit=-1',
    'limit=abc',
    'limit=101',
    'categoryId=bad',
    'sellerId=bad',
    'search=a&search=b',
  ])('rejects invalid query %s', async (query) => {
    await request(app.getHttpServer()).get(`/products?${query}`).expect(400);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it.each(['Bad_Ref', 'UPPER-case', 'trailing-', 'a--b'])(
    'rejects the malformed product reference %s',
    async (reference) => {
      await request(app.getHttpServer())
        .get(`/products/${reference}`)
        .expect(400);
      expect(service.findDetail).not.toHaveBeenCalled();
    },
  );
});
