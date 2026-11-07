import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  account,
  cartItems,
  carts,
  favourites,
  orderItems,
  orders,
  products,
  productViews,
  ratings,
  sellerProfiles,
  session,
  user,
} from './schema';

describe('Database deletion policies', () => {
  it.each([
    [session, session.userId, user, 'cascade'],
    [account, account.userId, user, 'cascade'],
    [carts, carts.userId, user, 'cascade'],
    [sellerProfiles, sellerProfiles.userId, user, 'cascade'],
    [products, products.sellerId, sellerProfiles, 'cascade'],
    [favourites, favourites.userId, user, 'cascade'],
    [ratings, ratings.userId, user, 'cascade'],
    [productViews, productViews.userId, user, 'cascade'],
    [productViews, productViews.productId, products, 'cascade'],
    [cartItems, cartItems.productId, products, 'cascade'],
    [cartItems, cartItems.cartId, carts, 'cascade'],
    [orders, orders.userId, user, 'set null'],
    [orderItems, orderItems.productId, products, 'set null'],
    [favourites, favourites.productId, products, 'set null'],
    [ratings, ratings.productId, products, 'set null'],
  ] as const)(
    'declares the intended foreign-key deletion policy %#',
    (table, column, parent, action) => {
      const foreignKey = getTableConfig(table).foreignKeys.find((key) =>
        key.reference().columns.some((candidate) => candidate === column),
      );

      expect(foreignKey).toBeDefined();
      expect(foreignKey?.reference().foreignTable).toBe(parent);
      expect(foreignKey?.onDelete).toBe(action);
      if (action === 'set null') {
        expect(column.notNull).toBe(false);
      }
    },
  );

  it('requires history snapshots independently of nullable product references', () => {
    expect(orderItems.productName.notNull).toBe(true);
    expect(orderItems.unitPrice.notNull).toBe(true);
    expect(favourites.productName.notNull).toBe(true);
    expect(ratings.productName.notNull).toBe(true);
  });

  it.each([favourites, ratings])(
    'allows only one entry per user and live product %#',
    (table) => {
      const indexes = getTableConfig(table).indexes;
      expect(
        indexes.some(
          ({ config }) =>
            config.unique &&
            config.columns.length === 2 &&
            config.columns.every(
              (column, index) =>
                'name' in column &&
                column.name ===
                  [table.userId.name, table.productId.name][index],
            ),
        ),
      ).toBe(true);
    },
  );

  it('allows anonymous and repeated product views', () => {
    expect(productViews.userId.notNull).toBe(false);
    expect(productViews.productId.notNull).toBe(true);
    expect(
      getTableConfig(productViews).indexes.some(({ config }) => config.unique),
    ).toBe(false);
  });

  it('declares a rating score constraint', () => {
    expect(getTableConfig(ratings).checks.map(({ name }) => name)).toContain(
      'ratings_score_range',
    );
  });
});
