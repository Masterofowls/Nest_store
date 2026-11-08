import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session/session.guard';
import type { SessionRequest } from '../auth/session-request';

@Controller('users')
export class UsersController {
  @Get('me')
  @UseGuards(SessionGuard)
  getMe(@Req() request: SessionRequest) {
    if (!request.authSession) {
      throw new UnauthorizedException();
    }
    const user = request.authSession.user;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
    };
  }
}
