// /admin/outreach — platform mailer composer + audit log.

import { Request } from "@/lib/api/client";
import type {
    AdminOutreachMessage,
    SendAdminOutreachRequest,
} from "@/lib/api/models/admin";

export function sendOutreach(
    body: SendAdminOutreachRequest,
): Promise<AdminOutreachMessage> {
    return Request({
        method: "POST",
        url: "/admin/outreach",
        authorization: true,
        data: body,
    });
}

export function listOutreach(
    limit = 50,
): Promise<{ data: AdminOutreachMessage[] }> {
    return Request({
        method: "GET",
        url: `/admin/outreach?limit=${limit}`,
        authorization: true,
    });
}
