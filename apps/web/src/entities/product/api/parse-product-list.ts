import { productListSchema, type ProductList } from "../model/product.schema";

export function parseProductList(argument: unknown): ProductList {
    const result = productListSchema.safeParse(argument);

    if (!result.success) {
        throw new Error("Invalid product list response", {
            cause: result.error,
        });
    }

    return result.data;
}
