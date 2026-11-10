import { Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../db/database/database.service';
import { user } from '../db/schema';
import type { UpdateUserInput } from './user.schema';

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  async updateMe(userId: string, input: UpdateUserInput) {
    const [updated] = await this.database.db
      .update(user)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        isAdmin: user.isAdmin,
      });
    if (!updated) {
      throw new UnauthorizedException('User account no longer exists');
    }
    return updated;
  }

  async deleteMe(userId: string): Promise<void> {
    // Better Auth account deletion is disabled; database cascades revoke sessions.
    const [deleted] = await this.database.db
      .delete(user)
      .where(eq(user.id, userId))
      .returning({ id: user.id });
    if (!deleted) {
      throw new UnauthorizedException('User account no longer exists');
    }
  }
}
