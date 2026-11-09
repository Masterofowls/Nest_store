import type { ProductList } from "../model/product.schema";
import { parseProductList } from "./parse-product-list";

export async function getProducts(api: string): Promise<ProductList> {
    const url = new URL("products", api);
    const data = await fetch(url, { cache: "no-store" });

    if (!data.ok) {
        throw new Error(`Product request failed (HTTP ${data.status})`);
    }

    const result: unknown = await data.json();
    return parseProductList(result);
}
