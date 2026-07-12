// Settings → Releases.
//
// Shows the worker image release state per channel (resolved from GitHub
// releases) and lets an operator trigger an immediate release check.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    AlertTriangle,
    ExternalLink,
    PackageOpen,
    PowerOff,
    RefreshCw,
    Tag,
} from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
    checkReleases,
    getReleasesState,
    type ReleaseChannelState,
} from "@/lib/api/client/admin/releases";

const CHANNEL_TONES: Record<string, { card: string; badge: string }> = {
    stable: {
        card: "border-emerald-200 bg-emerald-50/40",
        badge: "border-emerald-300 bg-emerald-100/60 text-emerald-800",
    },
    dev: {
        card: "border-amber-200 bg-amber-50/40",
        badge: "border-amber-300 bg-amber-100/60 text-amber-800",
    },
};

function isZeroTime(iso: string | undefined): boolean {
    return !iso || iso.startsWith("0001-01-01");
}

export default function ReleasesPage() {
    const qc = useQueryClient();
    const [lastChanged, setLastChanged] = useState<unknown[] | null>(null);

    const stateQ = useQuery({
        queryKey: ["admin", "releases-state"],
        queryFn: getReleasesState,
        retry: false,
    });

    const checkMut = useMutation({
        mutationFn: checkReleases,
        onSuccess: (r) => {
            const changed = Array.isArray(r.changed) ? r.changed : [];
            setLastChanged(changed);
            if (changed.length === 0) {
                toast.success("Checked releases, no profiles changed");
            } else {
                toast.success(
                    `Checked releases, ${changed.length} profile${changed.length === 1 ? "" : "s"} updated`,
                );
            }
            qc.invalidateQueries({ queryKey: ["admin", "releases-state"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const state = stateQ.data;

    return (
        <div>
            <PageHeader
                title="Releases"
                description="Worker images are resolved from GitHub releases per channel; profiles on stable or dev follow these automatically, and auto-update profiles roll their workers when a new image lands."
            >
                <Button
                    size="sm"
                    onClick={() => checkMut.mutate()}
                    disabled={checkMut.isPending || stateQ.isLoading}
                    className="bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-strong)] text-white"
                >
                    <RefreshCw
                        className={`size-4 ${checkMut.isPending ? "animate-spin" : ""}`}
                    />
                    {checkMut.isPending ? "Checking..." : "Check now"}
                </Button>
            </PageHeader>

            {stateQ.isLoading && (
                <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <Skeleton className="h-44 w-full" />
                        <Skeleton className="h-44 w-full" />
                    </div>
                </div>
            )}

            {stateQ.isError && (
                <ErrorState
                    error={stateQ.error}
                    title="Failed to load release state"
                    onRetry={() => stateQ.refetch()}
                />
            )}

            {state && (
                <div className="space-y-3">
                    {!state.enabled && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                            <PowerOff className="size-3.5 mt-0.5 shrink-0" />
                            <div>
                                <div className="font-medium">Release tracking is disabled</div>
                                <p className="mt-0.5">
                                    RELEASES_ENABLED (or the GitHub repo config) is off on the
                                    backend, so channels are not being refreshed and profiles will
                                    not pick up new images.
                                </p>
                            </div>
                        </div>
                    )}

                    <Card>
                        <CardContent className="py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
                                <KV
                                    label="GitHub repo"
                                    value={state.github_repo || "not configured"}
                                    mono
                                />
                                <KV
                                    label="Image repo"
                                    value={state.image_repo || "not configured"}
                                    mono
                                />
                                <KV
                                    label="Last checked"
                                    value={
                                        isZeroTime(state.last_checked_at)
                                            ? "never checked"
                                            : new Date(state.last_checked_at).toLocaleString()
                                    }
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {state.last_error && (
                        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
                            <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                                <div className="font-medium">Last check failed</div>
                                <p className="mt-0.5 font-mono break-words">{state.last_error}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {Object.entries(state.channels ?? {}).map(([name, ch]) =>
                            ch ? <ChannelCard key={name} name={name} channel={ch} /> : null,
                        )}
                    </div>

                    {Object.values(state.channels ?? {}).filter(Boolean).length === 0 && (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <PackageOpen className="size-8 text-muted-foreground mx-auto mb-3" />
                                <div className="text-sm font-medium">No releases resolved yet</div>
                                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                                    Run a check to resolve the latest stable and dev worker images
                                    from GitHub releases.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {lastChanged && lastChanged.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">
                                    Profiles updated by the last check ({lastChanged.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-2">
                                {lastChanged.map((entry, i) => (
                                    <pre
                                        key={i}
                                        className="rounded-md bg-muted p-2 text-[11px] font-mono whitespace-pre-wrap break-words"
                                    >
                                        {JSON.stringify(entry, null, 2)}
                                    </pre>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}

// --------------------------------------------------------------------
// Channel card
// --------------------------------------------------------------------

function ChannelCard({
    name,
    channel,
}: {
    name: string;
    channel: ReleaseChannelState;
}) {
    const tone = CHANNEL_TONES[name] ?? {
        card: "border-border bg-background",
        badge: "",
    };

    return (
        <Card className={tone.card}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Tag className="size-4 text-[var(--admin-accent)]" />
                    <span className="capitalize">{name}</span>
                    <Badge variant="outline" className={`text-[10px] ${tone.badge}`}>
                        {channel.tag || "no tag"}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
                <div>
                    <div className="uppercase tracking-wide text-[9px] text-muted-foreground">
                        Image
                    </div>
                    <div className="text-[11px] font-mono break-all">
                        {channel.image || "not resolved"}
                    </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>
                        Published{" "}
                        {channel.published_at && !isZeroTime(channel.published_at)
                            ? new Date(channel.published_at).toLocaleString()
                            : "unknown"}
                    </span>
                    {channel.html_url && (
                        <a
                            href={channel.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--admin-accent)] hover:underline"
                        >
                            <ExternalLink className="size-3" />
                            GitHub release
                        </a>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function KV({
    label,
    value,
    mono,
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div className="min-w-0">
            <div className="uppercase tracking-wide text-[9px]">{label}</div>
            <div
                className={`text-[11px] text-foreground break-all ${mono ? "font-mono" : ""}`}
            >
                {value}
            </div>
        </div>
    );
}
