import type { Cart, CartItem, StoreOrder, StoreOrderItem } from '../db/schema';
import { productFixture } from '../../test/marketplace.fixtures';

export const cartFixture: Cart = {
  id: '00000000-0000-4000-8000-000000000011',
  userId: 'test-buyer',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};
export const cartItemFixture: CartItem = {
  id: '00000000-0000-4000-8000-000000000012',
  cartId: cartFixture.id,
  productId: productFixture.id,
  quantity: 2,
  createdAt: cartFixture.createdAt,
  updatedAt: cartFixture.updatedAt,
};
export const orderFixture: StoreOrder = {
  id: '00000000-0000-4000-8000-000000000013',
  userId: cartFixture.userId,
  checkoutKey: '00000000-0000-4000-8000-000000000014',
  status: 'pending',
  totalAmount: '59.98',
  createdAt: cartFixture.createdAt,
  updatedAt: cartFixture.updatedAt,
};
export const orderItemFixture: StoreOrderItem = {
  id: '00000000-0000-4000-8000-000000000015',
  orderId: orderFixture.id,
  productId: productFixture.id,
  productName: productFixture.name,
  quantity: 2,
  unitPrice: '29.99',
};
