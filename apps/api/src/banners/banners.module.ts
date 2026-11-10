import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import {
  AdminBannersController,
  BannersController,
} from './banners.controller';
import { BannersService } from './banners.service';

@Module({
  imports: [AuthModule, DbModule],
  controllers: [BannersController, AdminBannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
