import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  imports: [AuthModule, DbModule],
  providers: [UsersService],
})
export class UsersModule {}
