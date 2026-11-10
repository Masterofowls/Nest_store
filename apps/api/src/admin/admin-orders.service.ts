import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../db/database/database.service';
import { orderItems, orders, user } from '../db/schema';
import { OrdersService } from '../orders/orders.service';
import type { AdminOrderQuery } from './admin.schema';

const orderColumns = {
  id: orders.id,
  userId: orders.userId,
  status: orders.status,
  totalAmount: orders.totalAmount,
  createdAt: orders.createdAt,
  updatedAt: orders.updatedAt,
  customerEmail: user.email,
  customerName: user.name,
};

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly orders: OrdersService,
  ) {}

  findAll(query: AdminOrderQuery) {
    return this.database.db
      .select(orderColumns)
      .from(orders)
      .leftJoin(user, eq(orders.userId, user.id))
      .where(
        and(
          query.status ? eq(orders.status, query.status) : undefined,
          query.userId ? eq(orders.userId, query.userId) : undefined,
        ),
      )
      .orderBy(desc(orders.createdAt), asc(orders.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
  }

  async findOne(id: string) {
    const [order] = await this.database.db
      .select(orderColumns)
      .from(orders)
      .leftJoin(user, eq(orders.userId, user.id))
      .where(eq(orders.id, id));
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const items = await this.database.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id))
      .orderBy(asc(orderItems.id));
    return { ...order, items };
  }

  async cancel(id: string, status: 'cancelled' = 'cancelled') {
    const [order] = await this.database.db
      .select({ userId: orders.userId })
      .from(orders)
      .where(eq(orders.id, id));
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (!order.userId) {
      throw new ConflictException(
        'Orders of deleted accounts cannot be cancelled',
      );
    }
    await this.orders.cancel(order.userId, id, status);
    return this.findOne(id);
  }
}
