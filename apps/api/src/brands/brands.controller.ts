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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';
import { brandSchema } from './brand.schema';
import type { BrandInput } from './brand.schema';
import { BrandsService } from './brands.service';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  findAll() {
    return this.brands.findAll();
  }
}

@Controller('admin/brands')
@UseGuards(SessionGuard, AdminGuard, WriteOriginGuard)
export class AdminBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(brandSchema)) input: BrandInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const brand = await this.brands.create(input);
    response.location(`/admin/brands/${brand.id}`);
    return brand;
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(brandSchema)) input: BrandInput,
  ) {
    return this.brands.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.brands.delete(id);
  }
}
