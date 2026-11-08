import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthService } from './auth.service';
import { SessionGuard } from './guards/session/session.guard';
import { WriteOriginGuard } from './guards/write-origin.guard';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [DbModule],
  providers: [AuthService, SessionGuard, WriteOriginGuard, AdminGuard],
  exports: [AuthService, SessionGuard, WriteOriginGuard, AdminGuard],
})
export class AuthModule {}
