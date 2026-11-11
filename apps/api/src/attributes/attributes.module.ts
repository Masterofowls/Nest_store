import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import {
  AdminAttributesController,
  AttributesController,
} from './attributes.controller';
import { AttributesService } from './attributes.service';

@Module({
  imports: [AuthModule, DbModule],
  controllers: [AttributesController, AdminAttributesController],
  providers: [AttributesService],
})
export class AttributesModule {}
