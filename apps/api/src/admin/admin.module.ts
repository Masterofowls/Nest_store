import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { OrdersModule } from '../orders/orders.module';
import { SellersModule } from '../sellers/sellers.module';
import { AdminDataService } from './admin-data.service';
import { AdminOrdersService } from './admin-orders.service';
import { AdminProductsService } from './admin-products.service';
import { AdminUsersService } from './admin-users.service';
import {
  AdminController,
  AdminOrdersController,
  AdminProductsController,
  AdminUsersController,
  SellerManagementController,
} from './admin.controller';

@Module({
  imports: [AuthModule, DbModule, OrdersModule, SellersModule],
  controllers: [
    AdminController,
    AdminUsersController,
    AdminOrdersController,
    AdminProductsController,
    SellerManagementController,
  ],
  providers: [
    AdminDataService,
    AdminUsersService,
    AdminOrdersService,
    AdminProductsService,
  ],
})
export class AdminModule {}
