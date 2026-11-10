import { Suspense } from "react";
import ProductItem from "@/components/ProductItem";

export const instant = false;

async function ProductPageContent({
    params,
}: {
    params: Promise<{ productId: string }>;
}) {
    const { productId } = await params;

    return <ProductItem productId={productId} />;
}

export default function ProductPage({
    params,
}: {
    params: Promise<{ productId: string }>;
}) {
    return (
        <main>
            <Suspense fallback={<output>Loading product…</output>}>
                <ProductPageContent params={params} />
            </Suspense>
        </main>
    );
}
