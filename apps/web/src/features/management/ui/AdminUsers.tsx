"use client";

import { useState, type FormEvent } from "react";
import {
    useDeleteUserMutation,
    useManagementUserQuery,
    useManagementUsersQuery,
    useSaveUserMutation,
    type ManagedUser,
} from "../api/management-api";

function UserDetail({ id }: { id: string }) {
    const query = useManagementUserQuery(id);
    if (query.isLoading) return <output>Loading user…</output>;
    if (query.isError)
        return (
            <p role="alert">
                Couldn't load user.{" "}
                <button onClick={() => void query.refetch()}>Retry</button>
            </p>
        );
    return (
        query.data && (
            <section>
                <h3>{query.data.name}</h3>
                <p>
                    {query.data.orderCount} orders; total spent{" "}
                    {query.data.totalSpent}.
                </p>
                <p>
                    {query.data.seller
                        ? `Store: ${query.data.seller.storeName}`
                        : "No seller profile."}
                </p>
                <h4>Recent orders</h4>
                {query.data.recentOrders.length === 0 ? (
                    <p>No orders yet.</p>
                ) : (
                    <ul>
                        {query.data.recentOrders.map((order) => (
                            <li key={order.id}>
                                {order.id} — {order.status} —{" "}
                                {order.totalAmount}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        )
    );
}

export default function AdminUsers() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [editing, setEditing] = useState<ManagedUser | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const query = useManagementUsersQuery({
        page,
        search: search || undefined,
    });
    const [save, state] = useSaveUserMutation();
    const [remove, removeState] = useDeleteUserMutation();

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const input = {
            name: String(data.get("name") ?? "").trim(),
            isAdmin: data.has("isAdmin"),
            ...(editing
                ? { emailVerified: data.has("emailVerified") }
                : {
                      email: String(data.get("email") ?? ""),
                      password: String(data.get("password") ?? ""),
                  }),
        };
        try {
            await save({ id: editing?.id, input }).unwrap();
            setEditing(null);
            form.reset();
            setMessage("User saved.");
        } catch {
            setMessage(
                "Couldn't save the user. Check the fields and permissions.",
            );
        } finally {
            state.reset();
        }
    }

    async function deleteItem(user: ManagedUser) {
        if (
            !window.confirm(
                `Delete ${user.name}? Their seller profile and products will also be deleted.`,
            )
        )
            return;
        try {
            await remove(user.id).unwrap();
            if (selected === user.id) setSelected(null);
            setMessage("User deleted.");
        } catch {
            setMessage("Couldn't delete the user. Check your permissions.");
        }
    }

    return (
        <section>
            <h2>Users</h2>
            <label>
                Search users{" "}
                <input
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                />
            </label>
            {query.isFetching && <output>Loading users…</output>}
            {query.isError && (
                <p role="alert">
                    Couldn't load users.{" "}
                    <button onClick={() => void query.refetch()}>Retry</button>
                </p>
            )}
            {query.currentData?.length === 0 && !query.isFetching && (
                <p>No users found.</p>
            )}
            <ul>
                {query.currentData?.map((user) => (
                    <li key={user.id}>
                        {user.name} ({user.email}){" "}
                        {user.isAdmin ? "Admin" : "Customer"}{" "}
                        <button
                            type="button"
                            onClick={() => setSelected(user.id)}
                        >
                            Details
                        </button>{" "}
                        <button type="button" onClick={() => setEditing(user)}>
                            Edit
                        </button>{" "}
                        <button
                            type="button"
                            disabled={removeState.isLoading}
                            onClick={() => void deleteItem(user)}
                        >
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
            <nav aria-label="User pages">
                <button
                    disabled={page === 1 || query.isFetching}
                    onClick={() => setPage(page - 1)}
                >
                    Previous
                </button>{" "}
                Page {page}{" "}
                <button
                    disabled={
                        query.isFetching ||
                        !query.currentData ||
                        query.currentData.length < 20
                    }
                    onClick={() => setPage(page + 1)}
                >
                    Next
                </button>
            </nav>
            {selected && <UserDetail id={selected} />}
            <h3>{editing ? "Edit user" : "Add user"}</h3>
            <form
                key={editing?.id ?? "new"}
                onSubmit={(event) => void submit(event)}
            >
                <p>
                    <label>
                        Name{" "}
                        <input
                            name="name"
                            required
                            maxLength={100}
                            defaultValue={editing?.name}
                        />
                    </label>
                </p>
                {!editing && (
                    <>
                        <p>
                            <label>
                                Email{" "}
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    maxLength={254}
                                    autoComplete="off"
                                />
                            </label>
                        </p>
                        <p>
                            <label>
                                Temporary password{" "}
                                <input
                                    name="password"
                                    type="password"
                                    minLength={8}
                                    maxLength={128}
                                    required
                                    autoComplete="new-password"
                                />
                            </label>
                        </p>
                    </>
                )}
                <p>
                    <label>
                        <input
                            name="isAdmin"
                            type="checkbox"
                            defaultChecked={editing?.isAdmin}
                        />{" "}
                        Admin
                    </label>
                </p>
                {editing && (
                    <p>
                        <label>
                            <input
                                name="emailVerified"
                                type="checkbox"
                                defaultChecked={editing.emailVerified}
                            />{" "}
                            Email verified
                        </label>
                    </p>
                )}
                <button disabled={state.isLoading}>
                    {state.isLoading ? "Saving…" : "Save user"}
                </button>
                {editing && (
                    <button type="button" onClick={() => setEditing(null)}>
                        Cancel editing
                    </button>
                )}
            </form>
            {message && <output>{message}</output>}
        </section>
    );
}
