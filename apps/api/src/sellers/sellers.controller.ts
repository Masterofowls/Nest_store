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
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import type { SessionRequest } from '../auth/session-request';
import { sessionUserId } from '../auth/session-user-id';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';
import { paginationSchema } from '../common/pagination.schema';
import type { PaginationQuery } from '../common/pagination.schema';
import { createSellerSchema, updateSellerSchema } from './seller.schema';
import type { CreateSellerInput, UpdateSellerInput } from './seller.schema';
import { SellersService } from './sellers.service';

@Controller('sellers')
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationQuery,
  ) {
    return this.sellers.findAll(query);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  findOwn(@Req() request: SessionRequest) {
    return this.sellers.findOwn(sessionUserId(request));
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.sellers.findOne(id);
  }

  @Post()
  @UseGuards(SessionGuard, WriteOriginGuard)
  async create(
    @Req() request: SessionRequest,
    @Body(new ZodValidationPipe(createSellerSchema)) input: CreateSellerInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const profile = await this.sellers.create(sessionUserId(request), input);
    response.location(`/sellers/${profile.id}`);
    return profile;
  }

  @Patch('me')
  @UseGuards(SessionGuard, WriteOriginGuard)
  updateOwn(
    @Req() request: SessionRequest,
    @Body(new ZodValidationPipe(updateSellerSchema)) input: UpdateSellerInput,
  ) {
    return this.sellers.updateOwn(sessionUserId(request), input);
  }

  @Delete('me')
  @HttpCode(204)
  @UseGuards(SessionGuard, WriteOriginGuard)
  deleteOwn(@Req() request: SessionRequest) {
    return this.sellers.deleteOwn(sessionUserId(request));
  }
}
