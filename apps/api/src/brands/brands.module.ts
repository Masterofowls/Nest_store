import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { AdminBrandsController, BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

@Module({
  imports: [AuthModule, DbModule],
  controllers: [BrandsController, AdminBrandsController],
  providers: [BrandsService],
})
export class BrandsModule {}
