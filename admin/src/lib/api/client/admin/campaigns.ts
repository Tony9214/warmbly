// /admin/campaigns/* — platform-wide campaign admin.

import { Request } from "@/lib/api/client";
import type {
    AdminCampaignDetail,
    AdminCampaignSearch,
    AdminCampaignsResult,
} from "@/lib/api/models/admin";

function toQuery(params: AdminCampaignSearch): string {
    const usp = new URLSearchParams();
    if (params.q) usp.set("q", params.q);
    if (params.user_id) usp.set("user_id", params.user_id);
    if (params.org_id) usp.set("org_id", params.org_id);
    if (params.status) usp.set("status", params.status);
    if (params.cursor) usp.set("cursor", params.cursor);
    if (params.limit != null) usp.set("limit", String(params.limit));
    if (params.sort_by) usp.set("sort_by", params.sort_by);
    if (params.sort_desc) usp.set("sort_desc", "true");
    const s = usp.toString();
    return s ? `?${s}` : "";
}

export function searchCampaigns(
    params: AdminCampaignSearch = {},
): Promise<AdminCampaignsResult> {
    return Request({
        method: "GET",
        url: `/admin/campaigns${toQuery(params)}`,
        authorization: true,
    });
}

export function getCampaign(id: string): Promise<AdminCampaignDetail> {
    return Request({
        method: "GET",
        url: `/admin/campaigns/${id}`,
        authorization: true,
    });
}

export function stopCampaign(id: string, reason: string): Promise<void> {
    return Request({
        method: "POST",
        url: `/admin/campaigns/${id}/stop`,
        authorization: true,
        data: { reason },
    });
}
