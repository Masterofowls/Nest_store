import { getJson, parseId, parseResponse } from "../../../shared/api/response";
import {
    productImageListSchema,
    productImageSchema,
} from "../model/product-image.schema";

export function parseProductImage(value: unknown) {
    return parseResponse(productImageSchema, value, "product image");
}

export function parseProductImageList(value: unknown) {
    return parseResponse(productImageListSchema, value, "product image list");
}

export async function getProductImages(api: string, productId: string) {
    return parseProductImageList(
        await getJson(
            api,
            `products/${parseId(productId)}/images`,
            "Product images",
        ),
    );
}
