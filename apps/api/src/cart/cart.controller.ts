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
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import type { SessionRequest } from '../auth/session-request';
import { sessionUserId } from '../auth/session-user-id';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';
import { CartService } from './cart.service';
import {
  addCartItemSchema,
  cartQuerySchema,
  updateCartItemSchema,
} from './cart.schema';
import type {
  AddCartItemInput,
  CartQuery,
  UpdateCartItemInput,
} from './cart.schema';

@Controller('cart')
@UseGuards(SessionGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  find(
    @Req() request: SessionRequest,
    @Query(new ZodValidationPipe(cartQuerySchema)) query: CartQuery,
  ) {
    return this.cart.find(sessionUserId(request), query);
  }

  @Post('items')
  @UseGuards(WriteOriginGuard)
  add(
    @Req() request: SessionRequest,
    @Body(new ZodValidationPipe(addCartItemSchema)) input: AddCartItemInput,
  ) {
    return this.cart.add(sessionUserId(request), input);
  }

  @Patch('items/:id')
  @UseGuards(WriteOriginGuard)
  update(
    @Req() request: SessionRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateCartItemSchema))
    input: UpdateCartItemInput,
  ) {
    return this.cart.update(sessionUserId(request), id, input);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(WriteOriginGuard)
  delete(
    @Req() request: SessionRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.cart.delete(sessionUserId(request), id);
  }
}
