import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import type { SessionRequest } from '../auth/session-request';
import { sessionUserId } from '../auth/session-user-id';
import { SellerGuard } from '../sellers/seller.guard';
import { requestSellerId } from '../sellers/seller-request';
import type { SellerRequest } from '../sellers/seller-request';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';
import { cancelOrderSchema } from '../orders/order.schema';
import { updateProductSchema } from '../products/product.schema';
import type { UpdateProductInput } from '../products/product.schema';
import { AdminDataService } from './admin-data.service';
import { AdminOrdersService } from './admin-orders.service';
import { AdminProductsService } from './admin-products.service';
import { AdminUsersService } from './admin-users.service';
import {
  adminCreateProductSchema,
  bulkDeleteProductsSchema,
  bulkDiscountProductsSchema,
  adminOrderQuerySchema,
  adminUserQuerySchema,
  createAdminUserSchema,
  exportQuerySchema,
  exportResourceSchema,
  importCsvSchema,
  updateAdminUserSchema,
  userIdSchema,
} from './admin.schema';
import type {
  AdminCreateProductInput,
  BulkDeleteProductsInput,
  BulkDiscountProductsInput,
  AdminOrderQuery,
  AdminUserQuery,
  CreateAdminUserInput,
  ExportQuery,
  ExportResource,
  ImportCsvInput,
  UpdateAdminUserInput,
} from './admin.schema';

@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminController {
  constructor(private readonly data: AdminDataService) {}

  @Get('stats')
  stats() {
    return this.data.stats();
  }

  @Post('import/products')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WriteOriginGuard)
  importProducts(
    @Body(new ZodValidationPipe(importCsvSchema)) input: ImportCsvInput,
  ) {
    return this.data.importProducts(input.csv);
  }

  @Post('import/users')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WriteOriginGuard)
  importUsers(
    @Body(new ZodValidationPipe(importCsvSchema)) input: ImportCsvInput,
  ) {
    return this.data.importUsers(input.csv);
  }

  @Get('export/backup')
  async backup(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    response.attachment(`store-backup-${today()}.json`);
    return this.data.backup();
  }

  @Get('export/:resource')
  async export(
    @Param('resource', new ZodValidationPipe(exportResourceSchema))
    resource: ExportResource,
    @Query(new ZodValidationPipe(exportQuerySchema)) query: ExportQuery,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.attachment(`${resource}-${today()}.${query.format}`);
    if (query.format === 'csv') {
      return this.data.exportCsv(resource);
    }
    const { rows } = await this.data.exportResource(resource);
    return rows;
  }
}

@Controller('admin/users')
@UseGuards(SessionGuard, AdminGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(adminUserQuerySchema)) query: AdminUserQuery,
  ) {
    return this.users.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ZodValidationPipe(userIdSchema)) id: string) {
    return this.users.findOne(id);
  }

  @Post()
  @UseGuards(WriteOriginGuard)
  async create(
    @Body(new ZodValidationPipe(createAdminUserSchema))
    input: CreateAdminUserInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const created = await this.users.create(input);
    response.location(`/admin/users/${created.id}`);
    return created;
  }

  @Patch(':id')
  @UseGuards(WriteOriginGuard)
  update(
    @Req() request: SessionRequest,
    @Param('id', new ZodValidationPipe(userIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateAdminUserSchema))
    input: UpdateAdminUserInput,
  ) {
    return this.users.update(sessionUserId(request), id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(WriteOriginGuard)
  delete(
    @Req() request: SessionRequest,
    @Param('id', new ZodValidationPipe(userIdSchema)) id: string,
  ) {
    return this.users.delete(sessionUserId(request), id);
  }
}

@Controller('admin/orders')
@UseGuards(SessionGuard, AdminGuard)
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(adminOrderQuerySchema)) query: AdminOrderQuery,
  ) {
    return this.orders.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.findOne(id);
  }

  @Patch(':id')
  @UseGuards(WriteOriginGuard)
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(cancelOrderSchema))
    input: { status: 'cancelled' },
  ) {
    return this.orders.cancel(id, input.status);
  }
}

@Controller('admin/products')
@UseGuards(SessionGuard, AdminGuard)
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Post('bulk/delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WriteOriginGuard)
  bulkDelete(
    @Body(new ZodValidationPipe(bulkDeleteProductsSchema))
    input: BulkDeleteProductsInput,
  ) {
    return this.products.bulkDelete(input.ids);
  }

  @Post('bulk/discount')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WriteOriginGuard)
  bulkDiscount(
    @Body(new ZodValidationPipe(bulkDiscountProductsSchema))
    input: BulkDiscountProductsInput,
  ) {
    return this.products.bulkDiscount(input.ids, input.discountPercent);
  }

  @Post()
  @UseGuards(WriteOriginGuard)
  async create(
    @Body(new ZodValidationPipe(adminCreateProductSchema))
    input: AdminCreateProductInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const product = await this.products.create(input);
    response.location(`/products/${product.id}`);
    return product;
  }

  @Patch(':id')
  @UseGuards(WriteOriginGuard)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) input: UpdateProductInput,
  ) {
    return this.products.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(WriteOriginGuard)
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.products.delete(id);
  }
}

@Controller('seller')
@UseGuards(SessionGuard, SellerGuard)
export class SellerManagementController {
  constructor(
    private readonly data: AdminDataService,
    private readonly products: AdminProductsService,
  ) {}

  @Post('import/products')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WriteOriginGuard)
  importProducts(
    @Req() request: SellerRequest,
    @Body(new ZodValidationPipe(importCsvSchema)) input: ImportCsvInput,
  ) {
    return this.data.importProducts(input.csv, requestSellerId(request));
  }

  @Get('export/backup')
  backup(
    @Req() request: SellerRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    response.attachment(`seller-backup-${today()}.json`);
    return this.data.sellerBackup(requestSellerId(request));
  }

  @Post('products/bulk/delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WriteOriginGuard)
  bulkDelete(
    @Req() request: SellerRequest,
    @Body(new ZodValidationPipe(bulkDeleteProductsSchema))
    input: BulkDeleteProductsInput,
  ) {
    return this.products.bulkDelete(input.ids, requestSellerId(request));
  }

  @Post('products/bulk/discount')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WriteOriginGuard)
  bulkDiscount(
    @Req() request: SellerRequest,
    @Body(new ZodValidationPipe(bulkDiscountProductsSchema))
    input: BulkDiscountProductsInput,
  ) {
    return this.products.bulkDiscount(
      input.ids,
      input.discountPercent,
      requestSellerId(request),
    );
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
