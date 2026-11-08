import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import type { SessionRequest } from '../session-request';

@Injectable()
export class WriteOriginGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const baseURL = this.authService.auth.options.baseURL;
    if (!baseURL || request.headers.origin !== new URL(baseURL).origin) {
      throw new ForbiddenException('A trusted Origin header is required');
    }
    return true;
  }
}
