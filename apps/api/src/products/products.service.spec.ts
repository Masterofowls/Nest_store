import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { NotFoundException } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should return all products', () => {
    expect(service.findAll()).toEqual([
      { id: 'p1', name: 'Mechanical Keyboard' },
      { id: 'p2', name: 'Wireless Mouse' },
    ]);
  });

  it('should return only p1', () => {
    expect(service.findAll(undefined, 1, 1)).toEqual([
      { id: 'p1', name: 'Mechanical Keyboard' },
    ]);
  });

  it('should return only p2', () => {
    expect(service.findAll(undefined, 2, 1)).toEqual([
      { id: 'p2', name: 'Wireless Mouse' },
    ]);
  });

  it('should return empty', () => {
    expect(service.findAll(undefined, 3, 1)).toEqual([]);
  });

  it('should return only p2', () => {
    expect(service.findAll('mouse', 1, 1)).toEqual([
      { id: 'p2', name: 'Wireless Mouse' },
    ]);
  });

  it('should return partial search', () => {
    expect(service.findAll('key')).toEqual([
      { id: 'p1', name: 'Mechanical Keyboard' },
    ]);
  });

  it('should return case insensitive search', () => {
    expect(service.findAll('MOUSE')).toEqual([
      { id: 'p2', name: 'Wireless Mouse' },
    ]);
  });

  it('should return no-match search', () => {
    expect(service.findAll('Monitor')).toEqual([]);
  });

  it('should return a product by id', () => {
    expect(service.findOne('p1')).toEqual({
      id: 'p1',
      name: 'Mechanical Keyboard',
    });
  });

  it('should return undefined when product is not found', () => {
    expect(service.findOne('missing')).toEqual(undefined);
  });

  it('should create a product with a generated ID', () => {
    const product = service.postProduct('USB-C Hub');

    expect(product).toMatchObject({ name: 'USB-C Hub' });
    expect(product.id).toEqual(expect.any(String));
    expect(product.id).not.toBe('');
  });

  it('should create a product with and find it', () => {
    const product = service.postProduct('HDMI cable');

    expect(product).toMatchObject({ name: 'HDMI cable' });
    expect(product.id).toEqual(expect.any(String));
    expect(product.id).not.toBe('');
    expect(service.findOne(product.id)).toEqual({
      id: product.id,
      name: 'HDMI cable',
    });
  });

  it('should create two products and check their distinct ids', () => {
    const product1 = service.postProduct('Laptop');
    const product2 = service.postProduct('Phone');

    expect(product1).toMatchObject({ name: 'Laptop' });
    expect(product1.id).toEqual(expect.any(String));
    expect(product1.id).not.toBe('');
    expect(product2).toMatchObject({ name: 'Phone' });
    expect(product2.id).toEqual(expect.any(String));
    expect(product2.id).not.toBe('');
    expect(product1.id).not.toBe(product2.id);
  });

  it('should return product', () => {
    expect(service.getOrThrow('p1')).toEqual({
      id: 'p1',
      name: 'Mechanical Keyboard',
    });
  });

  it('should delete product', () => {
    service.deleteProduct('p1');
    expect(service.findOne('p1')).toBeUndefined();
    expect(service.findAll()).toEqual([{ id: 'p2', name: 'Wireless Mouse' }]);
  });

  it('should reject deleting an unknown product', () => {
    expect(() => service.deleteProduct('missing')).toThrow(NotFoundException);
    expect(service.findAll()).toHaveLength(2);
  });

  it('should update product', () => {
    expect(service.patchProduct('Laptop', 'p1')).toEqual({
      id: 'p1',
      name: 'Laptop',
    });
    expect(service.findOne('p1')).toEqual({
      id: 'p1',
      name: 'Laptop',
    });
    expect(service.findAll()).toHaveLength(2);
  });

  it('should reject updating an unknown product', () => {
    expect(() => service.patchProduct('Laptop', 'missing')).toThrow(
      NotFoundException,
    );
  });

  it('should throw NotFound Exception when product is not found', () => {
    expect(() => service.getOrThrow('some')).toThrow(NotFoundException);
  });
});
