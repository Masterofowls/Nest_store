import {
  Body,
  Controller,
  Get,
  Headers,
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
import {
  cancelOrderSchema,
  checkoutBodySchema,
  orderQuerySchema,
} from './order.schema';
import type { OrderQuery } from './order.schema';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(SessionGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  findAll(
    @Req() request: SessionRequest,
    @Query(new ZodValidationPipe(orderQuerySchema)) query: OrderQuery,
  ) {
    return this.orders.findAll(sessionUserId(request), query);
  }

  @Get(':id')
  findOne(
    @Req() request: SessionRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.orders.findOne(sessionUserId(request), id);
  }

  @Post()
  @UseGuards(WriteOriginGuard)
  async checkout(
    @Req() request: SessionRequest,
    @Headers('idempotency-key') key: string,
    @Body(new ZodValidationPipe(checkoutBodySchema))
    _input: Record<string, never>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const order = await this.orders.checkout(sessionUserId(request), key);
    response.location(`/orders/${order.id}`);
    return order;
  }

  @Patch(':id')
  @UseGuards(WriteOriginGuard)
  cancel(
    @Req() request: SessionRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(cancelOrderSchema))
    input: { status: 'cancelled' },
  ) {
    return this.orders.cancel(sessionUserId(request), id, input.status);
  }
}
