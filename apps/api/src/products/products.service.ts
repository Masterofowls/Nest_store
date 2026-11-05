import { Injectable, NotFoundException } from '@nestjs/common';
import { Product } from './product.interface';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ProductsService {
  private readonly products: Product[] = [
    { id: 'p1', name: 'Mechanical Keyboard' },
    { id: 'p2', name: 'Wireless Mouse' },
  ];
  findAll(search?: string, page: number = 1, limit: number = 10) {
    const normalizedSearch = search?.trim().toLowerCase();
    const offset = (page - 1) * limit;

    const searchResults = normalizedSearch
      ? this.products.filter((product) =>
          product.name.toLowerCase().includes(normalizedSearch),
        )
      : this.products;

    return searchResults.slice(offset, offset + limit);
  }

  findOne(id: string) {
    return this.products.find((product) => product.id === id);
  }

  postProduct(name: string): Product {
    const product = {
      id: randomUUID(),
      name: name,
    };
    this.products.push(product);
    return product;
  }

  patchProduct(name: string, id: string): Product {
    const product = this.getOrThrow(id);
    product.name = name;
    return product;
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
