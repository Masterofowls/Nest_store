import type { Request } from 'express';
import type { AuthService } from './auth.service';

export type AuthSession = typeof AuthService.prototype.auth.$Infer.Session;

export interface SessionRequest extends Request {
  authSession?: AuthSession;
}
