// /admin/discounts — discount / promo code management.

import { Request } from "@/lib/api/client";
import { buildSearchQuery } from "@/lib/api/client/admin/query";
import type {
    AdminDiscountRedemptionsResult,
    AdminDiscountSearch,
    AdminDiscountsResult,
    CreateDiscountRequest,
    Discount,
    Plan,
    UpdateDiscountRequest,
} from "@/lib/api/models/admin";

function toQuery(params: AdminDiscountSearch): string {
    return buildSearchQuery(params as Record<string, unknown>);
}

export function listDiscounts(
    params: AdminDiscountSearch = {},
): Promise<AdminDiscountsResult> {
    return Request({
        method: "GET",
        url: `/admin/discounts${toQuery(params)}`,
        authorization: true,
    });
}

export function getDiscount(id: string): Promise<Discount> {
    return Request({ method: "GET", url: `/admin/discounts/${id}`, authorization: true });
}

export function createDiscount(body: CreateDiscountRequest): Promise<Discount> {
    return Request({
        method: "POST",
        url: "/admin/discounts",
        data: body,
        authorization: true,
    });
}

export function updateDiscount(
    id: string,
    body: UpdateDiscountRequest,
): Promise<Discount> {
    return Request({
        method: "PATCH",
        url: `/admin/discounts/${id}`,
        data: body,
        authorization: true,
    });
}

export function deleteDiscount(id: string): Promise<{ message: string }> {
    return Request({
        method: "DELETE",
        url: `/admin/discounts/${id}`,
        authorization: true,
    });
}

export function listDiscountRedemptions(
    id: string,
    cursor?: string,
): Promise<AdminDiscountRedemptionsResult> {
    const q = cursor ? `?cursor=${cursor}` : "";
    return Request({
        method: "GET",
        url: `/admin/discounts/${id}/redemptions${q}`,
        authorization: true,
    });
}

// Plans for the eligibility selector. Tolerates both {plans} and {data} shapes
// since the plans endpoint envelope differs from the paginated lists.
export async function listPlansForEligibility(): Promise<Plan[]> {
    const res = await Request<{ plans?: Plan[]; data?: Plan[] }>({
        method: "GET",
        url: "/admin/plans",
        authorization: true,
    });
    return res.plans ?? res.data ?? [];
}
