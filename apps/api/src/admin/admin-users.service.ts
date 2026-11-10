import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ne, or, sql } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../db/database/database.service';
import { orders, sellerProfiles, session, user } from '../db/schema';
import type {
  AdminUserQuery,
  CreateAdminUserInput,
  UpdateAdminUserInput,
} from './admin.schema';

export const adminUserColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  isAdmin: user.isAdmin,
  image: user.image,
  createdAt: user.createdAt,
};

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authService: AuthService,
  ) {}

  findAll(query: AdminUserQuery) {
    const search = query.search?.toLowerCase();
    return this.database.db
      .select(adminUserColumns)
      .from(user)
      .where(
        and(
          search
            ? or(
                sql`strpos(lower(${user.name}), ${search}) > 0`,
                sql`strpos(lower(${user.email}), ${search}) > 0`,
              )
            : undefined,
          query.role ? eq(user.isAdmin, query.role === 'admin') : undefined,
        ),
      )
      .orderBy(desc(user.createdAt), asc(user.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
  }

  async findOne(id: string) {
    const [account] = await this.database.db
      .select(adminUserColumns)
      .from(user)
      .where(eq(user.id, id));
    if (!account) {
      throw new NotFoundException('User not found');
    }
    const [seller] = await this.database.db
      .select({ id: sellerProfiles.id, storeName: sellerProfiles.storeName })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, id));
    const [orderStats] = await this.database.db
      .select({
        orderCount: count(),
        totalSpent: sql<string>`coalesce(sum(${orders.totalAmount}) filter (where ${orders.status} <> 'cancelled'), 0)::text`,
      })
      .from(orders)
      .where(eq(orders.userId, id));
    const recentOrders = await this.database.db
      .select()
      .from(orders)
      .where(eq(orders.userId, id))
      .orderBy(desc(orders.createdAt), asc(orders.id))
      .limit(10);
    return {
      ...account,
      seller: seller ?? null,
      orderCount: orderStats?.orderCount ?? 0,
      totalSpent: orderStats?.totalSpent ?? '0',
      recentOrders,
    };
  }

  async create(input: CreateAdminUserInput) {
    const [existing] = await this.database.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, input.email));
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }
    try {
      await this.authService.auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
        },
      });
    } catch (error) {
      if (error instanceof APIError && error.statusCode === 422) {
        throw new ConflictException('A user with this email already exists');
      }
      if (error instanceof APIError && error.statusCode === 400) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    const [created] = await this.database.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, input.email));
    if (!created) {
      throw new Error('Created user could not be read back');
    }
    // Sign-up opens a session for the new user; an admin-created account should not have one.
    await this.database.db
      .delete(session)
      .where(eq(session.userId, created.id));
    if (input.isAdmin) {
      await this.database.db
        .update(user)
        .set({ isAdmin: true, updatedAt: new Date() })
        .where(eq(user.id, created.id));
    }
    return this.findOne(created.id);
  }

  async update(actorId: string, id: string, input: UpdateAdminUserInput) {
    if (actorId === id && input.isAdmin === false) {
      throw new BadRequestException('You cannot remove your own admin access');
    }
    const [updated] = await this.database.db
      .update(user)
      .set({
        name: input.name,
        isAdmin: input.isAdmin,
        emailVerified: input.emailVerified,
        updatedAt: new Date(),
      })
      .where(eq(user.id, id))
      .returning(adminUserColumns);
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return updated;
  }

  async delete(actorId: string, id: string): Promise<void> {
    if (actorId === id) {
      throw new BadRequestException('You cannot delete your own account here');
    }
    const deleted = await this.database.db
      .delete(user)
      .where(and(eq(user.id, id), ne(user.id, actorId)))
      .returning({ id: user.id });
    if (deleted.length === 0) {
      throw new NotFoundException('User not found');
    }
  }
}
