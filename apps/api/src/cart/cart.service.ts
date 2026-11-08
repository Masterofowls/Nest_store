import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../db/database/database.service';
import { cartItems, carts, products } from '../db/schema';
import { lockUserCart } from './cart-lock';
import type { StoreTransaction } from './cart-lock';
import { MAX_CART_QUANTITY, quantitySchema } from './cart.schema';
import type {
  AddCartItemInput,
  CartQuery,
  UpdateCartItemInput,
} from './cart.schema';
import { ZodValidationPipe } from '../common/pipes/zod-validation/zod-validation.pipe';

@Injectable()
export class CartService {
  constructor(private readonly database: DatabaseService) {}

  async find(userId: string, query: CartQuery) {
    const [cart] = await this.database.db
      .select()
      .from(carts)
      .where(eq(carts.userId, userId));
    if (!cart) return { id: null, items: [] };
    const items = await this.database.db
      .select({
        id: cartItems.id,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        product: products,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, cart.id))
      .orderBy(asc(cartItems.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
    return { id: cart.id, items };
  }

  add(userId: string, input: AddCartItemInput) {
    const quantity = this.validateQuantity(input.quantity);
    return this.database.db.transaction(async (tx) => {
      const cart = await lockUserCart(tx, userId);
      const product = await this.lockProduct(tx, input.productId);
      const [existing] = await tx
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.cartId, cart.id),
            eq(cartItems.productId, product.id),
          ),
        );
      const nextQuantity = (existing?.quantity ?? 0) + quantity;
      this.checkStock(nextQuantity, product.stockQuantity);
      const [item] = existing
        ? await tx
            .update(cartItems)
            .set({ quantity: nextQuantity, updatedAt: new Date() })
            .where(
              and(eq(cartItems.id, existing.id), eq(cartItems.cartId, cart.id)),
            )
            .returning()
        : await tx
            .insert(cartItems)
            .values({
              cartId: cart.id,
              productId: product.id,
              quantity: nextQuantity,
            })
            .returning();
      if (!item) throw new Error('Cart write did not return an item');
      await this.touchCart(tx, cart.id);
      return item;
    });
  }

  update(userId: string, itemId: string, input: UpdateCartItemInput) {
    const quantity = this.validateQuantity(input.quantity);
    return this.database.db.transaction(async (tx) => {
      const cart = await lockUserCart(tx, userId);
      const [existing] = await tx
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
      if (!existing) throw new NotFoundException('Cart item not found');
      const product = await this.lockProduct(tx, existing.productId);
      this.checkStock(quantity, product.stockQuantity);
      const [item] = await tx
        .update(cartItems)
        .set({ quantity, updatedAt: new Date() })
        .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
        .returning();
      if (!item) throw new NotFoundException('Cart item not found');
      await this.touchCart(tx, cart.id);
      return item;
    });
  }

  delete(userId: string, itemId: string): Promise<void> {
    return this.database.db.transaction(async (tx) => {
      const cart = await lockUserCart(tx, userId);
      const deleted = await tx
        .delete(cartItems)
        .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
        .returning({ id: cartItems.id });
      if (!deleted.length) throw new NotFoundException('Cart item not found');
      await this.touchCart(tx, cart.id);
    });
  }

  private validateQuantity(quantity: number): number {
    return new ZodValidationPipe(quantitySchema).transform(quantity);
  }

  private checkStock(quantity: number, stock: number): void {
    if (quantity > MAX_CART_QUANTITY) {
      throw new ConflictException('Cart quantity exceeds the limit');
    }
    if (quantity > stock) {
      throw new ConflictException('Insufficient product stock');
    }
  }

  private async lockProduct(tx: StoreTransaction, productId: string) {
    const [product] = await tx
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .for('update');
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async touchCart(tx: StoreTransaction, cartId: string) {
    await tx
      .update(carts)
      .set({ updatedAt: new Date() })
      .where(eq(carts.id, cartId));
  }
}
