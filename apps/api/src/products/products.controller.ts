import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Post,
  Body,
  Patch,
  Delete,
  HttpStatus,
  HttpCode,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import type { Response } from 'express';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import { SellerGuard } from '../sellers/seller.guard';
import type { SellerRequest } from '../sellers/seller-request';
import { requestSellerId } from '../sellers/seller-request';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';
import {
  compareQuerySchema,
  createProductSchema,
  productQuerySchema,
  productReferenceSchema,
  updateProductSchema,
} from './product.schema';
import type {
  CompareQuery,
  CreateProductInput,
  ProductQuery,
  UpdateProductInput,
} from './product.schema';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(productQuerySchema)) query: ProductQuery,
  ) {
    return this.productsService.findAll(query);
  }

  // Filters apply; paging and sorting do not.
  @Get('facets')
  findFacets(
    @Query(new ZodValidationPipe(productQuerySchema)) query: ProductQuery,
  ) {
    return this.productsService.findFacets(query);
  }

  @Get('compare')
  findCompared(
    @Query(new ZodValidationPipe(compareQuerySchema)) query: CompareQuery,
  ) {
    return this.productsService.findCompared(query.ids);
  }

  @Get(':reference')
  findOne(
    @Param('reference', new ZodValidationPipe(productReferenceSchema))
    reference: string,
  ) {
    return this.productsService.findDetail(reference);
  }

  @Post()
  @UseGuards(SessionGuard, WriteOriginGuard, SellerGuard)
  async postProduct(
    @Body(new ZodValidationPipe(createProductSchema)) input: CreateProductInput,
    @Req() request: SellerRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const product = await this.productsService.postProduct(
      input,
      requestSellerId(request),
    );
    response.location(`/products/${product.id}`);
    return product;
  }

  @Patch(':id')
  @UseGuards(SessionGuard, WriteOriginGuard, SellerGuard)
  patchProduct(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) input: UpdateProductInput,
    @Req() request: SellerRequest,
  ) {
    return this.productsService.patchProduct(
      input,
      id,
      requestSellerId(request),
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  @UseGuards(SessionGuard, WriteOriginGuard, SellerGuard)
  deleteProduct(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: SellerRequest,
  ) {
    return this.productsService.deleteProduct(id, requestSellerId(request));
  }
}
