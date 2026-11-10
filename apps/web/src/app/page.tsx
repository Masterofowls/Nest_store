import Banner from "@/components/Banner";
import Dashboard from "@/components/Dashboard";
import PublicBanners from "@/features/management/ui/PublicBanners";

export default function Home() {
    return (
        <main>
            <PublicBanners />
            <Dashboard />
            <Banner
                title="Filter by category"
                description="The catalog lets you narrow products by category and search by name or ID."
                href="/catalog"
                actionLabel="Open the catalog"
            />
        </main>
    );
}
