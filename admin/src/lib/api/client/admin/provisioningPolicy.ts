// /admin/provisioning-policy — per-provider guardrails for automatic worker
// provisioning (rate caps, budget, cooldown).

import { Request } from "@/lib/api/client";

export interface ProvisioningPolicy {
    provider: string;
    enabled: boolean;
    auto_provision: boolean;
    max_per_day: number;
    max_per_month: number;
    monthly_budget: number | null;
    budget_currency: string;
    cooldown_minutes: number;
    updated_at: string;
}

export async function listProvisioningPolicies(): Promise<ProvisioningPolicy[]> {
    const res = await Request<{ policies: ProvisioningPolicy[] }>({
        method: "GET",
        url: "/admin/provisioning-policy",
        authorization: true,
    });
    return res.policies ?? [];
}

export function updateProvisioningPolicy(
    policy: ProvisioningPolicy,
): Promise<ProvisioningPolicy> {
    return Request({
        method: "PUT",
        url: "/admin/provisioning-policy",
        data: policy,
        authorization: true,
    });
}
