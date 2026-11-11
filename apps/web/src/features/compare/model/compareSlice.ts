import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { z } from "zod";
import { MAX_COMPARED_PRODUCTS } from "@/shared/api/baseApi";

export const COMPARE_STORAGE_KEY = "store.compare";

const storedIdsSchema = z.array(z.uuid()).max(MAX_COMPARED_PRODUCTS);

type CompareState = {
    ids: string[];
    // False until the saved list has been read, so an empty first render is
    // not written back over it.
    isLoaded: boolean;
};

const initialState: CompareState = { ids: [], isLoaded: false };

const compareSlice = createSlice({
    name: "compare",
    initialState,
    reducers: {
        compareLoaded(state, action: PayloadAction<string[]>) {
            state.ids = action.payload;
            state.isLoaded = true;
        },
        compareToggled(state, action: PayloadAction<string>) {
            const id = action.payload;
            if (state.ids.includes(id)) {
                state.ids = state.ids.filter((current) => current !== id);
            } else if (state.ids.length < MAX_COMPARED_PRODUCTS) {
                state.ids.push(id);
            }
        },
        compareCleared(state) {
            state.ids = [];
        },
    },
    selectors: {
        selectComparedIds: (state) => state.ids,
        selectIsCompareLoaded: (state) => state.isLoaded,
        selectIsCompareFull: (state) =>
            state.ids.length >= MAX_COMPARED_PRODUCTS,
    },
});

export const { compareLoaded, compareToggled, compareCleared } =
    compareSlice.actions;
export const { selectComparedIds, selectIsCompareLoaded, selectIsCompareFull } =
    compareSlice.selectors;
export default compareSlice;

export function readStoredCompareIds(): string[] {
    try {
        const stored = window.localStorage.getItem(COMPARE_STORAGE_KEY);
        if (stored === null) return [];
        const parsed = storedIdsSchema.safeParse(JSON.parse(stored));
        return parsed.success ? parsed.data : [];
    } catch {
        // Storage can be blocked or hold invalid JSON; start with an empty list.
        return [];
    }
}

export function writeStoredCompareIds(ids: string[]): void {
    try {
        window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(ids));
    } catch {
        // The list still works for this visit when storage is unavailable.
    }
}
