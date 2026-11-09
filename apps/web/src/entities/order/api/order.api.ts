import { z } from "zod";
import {
    getJson,
    pageQuerySchema,
    parseId,
    parseResponse,
} from "../../../shared/api/response";
import {
    orderDetailSchema,
    orderItemSchema,
    orderListSchema,
    orderSchema,
} from "../model/order.schema";

const orderQuerySchema = pageQuerySchema.extend({
    status: z.enum(["pending", "cancelled"]).optional(),
});
export type OrderQuery = z.input<typeof orderQuerySchema>;

export function parseOrderItem(value: unknown) {
    return parseResponse(orderItemSchema, value, "order item");
}

export function parseOrder(value: unknown) {
    return parseResponse(orderSchema, value, "order");
}

export function parseOrderList(value: unknown) {
    return parseResponse(orderListSchema, value, "order list");
}

export function parseOrderDetail(value: unknown) {
    return parseResponse(orderDetailSchema, value, "order detail");
}

export async function getOrders(api: string, query: OrderQuery = {}) {
    return parseOrderList(
        await getJson(
            api,
            "orders",
            "Order list",
            orderQuerySchema.parse(query),
        ),
    );
}

export async function getOrder(api: string, id: string) {
    return parseOrderDetail(
        await getJson(api, `orders/${parseId(id)}`, "Order detail"),
    );
}
