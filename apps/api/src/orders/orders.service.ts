import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/database/database.service';
import { cartItems, carts, orderItems, orders, products } from '../db/schema';
import { lockUserCart } from '../cart/cart-lock';
import type { StoreTransaction } from '../cart/cart-lock';
import { quantitySchema } from '../cart/cart.schema';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';
import { cancelOrderSchema, checkoutKeySchema } from './order.schema';
import type { OrderQuery } from './order.schema';
import { decimalAmount, discountedCents } from './order-money';

@Injectable()
export class OrdersService {
  constructor(private readonly database: DatabaseService) {}

  findAll(userId: string, query: OrderQuery) {
    return this.database.db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          query.status ? eq(orders.status, query.status) : undefined,
        ),
      )
      .orderBy(desc(orders.createdAt), asc(orders.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
  }

  async findOne(userId: string, orderId: string) {
    const [order] = await this.database.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)));
    if (!order) throw new NotFoundException('Order not found');
    return {
      ...order,
      items: await this.database.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(asc(orderItems.id)),
    };
  }

  checkout(userId: string, key: string) {
    const checkoutKey = new ZodValidationPipe(checkoutKeySchema).transform(key);
    return this.database.db.transaction(async (tx) => {
      const cart = await lockUserCart(tx, userId);
      const [previous] = await tx
        .select()
        .from(orders)
        .where(
          and(eq(orders.userId, userId), eq(orders.checkoutKey, checkoutKey)),
        );
      if (previous) return this.withItems(tx, previous);

      const items = await tx
        .select()
        .from(cartItems)
        .where(eq(cartItems.cartId, cart.id))
        .orderBy(asc(cartItems.productId));
      if (!items.length) throw new ConflictException('Cart is empty');

      // Every checkout and cancellation acquires product locks in the same order.
      const lockedProducts = await tx
        .select()
        .from(products)
        .where(
          inArray(
            products.id,
            items.map((item) => item.productId),
          ),
        )
        .orderBy(asc(products.id))
        .for('update');
      const productById = new Map(
        lockedProducts.map((product) => [product.id, product]),
      );
      let totalCents = 0n;
      const snapshots = items.map((item) => {
        const product = productById.get(item.productId);
        if (!product)
          throw new ConflictException('A cart product is no longer available');
        if (!quantitySchema.safeParse(item.quantity).success) {
          throw new ConflictException(
            'Cart quantity is outside the permitted range',
          );
        }
        if (product.stockQuantity < item.quantity) {
          throw new ConflictException('Insufficient product stock');
        }
        const unitCents = discountedCents(
          product.price,
          product.discountPercent,
        );
        totalCents += unitCents * BigInt(item.quantity);
        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: decimalAmount(unitCents),
        };
      });
      const totalAmount = decimalAmount(totalCents);
      const [order] = await tx
        .insert(orders)
        .values({
          userId,
          checkoutKey,
          status: 'pending',
          totalAmount,
        })
        .returning();
      if (!order) throw new Error('Order insert did not return an order');
      const savedItems = await tx
        .insert(orderItems)
        .values(snapshots.map((item) => ({ ...item, orderId: order.id })))
        .returning();
      for (const item of items) {
        await tx
          .update(products)
          .set({
            stockQuantity: sql`${products.stockQuantity} - ${item.quantity}`,
          })
          .where(eq(products.id, item.productId));
      }
      await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
      await tx
        .update(carts)
        .set({ updatedAt: new Date() })
        .where(eq(carts.id, cart.id));
      return {
        ...order,
        items: savedItems.sort((left, right) =>
          left.id.localeCompare(right.id),
        ),
      };
    });
  }

  cancel(userId: string, orderId: string, status: 'cancelled' = 'cancelled') {
    new ZodValidationPipe(cancelOrderSchema).transform({ status });
    return this.database.db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
        .for('update');
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === 'cancelled') return this.withItems(tx, order);
      if (order.status !== 'pending') {
        throw new ConflictException('Only pending orders can be cancelled');
      }
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(asc(orderItems.id));
      const quantities = new Map<string, number>();
      for (const item of items) {
        if (item.productId) {
          quantities.set(
            item.productId,
            (quantities.get(item.productId) ?? 0) + item.quantity,
          );
        }
      }
      if (quantities.size) {
        const existing = await tx
          .select()
          .from(products)
          .where(inArray(products.id, [...quantities.keys()]))
          .orderBy(asc(products.id))
          .for('update');
        for (const product of existing) {
          const quantity = quantities.get(product.id);
          if (quantity === undefined)
            throw new Error('Order product quantity is missing');
          if (product.stockQuantity + quantity > 2_147_483_647) {
            throw new ConflictException(
              'Restored stock exceeds the permitted range',
            );
          }
          await tx
            .update(products)
            .set({
              stockQuantity: sql`${products.stockQuantity} + ${quantity}`,
            })
            .where(eq(products.id, product.id));
        }
      }
      const [cancelled] = await tx
        .update(orders)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(
          and(
            eq(orders.id, order.id),
            eq(orders.userId, userId),
            eq(orders.status, 'pending'),
          ),
        )
        .returning();
      if (!cancelled) throw new ConflictException('Order status changed');
      return { ...cancelled, items };
    });
  }

  private async withItems(
    tx: StoreTransaction,
    order: typeof orders.$inferSelect,
  ) {
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.id));
    return { ...order, items };
  }
}
