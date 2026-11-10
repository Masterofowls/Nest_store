import Image from "next/image";
import type { CurrentUser } from "@/entities/user/model/user.schema";

type UserProps = {
    user: CurrentUser;
};

export default function User({ user }: UserProps) {
    return (
        <section aria-label="Account details">
            {user.image !== null && (
                <Image
                    src={user.image}
                    alt=""
                    width={96}
                    height={96}
                    unoptimized
                />
            )}
            <dl>
                <div>
                    <dt>Name</dt>
                    <dd>{user.name}</dd>
                </div>
                <div>
                    <dt>Email</dt>
                    <dd>{user.email}</dd>
                </div>
                <div>
                    <dt>Email status</dt>
                    <dd>{user.emailVerified ? "Verified" : "Not verified"}</dd>
                </div>
            </dl>
        </section>
    );
}
