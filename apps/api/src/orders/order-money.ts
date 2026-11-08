import { ConflictException } from '@nestjs/common';

export const MAX_AMOUNT_CENTS = 9_999_999_999n;

export function priceInCents(price: string): bigint {
  if (!/^\d+(?:\.\d{1,2})?$/.test(price)) {
    throw new Error('Product price is not a decimal amount');
  }
  const [whole, fraction = ''] = price.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function discountedCents(
  price: string,
  discountPercent: number,
): bigint {
  if (
    !Number.isInteger(discountPercent) ||
    discountPercent < 0 ||
    discountPercent > 100
  ) {
    throw new Error('Product discount is outside the permitted range');
  }
  // Round the discounted unit price to the nearest cent, with half cents up.
  return (priceInCents(price) * BigInt(100 - discountPercent) + 50n) / 100n;
}

export function decimalAmount(cents: bigint): string {
  if (cents < 0n || cents > MAX_AMOUNT_CENTS) {
    throw new ConflictException('Order amount exceeds the permitted range');
  }
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}
