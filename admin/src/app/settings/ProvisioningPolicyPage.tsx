// Settings → Provisioning Policy.
//
// Per-provider guardrails for automatic worker provisioning: whether the
// provider may be used at all, whether the platform may provision on its
// own, and the rate, budget, and cooldown caps that bound it.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState } from "@/components/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
    listProvisioningPolicies,
    updateProvisioningPolicy,
    type ProvisioningPolicy,
} from "@/lib/api/client/admin/provisioningPolicy";

export default function ProvisioningPolicyPage() {
    const qc = useQueryClient();
    const policiesQ = useQuery({
        queryKey: ["admin", "provisioning-policy"],
        queryFn: listProvisioningPolicies,
        retry: false,
    });

    const invalidate = () =>
        qc.invalidateQueries({ queryKey: ["admin", "provisioning-policy"] });

    return (
        <div>
            <PageHeader
                title="Provisioning Policy"
                description="Guardrails for automatic worker provisioning per cloud provider: how many machines may be created, how fast, and within what budget."
            />

            {policiesQ.isLoading && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Skeleton className="h-72 w-full" />
                    <Skeleton className="h-72 w-full" />
                </div>
            )}

            {policiesQ.isError && (
                <ErrorState
                    error={policiesQ.error}
                    title="Failed to load provisioning policies"
                    onRetry={() => policiesQ.refetch()}
                />
            )}

            {policiesQ.data && policiesQ.data.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <ShieldCheck className="size-8 text-muted-foreground mx-auto mb-3" />
                        <div className="text-sm font-medium">No provisioning policies</div>
                        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                            Policies appear here once a cloud provider is connected. Each
                            provider gets its own guardrails for automatic provisioning.
                        </p>
                    </CardContent>
                </Card>
            )}

            {policiesQ.data && policiesQ.data.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {policiesQ.data.map((p) => (
                        <PolicyCard key={p.provider} policy={p} onSaved={invalidate} />
                    ))}
                </div>
            )}
        </div>
    );
}

// --------------------------------------------------------------------
// Policy card
// --------------------------------------------------------------------

interface Draft {
    enabled: boolean;
    auto_provision: boolean;
    max_per_day: string;
    max_per_month: string;
    monthly_budget: string;
    cooldown_minutes: string;
}

function toDraft(p: ProvisioningPolicy): Draft {
    return {
        enabled: p.enabled,
        auto_provision: p.auto_provision,
        max_per_day: String(p.max_per_day),
        max_per_month: String(p.max_per_month),
        monthly_budget: p.monthly_budget == null ? "" : String(p.monthly_budget),
        cooldown_minutes: String(p.cooldown_minutes),
    };
}

function isDirty(a: Draft, b: Draft): boolean {
    return (
        a.enabled !== b.enabled ||
        a.auto_provision !== b.auto_provision ||
        a.max_per_day !== b.max_per_day ||
        a.max_per_month !== b.max_per_month ||
        a.monthly_budget !== b.monthly_budget ||
        a.cooldown_minutes !== b.cooldown_minutes
    );
}

function PolicyCard({
    policy,
    onSaved,
}: {
    policy: ProvisioningPolicy;
    onSaved: () => void;
}) {
    const [draft, setDraft] = useState<Draft>(() => toDraft(policy));

    // Re-sync the form when a fresh policy comes back from the server.
    useEffect(() => {
        setDraft(toDraft(policy));
    }, [policy]);

    const dirty = isDirty(draft, toDraft(policy));

    const saveMut = useMutation({
        mutationFn: () =>
            updateProvisioningPolicy({
                ...policy,
                enabled: draft.enabled,
                auto_provision: draft.auto_provision,
                max_per_day: Number(draft.max_per_day) || 0,
                max_per_month: Number(draft.max_per_month) || 0,
                monthly_budget:
                    draft.monthly_budget.trim() === ""
                        ? null
                        : Number(draft.monthly_budget) || 0,
                cooldown_minutes: Number(draft.cooldown_minutes) || 0,
            }),
        onSuccess: () => {
            toast.success(`Policy saved for ${policy.provider}`);
            onSaved();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-[var(--admin-accent)]" />
                    <span className="capitalize">{policy.provider}</span>
                    <Badge variant="outline" className="text-[10px]">
                        {draft.enabled ? "enabled" : "disabled"}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
                <SwitchRow
                    label="Enabled"
                    hint="Master switch for provisioning through this provider."
                    checked={draft.enabled}
                    onChange={(v) => set({ enabled: v })}
                />
                <SwitchRow
                    label="Auto-provision"
                    hint="Allow the platform to create workers on its own when capacity runs low, without an admin clicking provision."
                    checked={draft.auto_provision}
                    onChange={(v) => set({ auto_provision: v })}
                />

                <div className="grid grid-cols-2 gap-3">
                    <NumberField
                        id={`${policy.provider}-max-day`}
                        label="Max per day"
                        value={draft.max_per_day}
                        onChange={(v) => set({ max_per_day: v })}
                    />
                    <NumberField
                        id={`${policy.provider}-max-month`}
                        label="Max per month"
                        value={draft.max_per_month}
                        onChange={(v) => set({ max_per_month: v })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor={`${policy.provider}-budget`}>
                            Monthly budget ({policy.budget_currency})
                        </Label>
                        <Input
                            id={`${policy.provider}-budget`}
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="no cap"
                            value={draft.monthly_budget}
                            onChange={(e) => set({ monthly_budget: e.target.value })}
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Leave empty for no budget cap.
                        </p>
                    </div>
                    <NumberField
                        id={`${policy.provider}-cooldown`}
                        label="Cooldown minutes"
                        hint="Minimum wait between automatic provisioning runs."
                        value={draft.cooldown_minutes}
                        onChange={(v) => set({ cooldown_minutes: v })}
                    />
                </div>

                <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">
                        Updated {new Date(policy.updated_at).toLocaleString()}
                    </span>
                    <Button
                        size="sm"
                        onClick={() => saveMut.mutate()}
                        disabled={!dirty || saveMut.isPending}
                        className="bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-strong)] text-white"
                    >
                        <Save className="size-4" />
                        {saveMut.isPending ? "Saving..." : "Save"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function SwitchRow({
    label,
    hint,
    checked,
    onChange,
}: {
    label: string;
    hint: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div>
                <div className="text-sm font-medium">{label}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );
}

function NumberField({
    id,
    label,
    hint,
    value,
    onChange,
}: {
    id: string;
    label: string;
    hint?: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type="number"
                min={0}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    );
}
