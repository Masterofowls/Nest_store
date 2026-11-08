import { eq } from 'drizzle-orm';
import type { DatabaseService } from '../db/database/database.service';
import { carts } from '../db/schema';

export type StoreTransaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];

export async function lockUserCart(tx: StoreTransaction, userId: string) {
  // The unique user key also serializes creation of the first cart.
  await tx.insert(carts).values({ userId }).onConflictDoNothing({
    target: carts.userId,
  });
  const [cart] = await tx
    .select()
    .from(carts)
    .where(eq(carts.userId, userId))
    .for('update');
  if (!cart) {
    throw new Error('Cart insert did not return a cart');
  }
  return cart;
}
