import type { Metadata } from "next";
import Signup from "@/components/Signup";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
    return (
        <main>
            <Signup />
        </main>
    );
}
