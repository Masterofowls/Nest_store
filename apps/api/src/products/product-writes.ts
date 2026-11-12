import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { StoreTransaction } from '../cart/cart-lock';
import { attributes, productAttributeValues, products } from '../db/schema';
import type { AttributeValueInput } from './product.schema';

// Returns the group to store: undefined leaves it as it is, null clears it.
// The sibling must belong to the same seller as the product being saved.
export async function resolveVariantGroup(
  tx: StoreTransaction,
  variantOfProductId: string | null | undefined,
  sellerId: string,
): Promise<string | null | undefined> {
  if (variantOfProductId === undefined || variantOfProductId === null) {
    return variantOfProductId;
  }
  const [sibling] = await tx
    .select({
      sellerId: products.sellerId,
      variantGroupId: products.variantGroupId,
    })
    .from(products)
    .where(eq(products.id, variantOfProductId))
    .for('update');
  if (!sibling) {
    throw new BadRequestException('Variant product not found');
  }
  if (sibling.sellerId !== sellerId) {
    throw new ForbiddenException('Variant product belongs to another seller');
  }
  if (sibling.variantGroupId !== null) {
    return sibling.variantGroupId;
  }
  const variantGroupId = randomUUID();
  await tx
    .update(products)
    .set({ variantGroupId })
    .where(eq(products.id, variantOfProductId));
  return variantGroupId;
}

// Replaces all attribute values of a product; each value must match its
// attribute's type.
export async function replaceAttributes(
  tx: StoreTransaction,
  productId: string,
  values: AttributeValueInput[],
): Promise<void> {
  const definitions =
    values.length === 0
      ? []
      : await tx
          .select({ id: attributes.id, type: attributes.type })
          .from(attributes)
          .where(
            inArray(
              attributes.id,
              values.map((value) => value.attributeId),
            ),
          );
  const types = new Map(definitions.map(({ id, type }) => [id, type]));
  const rows = values.map(({ attributeId, value }) => {
    const type = types.get(attributeId);
    if (type === undefined) {
      throw new BadRequestException('Attribute not found');
    }
    const expected = type === 'text' ? 'string' : type;
    if (typeof value !== expected) {
      throw new BadRequestException(`Attribute value must be a ${type}`);
    }
    return {
      productId,
      attributeId,
      valueText: typeof value === 'string' ? value : null,
      valueNumber: typeof value === 'number' ? String(value) : null,
      valueBoolean: typeof value === 'boolean' ? value : null,
    };
  });
  await tx
    .delete(productAttributeValues)
    .where(eq(productAttributeValues.productId, productId));
  if (rows.length > 0) {
    await tx.insert(productAttributeValues).values(rows);
  }
}
