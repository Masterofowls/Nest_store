import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  desc,
  eq,
  exists,
  getTableColumns,
  gt,
  gte,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { DatabaseService } from '../db/database/database.service';
import {
  attributes,
  brands,
  categories,
  orderItems,
  productAttributeValues,
  products,
  ratings,
} from '../db/schema';
import type { StoreTransaction } from '../cart/cart-lock';
import { isPostgresConstraint } from '../common/postgres-constraint';
import { isProductId } from './product.schema';
import type {
  AttributeValueInput,
  CreateProductInput,
  ProductQuery,
  ProductSort,
  UpdateProductInput,
} from './product.schema';

export const MAX_FACET_OPTIONS = 500;
export const MAX_LISTED_VARIANTS = 20;

// Matches the cart's rounding of discounted unit prices.
const effectivePrice = sql`round(${products.price} * (100 - ${products.discountPercent}) / 100.0, 2)`;

// One comparable text form for every value type; numbers lose trailing zeros.
const attributeValueText = sql<string>`coalesce(${productAttributeValues.valueText}, trim_scale(${productAttributeValues.valueNumber})::text, ${productAttributeValues.valueBoolean}::text)`;

// Correlated subqueries are written with full table names: Drizzle drops the
// table prefix from interpolated columns in single-table selects, which would
// make "id" resolve to the inner table.
const firstImageUrl = sql.raw(
  `(select "product_images"."url" from "product_images" where "product_images"."product_id" = "products"."id" and "product_images"."status" = 'ready' order by "product_images"."created_at", "product_images"."id" limit 1)`,
) as SQL<string | null>;

const colorValue = sql.raw(
  `(select "product_attribute_values"."value_text" from "product_attribute_values" inner join "attributes" on "attributes"."id" = "product_attribute_values"."attribute_id" where "product_attribute_values"."product_id" = "products"."id" and "attributes"."slug" = 'color')`,
) as SQL<string | null>;

type ProductRow = typeof products.$inferSelect & {
  averageRating: string | null;
  ratingCount: number;
  brandName: string | null;
  imageUrl: string | null;
};

function toListedProduct({ averageRating, brandName, ...product }: ProductRow) {
  return {
    ...product,
    brand:
      product.brandId !== null && brandName !== null
        ? { id: product.brandId, name: brandName }
        : null,
    averageRating: averageRating === null ? null : Number(averageRating),
  };
}

type FacetRow = {
  slug: string;
  name: string;
  type: 'text' | 'number' | 'boolean';
  unit: string | null;
  value: string;
  count: number;
};

function groupAttributeFacets(rows: FacetRow[]) {
  const facets = new Map<
    string,
    Omit<FacetRow, 'value' | 'count'> & {
      options: { value: string; count: number }[];
    }
  >();
  for (const { value, count, ...attribute } of rows) {
    const facet = facets.get(attribute.slug) ?? { ...attribute, options: [] };
    facet.options.push({ value, count });
    facets.set(attribute.slug, facet);
  }
  return [...facets.values()];
}

@Injectable()
export class ProductsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(query: ProductQuery) {
    const { ratingStats, orderStats } = this.statsSubqueries();
    const rows = await this.database.db
      .select(this.productColumns(ratingStats))
      .from(products)
      .leftJoin(ratingStats, eq(ratingStats.productId, products.id))
      .leftJoin(orderStats, eq(orderStats.productId, products.id))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .where(and(...this.baseFilters(query), ...this.facetFilters(query)))
      .orderBy(
        ...this.sortOrder(query.sort, {
          averageRating: ratingStats.averageRating,
          ratingCount: ratingStats.ratingCount,
          orderedQuantity: orderStats.orderedQuantity,
        }),
      )
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
    return rows.map(toListedProduct);
  }

  // Options and counts ignore the brand and attribute selections, so choosing
  // one option does not make its alternatives disappear.
  async findFacets(query: ProductQuery) {
    const where = and(...this.baseFilters(query));
    const count = sql<number>`count(*)::int`;
    const [brandRows, attributeRows, [price]] = await Promise.all([
      this.database.db
        .select({ id: brands.id, name: brands.name, count })
        .from(products)
        .innerJoin(brands, eq(brands.id, products.brandId))
        .where(where)
        .groupBy(brands.id)
        .orderBy(asc(brands.name), asc(brands.id))
        .limit(MAX_FACET_OPTIONS),
      this.database.db
        .select({
          slug: attributes.slug,
          name: attributes.name,
          type: attributes.type,
          unit: attributes.unit,
          value: attributeValueText,
          count,
        })
        .from(productAttributeValues)
        .innerJoin(
          attributes,
          eq(attributes.id, productAttributeValues.attributeId),
        )
        .innerJoin(products, eq(products.id, productAttributeValues.productId))
        .where(where)
        .groupBy(attributes.id, attributeValueText)
        .orderBy(
          asc(attributes.sortOrder),
          asc(attributes.name),
          asc(attributeValueText),
        )
        .limit(MAX_FACET_OPTIONS),
      this.database.db
        .select({
          min: sql<string | null>`min(${effectivePrice})`,
          max: sql<string | null>`max(${effectivePrice})`,
        })
        .from(products)
        .where(where),
    ]);
    return {
      brands: brandRows,
      attributes: groupAttributeFacets(attributeRows),
      price: { min: price?.min ?? null, max: price?.max ?? null },
    };
  }

  findOne(id: string) {
    return this.findOneWhere(eq(products.id, id));
  }

  async findDetail(reference: string) {
    const product = await this.findByReference(reference);
    if (product === undefined) {
      throw new NotFoundException('Product not found');
    }
    return this.withDetails(product);
  }

  async findCompared(ids: string[]) {
    const found = await Promise.all(ids.map((id) => this.findOne(id)));
    return Promise.all(
      found
        .filter((product) => product !== undefined)
        .map((product) => this.withDetails(product)),
    );
  }

  private async findByReference(reference: string) {
    if (isProductId(reference)) {
      return this.findOne(reference);
    }
    const bySlug = await this.findOneWhere(eq(products.slug, reference));
    if (bySlug !== undefined) {
      return bySlug;
    }
    // The slug changes when a product is renamed, but its id suffix does not,
    // so links made before the rename still resolve.
    const suffix = /-([0-9a-f]{8})$/.exec(reference)?.[1];
    return suffix === undefined
      ? undefined
      : this.findOneWhere(sql`right(${products.id}::text, 8) = ${suffix}`);
  }

  private async findOneWhere(condition: SQL) {
    const { ratingStats } = this.statsSubqueries();
    const rows = await this.database.db
      .select(this.productColumns(ratingStats))
      .from(products)
      .leftJoin(ratingStats, eq(ratingStats.productId, products.id))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .where(condition);
    // Two matches can only come from the id-suffix lookup; guessing between
    // them would show the wrong product.
    return rows.length === 1 ? toListedProduct(rows[0]) : undefined;
  }

  private async withDetails(product: ReturnType<typeof toListedProduct>) {
    const [attributeRows, variants] = await Promise.all([
      this.database.db
        .select({
          slug: attributes.slug,
          name: attributes.name,
          type: attributes.type,
          unit: attributes.unit,
          value: attributeValueText,
        })
        .from(productAttributeValues)
        .innerJoin(
          attributes,
          eq(attributes.id, productAttributeValues.attributeId),
        )
        .where(eq(productAttributeValues.productId, product.id))
        .orderBy(asc(attributes.sortOrder), asc(attributes.name)),
      product.variantGroupId === null
        ? []
        : this.database.db
            .select({
              id: products.id,
              slug: products.slug,
              name: products.name,
              stockQuantity: products.stockQuantity,
              imageUrl: firstImageUrl,
              color: colorValue,
            })
            .from(products)
            .where(eq(products.variantGroupId, product.variantGroupId))
            .orderBy(asc(products.name), asc(products.id))
            .limit(MAX_LISTED_VARIANTS),
    ]);
    return { ...product, attributes: attributeRows, variants };
  }

  private baseFilters(query: ProductQuery): (SQL | undefined)[] {
    const search = query.search?.toLowerCase();
    return [
      search
        ? or(
            sql`strpos(lower(${products.name}), ${search}) > 0`,
            sql`cast(${products.id} as text) = ${search}`,
          )
        : undefined,
      query.categoryId
        ? or(
            eq(products.categoryId, query.categoryId),
            sql`${products.categoryId} in (select ${categories.id} from ${categories} where ${categories.parentId} = ${query.categoryId})`,
          )
        : undefined,
      query.sellerId ? eq(products.sellerId, query.sellerId) : undefined,
      query.minPrice !== undefined
        ? gte(effectivePrice, query.minPrice)
        : undefined,
      query.maxPrice !== undefined
        ? lte(effectivePrice, query.maxPrice)
        : undefined,
      query.discounted ? gt(products.discountPercent, 0) : undefined,
      query.inStock ? gt(products.stockQuantity, 0) : undefined,
    ];
  }

  private facetFilters(query: ProductQuery): (SQL | undefined)[] {
    return [
      query.brandIds ? inArray(products.brandId, query.brandIds) : undefined,
      ...(query.attrs ?? []).map((filter) =>
        exists(
          this.database.db
            .select({ one: sql`1` })
            .from(productAttributeValues)
            .innerJoin(
              attributes,
              eq(attributes.id, productAttributeValues.attributeId),
            )
            .where(
              and(
                eq(productAttributeValues.productId, products.id),
                eq(attributes.slug, filter.slug),
                inArray(attributeValueText, filter.values),
              ),
            ),
        ),
      ),
    ];
  }

  private statsSubqueries() {
    const ratingStats = this.database.db
      .select({
        productId: ratings.productId,
        averageRating: sql<string | null>`round(avg(${ratings.score}), 1)`.as(
          'average_rating',
        ),
        ratingCount: sql<number>`count(*)::int`.as('rating_count'),
      })
      .from(ratings)
      .groupBy(ratings.productId)
      .as('rating_stats');
    const orderStats = this.database.db
      .select({
        productId: orderItems.productId,
        orderedQuantity: sql<number>`sum(${orderItems.quantity})::int`.as(
          'ordered_quantity',
        ),
      })
      .from(orderItems)
      .groupBy(orderItems.productId)
      .as('order_stats');
    return { ratingStats, orderStats };
  }

  private productColumns(ratingStats: {
    averageRating: SQL.Aliased<string | null>;
    ratingCount: SQL.Aliased<number>;
  }) {
    return {
      ...getTableColumns(products),
      averageRating: sql<string | null>`${ratingStats.averageRating}`,
      ratingCount: sql<number>`coalesce(${ratingStats.ratingCount}, 0)`,
      brandName: brands.name,
      imageUrl: firstImageUrl,
    };
  }

  private sortOrder(
    sort: ProductSort | undefined,
    stats: {
      averageRating: SQL.Aliased<string | null>;
      ratingCount: SQL.Aliased<number>;
      orderedQuantity: SQL.Aliased<number>;
    },
  ): SQL[] {
    const byId = asc(products.id);
    switch (sort) {
      case 'popular':
        return [
          sql`coalesce(${stats.orderedQuantity}, 0) desc`,
          sql`coalesce(${stats.ratingCount}, 0) desc`,
          byId,
        ];
      case 'price_asc':
        return [asc(effectivePrice), byId];
      case 'price_desc':
        return [desc(effectivePrice), byId];
      case 'rating':
        return [
          sql`${stats.averageRating} desc nulls last`,
          sql`coalesce(${stats.ratingCount}, 0) desc`,
          byId,
        ];
      case 'newest':
        return [desc(products.createdAt), byId];
      default:
        return [byId];
    }
  }

  async postProduct(input: CreateProductInput, sellerId: string) {
    try {
      return await this.database.db.transaction(async (tx) => {
        const variantGroupId = await this.resolveVariantGroup(
          tx,
          input.variantOfProductId,
          sellerId,
        );
        const [product] = await tx
          .insert(products)
          .values({
            sellerId,
            name: input.name,
            categoryId: input.categoryId,
            stockQuantity: input.stockQuantity,
            price: input.price,
            description: input.description,
            discountPercent: input.discountPercent,
            deliveryDays: input.deliveryDays,
            badge: input.badge,
            brandId: input.brandId,
            variantGroupId,
          })
          .returning();
        if (!product) {
          throw new Error('Product insert did not return a product');
        }
        if (input.attributes) {
          await this.replaceAttributes(tx, product.id, input.attributes);
        }
        return product;
      });
    } catch (error) {
      this.rethrowReferenceError(error);
    }
  }

  async patchProduct(input: UpdateProductInput, id: string, sellerId: string) {
    if (input.variantOfProductId === id) {
      throw new BadRequestException('A product cannot be its own variant');
    }
    try {
      return await this.database.db.transaction(async (tx) => {
        const variantGroupId = await this.resolveVariantGroup(
          tx,
          input.variantOfProductId,
          sellerId,
        );
        const [product] = await tx
          .update(products)
          .set({
            // Keeps the statement valid when only attributes are sent.
            id,
            name: input.name,
            categoryId: input.categoryId,
            stockQuantity: input.stockQuantity,
            price: input.price,
            description: input.description,
            discountPercent: input.discountPercent,
            deliveryDays: input.deliveryDays,
            badge: input.badge,
            brandId: input.brandId,
            variantGroupId,
          })
          .where(and(eq(products.id, id), eq(products.sellerId, sellerId)))
          .returning();
        if (!product) {
          await this.getOrThrow(id);
          throw new ForbiddenException('Product belongs to another seller');
        }
        if (input.attributes) {
          await this.replaceAttributes(tx, id, input.attributes);
        }
        return product;
      });
    } catch (error) {
      this.rethrowReferenceError(error);
    }
  }

  async deleteProduct(id: string, sellerId: string): Promise<void> {
    const deleted = await this.database.db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.sellerId, sellerId)))
      .returning({ id: products.id });
    if (deleted.length === 0) {
      await this.getOrThrow(id);
      throw new ForbiddenException('Product belongs to another seller');
    }
  }

  async getOrThrow(id: string) {
    const result = await this.findOne(id);
    if (result === undefined) {
      throw new NotFoundException('Product not found');
    }
    return result;
  }

  // undefined leaves the group as it is, null clears it.
  private async resolveVariantGroup(
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

  private async replaceAttributes(
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
        throw new BadRequestException(
          `Attribute value must be a ${type === 'text' ? 'text' : type}`,
        );
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

  private rethrowReferenceError(error: unknown): never {
    if (
      isPostgresConstraint(error, '23503', 'products_brand_id_brands_id_fk')
    ) {
      throw new BadRequestException('Brand not found');
    }
    if (
      isPostgresConstraint(
        error,
        '23503',
        'products_category_id_categories_id_fk',
      )
    ) {
      throw new BadRequestException('Category not found');
    }
    if (
      isPostgresConstraint(
        error,
        '23503',
        'products_seller_id_seller_profiles_id_fk',
      )
    ) {
      throw new ForbiddenException('A seller profile is required');
    }
    throw error;
  }
}
