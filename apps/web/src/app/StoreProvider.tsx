"use client";

import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { syncCompareWithStorage } from "@/features/compare/model/compareSlice";
import { makeStore, type AppStore } from "./store";

export default function StoreProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [store] = useState<AppStore>(makeStore);

    // The saved comparison is read after mount: the server render has no
    // access to it, and reading it earlier would cause a hydration mismatch.
    useEffect(() => syncCompareWithStorage(store), [store]);

    return <Provider store={store}>{children}</Provider>;
}
