// Platform-wide campaign admin. Use case is finding runaway sends and
// stopping them — search by name, filter by status, force-stop with a
// reason that lands in the audit log.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Octagon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { searchCampaigns, stopCampaign } from "@/lib/api/client/admin/campaigns";
import type { AdminCampaignDetail } from "@/lib/api/models/admin";

type StatusFilter = "active" | "paused" | "completed" | "all";

const STATUS_TONE: Record<string, string> = {
    active: "border-emerald-300 text-emerald-700 bg-emerald-50",
    paused: "border-amber-300 text-amber-700 bg-amber-50",
    completed: "border-zinc-300 text-zinc-700 bg-zinc-50",
    draft: "border-zinc-300 text-zinc-500",
};

export default function CampaignsPage() {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<StatusFilter>("active");
    const [stopping, setStopping] = useState<AdminCampaignDetail | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin", "campaigns", { query, status }],
        queryFn: () =>
            searchCampaigns({
                q: query.trim() || undefined,
                status: status === "all" ? undefined : status,
                limit: 50,
            }),
        staleTime: 30_000,
    });

    const rows = data?.data ?? [];
    const total = data?.pagination.total ?? rows.length;

    return (
        <div>
            <PageHeader
                title="Campaigns"
                description="Every campaign on the platform. Find runaway sends, inspect engagement, force-stop with a reason."
            >
                <Input
                    placeholder="Search by name…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-72"
                />
                <StatusToggle value={status} onChange={setStatus} />
            </PageHeader>

            {isLoading && <SkeletonTable />}
            {error && (
                <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md p-3">
                    Failed to load campaigns.
                </div>
            )}

            {!isLoading && !error && (
                <>
                    <div className="border border-border rounded-lg overflow-hidden bg-card">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                                <tr>
                                    <th className="text-left px-3 py-2 font-medium">Name</th>
                                    <th className="text-left px-3 py-2 font-medium">Org / owner</th>
                                    <th className="text-left px-3 py-2 font-medium">Status</th>
                                    <th className="text-right px-3 py-2 font-medium">Contacts</th>
                                    <th className="text-right px-3 py-2 font-medium">Sent</th>
                                    <th className="text-right px-3 py-2 font-medium">Open</th>
                                    <th className="text-right px-3 py-2 font-medium">Reply</th>
                                    <th className="text-right px-3 py-2 font-medium">Bounce</th>
                                    <th className="text-right px-3 py-2 font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((c) => (
                                    <CampaignRow
                                        key={c.id}
                                        campaign={c}
                                        onStop={() => setStopping(c)}
                                    />
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            className="text-center text-muted-foreground py-8 text-sm"
                                        >
                                            No campaigns match this filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                            Showing {rows.length}
                            {total != null && total !== rows.length && (
                                <> of {total.toLocaleString()}</>
                            )}
                        </span>
                        {data?.pagination.has_more && (
                            <span>More results available — refine the search.</span>
                        )}
                    </div>
                </>
            )}

            {stopping && (
                <StopCampaignDialog
                    campaign={stopping}
                    open
                    onOpenChange={(v) => !v && setStopping(null)}
                />
            )}
        </div>
    );
}

function CampaignRow({
    campaign,
    onStop,
}: {
    campaign: AdminCampaignDetail;
    onStop: () => void;
}) {
    const tone = STATUS_TONE[campaign.status] ?? "border-zinc-300 text-zinc-600";
    const canStop = campaign.status === "active" || campaign.status === "paused";
    const replyRate = campaign.emails_sent
        ? ((campaign.emails_replied / campaign.emails_sent) * 100).toFixed(1)
        : "—";
    const bounceRate = campaign.emails_sent
        ? ((campaign.emails_bounced / campaign.emails_sent) * 100).toFixed(1)
        : "—";

    return (
        <tr className="border-t border-border hover:bg-muted/30">
            <td className="px-3 py-2">
                <div className="font-medium">{campaign.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono">
                    {campaign.id.slice(0, 8)}
                </div>
            </td>
            <td className="px-3 py-2 text-xs">
                {campaign.organization && (
                    <Link
                        to={`/organizations/${campaign.organization_id}`}
                        className="text-[var(--admin-accent-strong)] hover:underline"
                    >
                        {campaign.organization.name}
                    </Link>
                )}
                <div className="text-[10px] text-muted-foreground">
                    {campaign.user?.email ?? campaign.user_id.slice(0, 8)}
                </div>
            </td>
            <td className="px-3 py-2">
                <Badge variant="outline" className={`text-[10px] ${tone}`}>
                    {campaign.status}
                </Badge>
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
                {campaign.total_contacts.toLocaleString()}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
                {campaign.emails_sent.toLocaleString()}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {campaign.emails_opened.toLocaleString()}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {replyRate}%
            </td>
            <td
                className={`px-3 py-2 text-right tabular-nums ${
                    Number(bounceRate) > 5 ? "text-red-700" : "text-muted-foreground"
                }`}
            >
                {bounceRate}%
            </td>
            <td className="px-3 py-2 text-right">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onStop}
                    disabled={!canStop}
                    className="text-xs"
                    title={canStop ? "Force-stop this campaign" : "Already stopped"}
                >
                    <Octagon className="size-3" />
                    Stop
                </Button>
            </td>
        </tr>
    );
}

function StatusToggle({
    value,
    onChange,
}: {
    value: StatusFilter;
    onChange: (v: StatusFilter) => void;
}) {
    const options: { value: StatusFilter; label: string }[] = [
        { value: "active", label: "Active" },
        { value: "paused", label: "Paused" },
        { value: "completed", label: "Done" },
        { value: "all", label: "All" },
    ];
    return (
        <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={`px-2 py-1 rounded ${
                        value === opt.value
                            ? "bg-[var(--admin-accent)] text-white"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

function StopCampaignDialog({
    campaign,
    open,
    onOpenChange,
}: {
    campaign: AdminCampaignDetail;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const qc = useQueryClient();
    const [reason, setReason] = useState("");
    const mutation = useMutation({
        mutationFn: () => stopCampaign(campaign.id, reason),
        onSuccess: () => {
            toast.success("Campaign stopped");
            qc.invalidateQueries({ queryKey: ["admin", "campaigns"] });
            onOpenChange(false);
        },
        onError: (err: Error) => toast.error(err.message || "Failed to stop"),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Force-stop campaign</DialogTitle>
                    <DialogDescription>
                        Stopping <span className="font-mono">{campaign.name}</span>.
                        This is logged to the audit trail and the campaign owner
                        will see the campaign status change to stopped.
                    </DialogDescription>
                </DialogHeader>
                <div>
                    <Label htmlFor="reason" className="text-xs font-medium">
                        Reason
                    </Label>
                    <Input
                        id="reason"
                        placeholder="e.g. exceeded bounce threshold, unsolicited list"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        autoFocus
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            if (reason.trim() === "") {
                                toast.error("Reason is required");
                                return;
                            }
                            mutation.mutate();
                        }}
                        disabled={mutation.isPending}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {mutation.isPending ? "Stopping…" : "Stop campaign"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SkeletonTable() {
    return (
        <div className="border border-border rounded-lg p-4 bg-card space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
            ))}
        </div>
    );
}
