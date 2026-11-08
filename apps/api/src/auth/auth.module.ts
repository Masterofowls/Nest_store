import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthService } from './auth.service';
import { SessionGuard } from './guards/session/session.guard';
import { WriteOriginGuard } from './guards/write-origin.guard';

@Module({
  imports: [DbModule],
  providers: [AuthService, SessionGuard, WriteOriginGuard],
  exports: [AuthService, SessionGuard, WriteOriginGuard],
})
export class AuthModule {}
