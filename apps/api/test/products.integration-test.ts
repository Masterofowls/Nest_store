import 'dotenv/config';
import postgres from 'postgres';
import { testEnvSchema } from '../src/config/test-env.schema';
import { randomUUID } from 'node:crypto';

const result = testEnvSchema.safeParse(process.env);

if (!result.success) {
  throw new Error('Integration tests require a valid local TEST_DATABASE_URL');
}

const sql = postgres(result.data.TEST_DATABASE_URL, {
  ssl: false,
  connect_timeout: 10,
  max: 1,
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

it.each([
  ['negative stock', -1, '129.99', 0, 'products_stock_nonnegative'],
  ['negative price', 10, '-0.01', 0, 'products_price_nonnegative'],
  ['negative discount', 10, '129.99', -1, 'products_discount_percent_range'],
  ['discount above 100', 10, '129.99', 101, 'products_discount_percent_range'],
])('rejects %s', async (_name, stock, price, discount, constraint) => {
  const transaction = sql.begin(async (tx) => {
    const userId = randomUUID();

    await tx`
      INSERT INTO "user" (id, name, email)
      VALUES (${userId}, ${'Test seller'}, ${`${userId}@example.test`})
    `;

    const [category] = await tx<{ id: string }[]>`
      INSERT INTO categories (name)
      VALUES (${`Test category ${randomUUID()}`})
      RETURNING id
    `;

    const [seller] = await tx<{ id: string }[]>`
      INSERT INTO seller_profiles (user_id, store_name)
      VALUES (${userId}, ${`Test store ${randomUUID()}`})
      RETURNING id
    `;

    await tx`
      INSERT INTO products
        (name, seller_id, category_id, stock_quantity, price, discount_percent)
      VALUES
        (${'Test keyboard'}, ${seller.id}, ${category.id}, ${stock}, ${price}, ${discount})
    `;

    throw new Error('Invalid product values were unexpectedly accepted');
  });

  await expect(transaction).rejects.toMatchObject({
    code: '23514',
    constraint_name: constraint,
  });
});

it('preserves orders and other users when a buyer is deleted', async () => {
  const rollback = new Error('Rollback test fixtures');
  const sellerUserId = randomUUID();
  const buyerUserId = randomUUID();
  const otherBuyerId = randomUUID();
  const categoryId = randomUUID();
  const sellerId = randomUUID();
  const productId = randomUUID();
  const buyerCartId = randomUUID();
  const otherCartId = randomUUID();
  const buyerOrderId = randomUUID();
  const otherOrderId = randomUUID();

  await expect(
    sql.begin(async (tx) => {
      await tx`
        INSERT INTO "user" (id, name, email)
        VALUES
          (${sellerUserId}, ${'Test seller'}, ${`${sellerUserId}@example.test`}),
          (${buyerUserId}, ${'Test buyer'}, ${`${buyerUserId}@example.test`}),
          (${otherBuyerId}, ${'Other buyer'}, ${`${otherBuyerId}@example.test`})
      `;
      await tx`
        INSERT INTO categories (id, name)
        VALUES (${categoryId}, ${`Test category ${categoryId}`})
      `;
      await tx`
        INSERT INTO seller_profiles (id, user_id, store_name)
        VALUES (${sellerId}, ${sellerUserId}, ${`Test store ${sellerId}`})
      `;
      await tx`
        INSERT INTO products (id, name, seller_id, category_id, stock_quantity, price)
        VALUES (${productId}, ${'Test keyboard'}, ${sellerId}, ${categoryId}, ${10}, ${'129.99'})
      `;
      await tx`
        INSERT INTO carts (id, user_id)
        VALUES (${buyerCartId}, ${buyerUserId}), (${otherCartId}, ${otherBuyerId})
      `;
      await tx`
        INSERT INTO cart_items (cart_id, product_id, quantity)
        VALUES (${buyerCartId}, ${productId}, ${2}), (${otherCartId}, ${productId}, ${1})
      `;
      await tx`
        INSERT INTO orders (id, user_id, total_amount)
        VALUES (${buyerOrderId}, ${buyerUserId}, ${'259.98'}),
          (${otherOrderId}, ${otherBuyerId}, ${'129.99'})
      `;
      await tx`
        INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
        VALUES (${buyerOrderId}, ${productId}, ${'Test keyboard'}, ${2}, ${'129.99'}),
          (${otherOrderId}, ${productId}, ${'Test keyboard'}, ${1}, ${'129.99'})
      `;
      await tx`
        INSERT INTO favourites (user_id, product_id, product_name)
        VALUES (${buyerUserId}, ${productId}, ${'Test keyboard'}),
          (${otherBuyerId}, ${productId}, ${'Test keyboard'})
      `;
      await tx`
        INSERT INTO product_views (user_id, product_id)
        VALUES (${buyerUserId}, ${productId}), (${otherBuyerId}, ${productId})
      `;
      await tx`
        INSERT INTO ratings (user_id, product_id, product_name, score, comment)
        VALUES (${buyerUserId}, ${productId}, ${'Test keyboard'}, ${5}, ${'Useful keyboard'}),
          (${otherBuyerId}, ${productId}, ${'Test keyboard'}, ${4}, ${'Compact layout'})
      `;

      await tx`DELETE FROM "user" WHERE id = ${buyerUserId}`;

      expect(await tx`SELECT id FROM "user" WHERE id = ${buyerUserId}`).toEqual(
        [],
      );
      expect(await tx`SELECT id FROM carts WHERE id = ${buyerCartId}`).toEqual(
        [],
      );
      expect(
        await tx`SELECT id FROM cart_items WHERE cart_id = ${buyerCartId}`,
      ).toEqual([]);
      expect(
        await tx`SELECT id FROM favourites WHERE user_id = ${buyerUserId}`,
      ).toEqual([]);
      expect(
        await tx`SELECT id FROM product_views WHERE user_id = ${buyerUserId}`,
      ).toEqual([]);
      expect(
        await tx`SELECT id FROM ratings WHERE user_id = ${buyerUserId}`,
      ).toEqual([]);
      expect(
        await tx`SELECT user_id, total_amount FROM orders WHERE id = ${buyerOrderId}`,
      ).toEqual([{ user_id: null, total_amount: '259.98' }]);
      expect(
        await tx`
          SELECT product_id, product_name, quantity, unit_price
          FROM order_items WHERE order_id = ${buyerOrderId}
        `,
      ).toEqual([
        {
          product_id: productId,
          product_name: 'Test keyboard',
          quantity: 2,
          unit_price: '129.99',
        },
      ]);
      expect(
        await tx`SELECT id FROM "user" WHERE id = ${sellerUserId}`,
      ).toEqual([{ id: sellerUserId }]);
      expect(
        await tx`SELECT id FROM "user" WHERE id = ${otherBuyerId}`,
      ).toEqual([{ id: otherBuyerId }]);
      expect(
        await tx`SELECT user_id FROM seller_profiles WHERE id = ${sellerId}`,
      ).toEqual([{ user_id: sellerUserId }]);
      expect(
        await tx`SELECT seller_id, stock_quantity, price FROM products WHERE id = ${productId}`,
      ).toEqual([{ seller_id: sellerId, stock_quantity: 10, price: '129.99' }]);
      expect(
        await tx`SELECT user_id FROM carts WHERE id = ${otherCartId}`,
      ).toEqual([{ user_id: otherBuyerId }]);
      expect(
        await tx`SELECT product_id, quantity FROM cart_items WHERE cart_id = ${otherCartId}`,
      ).toEqual([{ product_id: productId, quantity: 1 }]);
      expect(
        await tx`SELECT user_id, total_amount FROM orders WHERE id = ${otherOrderId}`,
      ).toEqual([{ user_id: otherBuyerId, total_amount: '129.99' }]);
      expect(
        await tx`
          SELECT product_id, product_name, quantity, unit_price
          FROM order_items WHERE order_id = ${otherOrderId}
        `,
      ).toEqual([
        {
          product_id: productId,
          product_name: 'Test keyboard',
          quantity: 1,
          unit_price: '129.99',
        },
      ]);
      expect(
        await tx`SELECT product_id, product_name FROM favourites WHERE user_id = ${otherBuyerId}`,
      ).toEqual([{ product_id: productId, product_name: 'Test keyboard' }]);
      expect(
        await tx`SELECT product_id FROM product_views WHERE user_id = ${otherBuyerId}`,
      ).toEqual([{ product_id: productId }]);
      expect(
        await tx`
          SELECT product_id, product_name, score, comment
          FROM ratings WHERE user_id = ${otherBuyerId}
        `,
      ).toEqual([
        {
          product_id: productId,
          product_name: 'Test keyboard',
          score: 4,
          comment: 'Compact layout',
        },
      ]);

      throw rollback;
    }),
  ).rejects.toBe(rollback);

  expect(
    await sql`SELECT id FROM "user" WHERE id IN (${sellerUserId}, ${buyerUserId}, ${otherBuyerId})`,
  ).toEqual([]);
  expect(await sql`SELECT id FROM categories WHERE id = ${categoryId}`).toEqual(
    [],
  );
  expect(
    await sql`SELECT id FROM orders WHERE id IN (${buyerOrderId}, ${otherOrderId})`,
  ).toEqual([]);
});

it('preserves buyer history when the seller is deleted', async () => {
  const rollback = new Error('Rollback test fixtures');
  const sellerUserId = randomUUID();
  const buyerUserId = randomUUID();

  await expect(
    sql.begin(async (tx) => {
      await tx`
        INSERT INTO "user" (id, name, email)
        VALUES
          (${sellerUserId}, ${'Test seller'}, ${`${sellerUserId}@example.test`}),
          (${buyerUserId}, ${'Test buyer'}, ${`${buyerUserId}@example.test`})
      `;

      const [category] = await tx<{ id: string }[]>`
        INSERT INTO categories (name)
        VALUES (${`Test category ${randomUUID()}`})
        RETURNING id
      `;
      const [seller] = await tx<{ id: string }[]>`
        INSERT INTO seller_profiles (user_id, store_name)
        VALUES (${sellerUserId}, ${`Test store ${randomUUID()}`})
        RETURNING id
      `;
      const [product] = await tx<{ id: string }[]>`
        INSERT INTO products
          (name, seller_id, category_id, stock_quantity, price)
        VALUES
          (${'Test keyboard'}, ${seller.id}, ${category.id}, ${10}, ${'129.99'})
        RETURNING id
      `;
      const [order] = await tx<{ id: string }[]>`
        INSERT INTO orders (user_id, total_amount)
        VALUES (${buyerUserId}, ${'259.98'})
        RETURNING id
      `;
      const [orderItem] = await tx<{ id: string }[]>`
        INSERT INTO order_items
          (order_id, product_id, product_name, quantity, unit_price)
        VALUES
          (${order.id}, ${product.id}, ${'Test keyboard'}, ${2}, ${'129.99'})
        RETURNING id
      `;
      const [favourite] = await tx<{ id: string }[]>`
        INSERT INTO favourites (user_id, product_id, product_name)
        VALUES (${buyerUserId}, ${product.id}, ${'Test keyboard'})
        RETURNING id
      `;
      const [rating] = await tx<{ id: string }[]>`
        INSERT INTO ratings (user_id, product_id, product_name, score, comment)
        VALUES
          (${buyerUserId}, ${product.id}, ${'Test keyboard'}, ${5}, ${'Useful keyboard'})
        RETURNING id
      `;

      await tx`DELETE FROM "user" WHERE id = ${sellerUserId}`;

      expect(
        await tx`SELECT id FROM "user" WHERE id = ${sellerUserId}`,
      ).toEqual([]);
      expect(
        await tx`SELECT id FROM seller_profiles WHERE id = ${seller.id}`,
      ).toEqual([]);
      expect(
        await tx`SELECT id FROM products WHERE id = ${product.id}`,
      ).toEqual([]);
      expect(await tx`SELECT id FROM "user" WHERE id = ${buyerUserId}`).toEqual(
        [{ id: buyerUserId }],
      );
      expect(
        await tx`SELECT user_id, total_amount FROM orders WHERE id = ${order.id}`,
      ).toEqual([{ user_id: buyerUserId, total_amount: '259.98' }]);
      expect(
        await tx`
          SELECT order_id, product_id, product_name, quantity, unit_price
          FROM order_items WHERE id = ${orderItem.id}
        `,
      ).toEqual([
        {
          order_id: order.id,
          product_id: null,
          product_name: 'Test keyboard',
          quantity: 2,
          unit_price: '129.99',
        },
      ]);
      expect(
        await tx`
          SELECT user_id, product_id, product_name
          FROM favourites WHERE id = ${favourite.id}
        `,
      ).toEqual([
        {
          user_id: buyerUserId,
          product_id: null,
          product_name: 'Test keyboard',
        },
      ]);
      expect(
        await tx`
          SELECT user_id, product_id, product_name, score, comment
          FROM ratings WHERE id = ${rating.id}
        `,
      ).toEqual([
        {
          user_id: buyerUserId,
          product_id: null,
          product_name: 'Test keyboard',
          score: 5,
          comment: 'Useful keyboard',
        },
      ]);

      throw rollback;
    }),
  ).rejects.toBe(rollback);

  expect(
    await sql`
      SELECT id FROM "user" WHERE id IN (${sellerUserId}, ${buyerUserId})
    `,
  ).toEqual([]);
});
