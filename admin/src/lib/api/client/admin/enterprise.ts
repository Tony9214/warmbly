// /admin/enterprise/inquiries — sales-pipeline triage.

import { Request } from "@/lib/api/client";
import { buildSearchQuery } from "@/lib/api/client/admin/query";
import type {
    AdminEnterpriseInquiriesResult,
    AdminEnterpriseInquirySearch,
    EnterpriseInquiry,
    UpdateEnterpriseInquiryRequest,
} from "@/lib/api/models/admin";

function toQuery(params: AdminEnterpriseInquirySearch): string {
    return buildSearchQuery(params as Record<string, unknown>);
}

export function listEnterpriseInquiries(
    params: AdminEnterpriseInquirySearch = {},
): Promise<AdminEnterpriseInquiriesResult> {
    return Request({
        method: "GET",
        url: `/admin/enterprise/inquiries${toQuery(params)}`,
        authorization: true,
    });
}

export function getEnterpriseInquiry(id: string): Promise<EnterpriseInquiry> {
    return Request({
        method: "GET",
        url: `/admin/enterprise/inquiries/${id}`,
        authorization: true,
    });
}

export function updateEnterpriseInquiry(
    id: string,
    body: UpdateEnterpriseInquiryRequest,
): Promise<EnterpriseInquiry> {
    return Request({
        method: "PATCH",
        url: `/admin/enterprise/inquiries/${id}`,
        authorization: true,
        data: body,
    });
}
