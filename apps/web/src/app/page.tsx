import Dashboard from "@/components/Dashboard";
import PublicBanners from "@/features/management/ui/PublicBanners";

export default function Home() {
    return (
        <main>
            <PublicBanners />
            <Dashboard />
        </main>
    );
}
