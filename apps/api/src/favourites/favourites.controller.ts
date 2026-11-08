import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import type { SessionRequest } from '../auth/session-request';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';
import {
  createFavouriteSchema,
  emptyFavouriteBodySchema,
  favouriteQuerySchema,
} from './favourite.schema';
import type { CreateFavouriteInput, FavouriteQuery } from './favourite.schema';
import { FavouritesService } from './favourites.service';

@Controller('favourites')
@UseGuards(SessionGuard)
export class FavouritesController {
  constructor(private readonly favourites: FavouritesService) {}

  @Get()
  findAll(
    @Req() request: SessionRequest,
    @Query(new ZodValidationPipe(favouriteQuerySchema)) query: FavouriteQuery,
  ) {
    return this.favourites.findAll(this.userId(request), query);
  }

  @Post()
  @UseGuards(WriteOriginGuard)
  async create(
    @Req() request: SessionRequest,
    @Body(new ZodValidationPipe(createFavouriteSchema))
    input: CreateFavouriteInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const favourite = await this.favourites.create(
      this.userId(request),
      input.productId,
    );
    response.location(`/favourites/${favourite.id}`);
    return favourite;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(WriteOriginGuard)
  remove(
    @Req() request: SessionRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(emptyFavouriteBodySchema)) _body: unknown,
  ) {
    void _body;
    return this.favourites.remove(this.userId(request), id);
  }

  private userId(request: SessionRequest): string {
    if (!request.authSession) {
      throw new UnauthorizedException();
    }
    return request.authSession.user.id;
  }
}
