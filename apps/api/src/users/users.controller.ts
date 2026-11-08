import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session/session.guard';
import type { SessionRequest } from '../auth/session-request';
import { WriteOriginGuard } from '../auth/guards/write-origin.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';
import { deleteUserSchema, updateUserSchema } from './user.schema';
import type { UpdateUserInput } from './user.schema';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

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

  @Patch('me')
  @UseGuards(SessionGuard, WriteOriginGuard)
  updateMe(
    @Req() request: SessionRequest,
    @Body(new ZodValidationPipe(updateUserSchema)) input: UpdateUserInput,
  ) {
    if (!request.authSession) {
      throw new UnauthorizedException();
    }
    return this.users.updateMe(request.authSession.user.id, input);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, WriteOriginGuard)
  deleteMe(
    @Req() request: SessionRequest,
    @Body(new ZodValidationPipe(deleteUserSchema)) _body: unknown,
  ) {
    void _body;
    if (!request.authSession) {
      throw new UnauthorizedException();
    }
    return this.users.deleteMe(request.authSession.user.id);
  }
}
