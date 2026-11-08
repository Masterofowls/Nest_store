import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { SellersController } from './sellers.controller';
import { SellersService } from './sellers.service';
import { SellerGuard } from './seller.guard';

@Module({
  imports: [AuthModule, DbModule],
  controllers: [SellersController],
  providers: [SellersService, SellerGuard],
  exports: [SellersService, SellerGuard],
})
export class SellersModule {}
