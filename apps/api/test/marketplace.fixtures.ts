import type { AuthSession } from '../src/auth/session-request';
import type { Product, SellerProfile } from '../src/db/schema';

const date = new Date('2026-01-01T00:00:00Z');

export const sellerFixture: SellerProfile = {
  id: '00000000-0000-4000-8000-000000000002',
  userId: 'test-user',
  storeName: 'Test electronics',
  description: null,
  createdAt: date,
  updatedAt: date,
};

export const productFixture: Product = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Mechanical Keyboard',
  sellerId: sellerFixture.id,
  categoryId: '00000000-0000-4000-8000-000000000003',
  stockQuantity: 5,
  price: '29.99',
  discountPercent: 0,
  description: null,
};

export const sessionFixture: AuthSession = {
  user: {
    id: sellerFixture.userId,
    name: 'Test buyer',
    email: 'buyer@example.test',
    emailVerified: false,
    isAdmin: false,
    image: null,
    createdAt: date,
    updatedAt: date,
  },
  session: {
    id: 'test-session',
    userId: sellerFixture.userId,
    token: 'fake-session-token',
    expiresAt: new Date('2026-01-02T00:00:00Z'),
    createdAt: date,
    updatedAt: date,
    ipAddress: null,
    userAgent: null,
  },
};
