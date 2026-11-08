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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import type { SessionRequest } from '../auth/session-request';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';
import {
  createRatingSchema,
  emptyRatingBodySchema,
  ratingQuerySchema,
  updateRatingSchema,
} from './rating.schema';
import type {
  CreateRatingInput,
  RatingQuery,
  UpdateRatingInput,
} from './rating.schema';
import { RatingsService } from './ratings.service';

@Controller('ratings')
@UseGuards(SessionGuard)
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Get()
  findOwn(
    @Req() request: SessionRequest,
    @Query(new ZodValidationPipe(ratingQuerySchema)) query: RatingQuery,
  ) {
    return this.ratings.findOwn(this.userId(request), query);
  }

  @Post()
  @UseGuards(WriteOriginGuard)
  async create(
    @Req() request: SessionRequest,
    @Body(new ZodValidationPipe(createRatingSchema)) input: CreateRatingInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rating = await this.ratings.create(this.userId(request), input);
    response.location(`/ratings/${rating.id}`);
    return rating;
  }

  @Patch(':id')
  @UseGuards(WriteOriginGuard)
  update(
    @Req() request: SessionRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateRatingSchema)) input: UpdateRatingInput,
  ) {
    return this.ratings.update(this.userId(request), id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(WriteOriginGuard)
  remove(
    @Req() request: SessionRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(emptyRatingBodySchema)) _body: unknown,
  ) {
    void _body;
    return this.ratings.remove(this.userId(request), id);
  }

  private userId(request: SessionRequest): string {
    if (!request.authSession) {
      throw new UnauthorizedException();
    }
    return request.authSession.user.id;
  }
}

@Controller('products/:productId/ratings')
export class ProductRatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Get()
  findAll(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Query(new ZodValidationPipe(ratingQuerySchema)) query: RatingQuery,
  ) {
    return this.ratings.findForProduct(productId, query);
  }
}
