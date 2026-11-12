// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { makeStore } from "@/app/store";
import {
    COMPARE_STORAGE_KEY,
    compareCleared,
    compareLoaded,
    compareToggled,
    readStoredCompareIds,
    selectComparedIds,
    selectIsCompareFull,
    syncCompareWithStorage,
} from "./compareSlice";

const ids = [1, 2, 3, 4, 5].map(
    (n) => `00000000-0000-4000-8000-00000000000${n}`,
);

afterEach(() => {
    window.localStorage.clear();
});

describe("compare list", () => {
    it("adds, removes and caps the list at four products", () => {
        const store = makeStore();
        for (const id of ids) store.dispatch(compareToggled(id));
        expect(selectComparedIds(store.getState())).toEqual(ids.slice(0, 4));
        expect(selectIsCompareFull(store.getState())).toBe(true);

        store.dispatch(compareToggled(ids[0] ?? ""));
        expect(selectComparedIds(store.getState())).toEqual(ids.slice(1, 4));

        store.dispatch(compareCleared());
        expect(selectComparedIds(store.getState())).toEqual([]);
    });

    it("replaces the list with the saved one when loaded", () => {
        const store = makeStore();
        store.dispatch(compareLoaded(ids.slice(0, 2)));
        expect(selectComparedIds(store.getState())).toEqual(ids.slice(0, 2));
    });

    it("saves changes and follows a list saved by another tab", () => {
        window.localStorage.setItem(
            COMPARE_STORAGE_KEY,
            JSON.stringify(ids.slice(0, 1)),
        );
        const store = makeStore();
        const stop = syncCompareWithStorage(store);
        expect(selectComparedIds(store.getState())).toEqual(ids.slice(0, 1));

        store.dispatch(compareToggled(ids[1] ?? ""));
        expect(window.localStorage.getItem(COMPARE_STORAGE_KEY)).toBe(
            JSON.stringify(ids.slice(0, 2)),
        );

        // Another tab replaces the list; this tab follows it.
        window.localStorage.setItem(
            COMPARE_STORAGE_KEY,
            JSON.stringify(ids.slice(2, 4)),
        );
        window.dispatchEvent(
            new StorageEvent("storage", { key: COMPARE_STORAGE_KEY }),
        );
        expect(selectComparedIds(store.getState())).toEqual(ids.slice(2, 4));

        stop();
        window.dispatchEvent(
            new StorageEvent("storage", { key: COMPARE_STORAGE_KEY }),
        );
        store.dispatch(compareCleared());
        expect(window.localStorage.getItem(COMPARE_STORAGE_KEY)).toBe(
            JSON.stringify(ids.slice(2, 4)),
        );
    });

    it("reads a valid saved list", () => {
        window.localStorage.setItem(
            COMPARE_STORAGE_KEY,
            JSON.stringify(ids.slice(0, 2)),
        );
        expect(readStoredCompareIds()).toEqual(ids.slice(0, 2));
    });

    it.each([
        ["invalid JSON", "{"],
        ["a non-array", '{"ids":[]}'],
        ["a non-UUID", '["keyboard"]'],
        ["too many products", JSON.stringify(ids)],
    ])("ignores a saved list with %s", (_name, stored) => {
        window.localStorage.setItem(COMPARE_STORAGE_KEY, stored);
        expect(readStoredCompareIds()).toEqual([]);
    });
});
