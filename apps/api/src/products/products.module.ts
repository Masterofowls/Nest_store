import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { SellersModule } from '../sellers/sellers.module';

@Module({
  imports: [DbModule, AuthModule, SellersModule],
  providers: [ProductsService],
  controllers: [ProductsController],
})
export class ProductsModule {}
