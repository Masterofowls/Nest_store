import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { ViewsController, ViewsHistoryController } from './views.controller';
import { ViewsService } from './views.service';

@Module({
  imports: [AuthModule, DbModule],
  controllers: [ViewsController, ViewsHistoryController],
  providers: [ViewsService],
})
export class ViewsModule {}
