import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/env.schema';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SellersModule } from './sellers/sellers.module';
import { CategoriesModule } from './categories/categories.module';
import { ImagesModule } from './images/images.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { FavouritesModule } from './favourites/favourites.module';
import { RatingsModule } from './ratings/ratings.module';
import { ViewsModule } from './views/views.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { BannersModule } from './banners/banners.module';
import { AdminModule } from './admin/admin.module';
import { BrandsModule } from './brands/brands.module';
import { AttributesModule } from './attributes/attributes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      envFilePath: '.env',
      validate: validateEnvironment,
    }),
    ProductsModule,
    DbModule,
    AuthModule,
    UsersModule,
    SellersModule,
    CategoriesModule,
    ImagesModule,
    CartModule,
    OrdersModule,
    FavouritesModule,
    RatingsModule,
    ViewsModule,
    RecommendationsModule,
    BannersModule,
    AdminModule,
    BrandsModule,
    AttributesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
