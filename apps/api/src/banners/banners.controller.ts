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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';
import { pageOnlySchema } from '../common/pagination.schema';
import type { PageOnlyQuery } from '../common/pagination.schema';
import { createBannerSchema, updateBannerSchema } from './banner.schema';
import type { CreateBannerInput, UpdateBannerInput } from './banner.schema';
import { BannersService } from './banners.service';

@Controller('banners')
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  findActive() {
    return this.banners.findActive();
  }
}

@Controller('admin/banners')
@UseGuards(SessionGuard, AdminGuard)
export class AdminBannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  findAll(@Query(new ZodValidationPipe(pageOnlySchema)) query: PageOnlyQuery) {
    return this.banners.findAll(query);
  }

  @Post()
  @UseGuards(WriteOriginGuard)
  async create(
    @Body(new ZodValidationPipe(createBannerSchema)) input: CreateBannerInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const banner = await this.banners.create(input);
    response.location(`/admin/banners/${banner.id}`);
    return banner;
  }

  @Patch(':id')
  @UseGuards(WriteOriginGuard)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateBannerSchema)) input: UpdateBannerInput,
  ) {
    return this.banners.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(WriteOriginGuard)
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.banners.delete(id);
  }
}
