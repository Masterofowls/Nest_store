import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { SellersModule } from '../sellers/sellers.module';
import { ImagesController, ImageCleanupController } from './images.controller';
import { ImagesService } from './images.service';
import { ImageCleanupService } from './image-cleanup.service';
import { StorageService } from './storage.service';

@Module({
  imports: [AuthModule, DbModule, SellersModule],
  controllers: [ImagesController, ImageCleanupController],
  providers: [ImagesService, ImageCleanupService, StorageService],
})
export class ImagesModule {}
