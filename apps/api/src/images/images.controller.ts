import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type {} from 'multer';
import { SessionGuard } from '../auth/guards/session/session.guard';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SellerGuard } from '../sellers/seller.guard';
import type { SellerRequest } from '../sellers/seller-request';
import { requestSellerId } from '../sellers/seller-request';
import { maximumImageBytes } from './image-validation';
import { ImagesService } from './images.service';
import { ImageCleanupService } from './image-cleanup.service';

@Controller('products/:productId/images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Get()
  list(@Param('productId', new ParseUUIDPipe()) productId: string) {
    return this.images.list(productId);
  }

  @Post()
  @UseGuards(SessionGuard, WriteOriginGuard, SellerGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: maximumImageBytes, files: 1, fields: 0 },
    }),
  )
  upload(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Req() request: SellerRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('An image file is required');
    return this.images.upload(productId, requestSellerId(request), file.buffer);
  }

  @Delete(':imageId')
  @HttpCode(204)
  @UseGuards(SessionGuard, WriteOriginGuard, SellerGuard)
  delete(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
    @Req() request: SellerRequest,
  ) {
    return this.images.delete(productId, imageId, requestSellerId(request));
  }
}

@Controller('product-images/cleanup')
export class ImageCleanupController {
  constructor(private readonly cleanup: ImageCleanupService) {}

  @Post()
  @UseGuards(SessionGuard, WriteOriginGuard, AdminGuard)
  flush() {
    return this.cleanup.flush();
  }
}
