import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';
import { paginationSchema } from '../common/pagination.schema';
import type { PaginationQuery } from '../common/pagination.schema';
import { categorySchema } from './category.schema';
import type { CategoryInput } from './category.schema';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationQuery,
  ) {
    return this.categories.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.categories.findOne(id);
  }

  @Post()
  @UseGuards(SessionGuard, WriteOriginGuard, AdminGuard)
  async create(
    @Body(new ZodValidationPipe(categorySchema)) input: CategoryInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const category = await this.categories.create(input);
    response.location(`/categories/${category.id}`);
    return category;
  }

  @Patch(':id')
  @UseGuards(SessionGuard, WriteOriginGuard, AdminGuard)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(categorySchema)) input: CategoryInput,
  ) {
    return this.categories.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(SessionGuard, WriteOriginGuard, AdminGuard)
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.categories.delete(id);
  }
}
