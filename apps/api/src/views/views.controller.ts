import {
  Body,
  Controller,
  Get,
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
import { createViewSchema, viewQuerySchema } from './view.schema';
import type { ViewQuery } from './view.schema';
import { ViewsService } from './views.service';

@Controller('products/:productId/views')
export class ViewsController {
  constructor(private readonly views: ViewsService) {}

  @Post()
  @UseGuards(SessionGuard, WriteOriginGuard)
  async record(
    @Req() request: SessionRequest,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body(new ZodValidationPipe(createViewSchema)) _body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    void _body;
    if (!request.authSession) {
      throw new UnauthorizedException();
    }
    const view = await this.views.record(
      request.authSession.user.id,
      productId,
    );
    response.location('/users/me/views');
    return view;
  }
}

@Controller('users/me/views')
@UseGuards(SessionGuard)
export class ViewsHistoryController {
  constructor(private readonly views: ViewsService) {}

  @Get()
  findOwn(
    @Req() request: SessionRequest,
    @Query(new ZodValidationPipe(viewQuerySchema)) query: ViewQuery,
  ) {
    if (!request.authSession) {
      throw new UnauthorizedException();
    }
    return this.views.findOwn(request.authSession.user.id, query);
  }
}
