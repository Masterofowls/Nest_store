import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../db/database/database.service';
import { user } from '../../db/schema';
import type { SessionRequest } from '../session-request';
import { sessionUserId } from '../session-user-id';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const userId = sessionUserId(request);
    const [account] = await this.database.db
      .select({ isAdmin: user.isAdmin })
      .from(user)
      .where(eq(user.id, userId));
    if (!account?.isAdmin) {
      throw new ForbiddenException('Admin access is required');
    }
    return true;
  }
}
