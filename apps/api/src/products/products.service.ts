import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class ProductsService {
  findAll() {
    return [
      { id: 'p1', name: 'Mechanical Keyboard' },
      { id: 'p2', name: 'Wireless Mouse' },
    ];
  }
  findOne(id: string) {
    return this.findAll().find((product) => product.id === id);
  }
  getOrThrow(id: string) {
    const result = this.findOne(id);
    if (result === undefined) {
      throw new NotFoundException('Product not found');
    } else {
      return result;
    }
  }
}
