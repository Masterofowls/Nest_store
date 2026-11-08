import {
  decimalAmount,
  discountedCents,
  priceInCents,
  MAX_AMOUNT_CENTS,
} from './order-money';

describe('Order money', () => {
  it.each([
    ['0', 0n],
    ['0.01', 1n],
    ['1.2', 120n],
    ['99999999.99', 9999999999n],
  ])('parses %s without floats', (input, expected) => {
    expect(priceInCents(input)).toBe(expected);
    expect(priceInCents(decimalAmount(expected))).toBe(expected);
  });

  it.each(['-1.00', '1.001', 'NaN', '1e2', ''])(
    'rejects invalid price %s',
    (input) => {
      expect(() => priceInCents(input)).toThrow();
    },
  );

  it.each([
    ['0.01', 50, 1n],
    ['0.05', 10, 5n],
    ['19.99', 15, 1699n],
    ['29.99', 0, 2999n],
    ['29.99', 100, 0n],
  ])('discounts %s by %s percent to %s cents', (price, discount, cents) => {
    expect(discountedCents(price, discount)).toBe(cents);
  });

  it.each([-1, 101, 1.5])('rejects invalid discount %s', (discount) => {
    expect(() => discountedCents('1.00', discount)).toThrow();
  });

  it('rejects overflowing or negative totals', () => {
    expect(() => decimalAmount(MAX_AMOUNT_CENTS + 1n)).toThrow(
      'Order amount exceeds',
    );
    expect(() => decimalAmount(-1n)).toThrow('Order amount exceeds');
  });
});
