import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Post,
  Body,
  Patch,
} from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must be positive integers');
    } else {
      return this.productsService.findAll(search, page, limit);
    }
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.getOrThrow(id);
  }

  @Post()
  postProduct(@Body('name') name: unknown) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new BadRequestException('Name must be a non-empty string');
    }
    return this.productsService.postProduct(name.trim());
  }

  @Patch(':id')
  patchProduct(@Param('id') id: string, @Body('name') name: unknown) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new BadRequestException('Name must be a non-empty string');
    }
    return this.productsService.patchProduct(name.trim(), id);
  }
}
