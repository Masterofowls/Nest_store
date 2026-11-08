import { UnauthorizedException } from '@nestjs/common';
import type { SessionRequest } from './session-request';

export function sessionUserId(request: SessionRequest): string {
  if (!request.authSession) {
    throw new UnauthorizedException();
  }
  return request.authSession.user.id;
}
