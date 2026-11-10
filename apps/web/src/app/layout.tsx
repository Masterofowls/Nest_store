import { Suspense } from "react";
import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import StoreProvider from "./StoreProvider";

export const metadata: Metadata = {
    title: "Online Store",
    description: "Browse products from independent sellers.",
};

const onest = Onest({
    subsets: ["latin", "cyrillic"],
    display: "swap",
    variable: "--font-onest",
});

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="en" className={onest.variable}>
            <body>
                <a
                    className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4"
                    href="#main-content"
                >
                    Skip to content
                </a>
                <Suspense fallback={null}>
                    <StoreProvider>
                        <Header />
                        <div
                            id="main-content"
                            className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
                            tabIndex={-1}
                        >
                            {children}
                        </div>
                        <Footer />
                    </StoreProvider>
                </Suspense>
            </body>
        </html>
    );
}
