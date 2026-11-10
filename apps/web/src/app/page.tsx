import QuantitySelector from "@/features/cart/ui/QuantitySelector";
import ProductList from "@/components/ProductList";

export default function Home() {
    return (
        <main>
            <div>Hello world!</div>
            <QuantitySelector unitPrice={12} />
            <ProductList />
        </main>
    );
}
