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

  it('should return a product by id', () => {
    expect(service.findOne('p1')).toEqual({
      id: 'p1',
      name: 'Mechanical Keyboard',
    });
  });

  it('should return undefined when product is not found', () => {
    expect(service.findOne('missing')).toEqual(undefined);
  });

  it('should return product', () => {
    expect(service.getOrThrow('p1')).toEqual({
      id: 'p1',
      name: 'Mechanical Keyboard',
    });
  });

  it('should throw NotFound Exception when product is not found', () => {
    expect(() => service.getOrThrow('some')).toThrow(NotFoundException);
  });
});
