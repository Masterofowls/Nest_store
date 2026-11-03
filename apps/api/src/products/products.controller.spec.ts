import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { NotFoundException } from '@nestjs/common';

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [ProductsService],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should return the products', () => {
    expect(controller.findAll()).toEqual([
      { id: 'p1', name: 'Mechanical Keyboard' },
      { id: 'p2', name: 'Wireless Mouse' },
    ]);
  });

  it('should return one product', () => {
    expect(controller.findOne('p1')).toEqual({
      id: 'p1',
      name: 'Mechanical Keyboard',
    });
  });
  it('should throw error for unknown id', () => {
    expect(() => controller.findOne('missing')).toThrow(NotFoundException);
  });
});
