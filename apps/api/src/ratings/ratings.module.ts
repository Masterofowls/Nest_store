import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import {
  ProductRatingsController,
  RatingsController,
} from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [AuthModule, DbModule],
  controllers: [RatingsController, ProductRatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
