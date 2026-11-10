import Link from "next/link";

export default function NotFound() {
    return (
        <main>
            <h1>Page not found</h1>
            <p>This page doesn't exist.</p>
            <Link href="/">Go home</Link>
        </main>
    );
}
