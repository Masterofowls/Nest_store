"use client";

import { useEffect, useRef } from "react";
import {
    useGetCurrentUserQuery,
    useRecordProductViewMutation,
} from "@/shared/api/baseApi";

type RecordProductViewProps = { productId: string };

export default function RecordProductView({
    productId,
}: RecordProductViewProps) {
    const { data: user } = useGetCurrentUserQuery();
    const [recordProductView] = useRecordProductViewMutation();
    const recordedProducts = useRef(new Set<string>());

    useEffect(() => {
        if (!user || recordedProducts.current.has(productId)) return;
        recordedProducts.current.add(productId);
        void recordProductView(productId);
    }, [productId, recordProductView, user]);

    return null;
}
