import { configureStore } from "@reduxjs/toolkit";
import compareSlice from "@/features/compare/model/compareSlice";
import { baseApi } from "@/shared/api/baseApi";

export const makeStore = () => {
    return configureStore({
        reducer: {
            [baseApi.reducerPath]: baseApi.reducer,
            [compareSlice.reducerPath]: compareSlice.reducer,
        },
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware().concat(baseApi.middleware),
    });
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];