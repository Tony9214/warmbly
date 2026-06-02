// One read-only section of the Settings → Infrastructure page. Each section
// shows which provider is live for one backend kind (KMS / blob / encrypted-
// keys / eventbus / transport) from the runtime registry.
//
// These backends are chosen via environment configuration at boot and are
// intentionally NOT switchable from the UI — changing them at runtime would
// orphan existing ciphertext / DEKs. So this surface is read-only by design;
// it answers "what are we actually running?" and nothing more.

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    getActiveBackend,
    listStorageBackends,
} from "@/lib/api/client/admin/settings";
import type { StorageBackend, StorageBackendKind } from "@/lib/api/models/admin";

export interface BackendSectionProps {
    kind: StorageBackendKind;
    title: string;
    description: string;
    /** Plain-English note about the backend's role. */
    notes?: string;
}

export function BackendSection({ kind, title, description, notes }: BackendSectionProps) {
    const listQ = useQuery({
        queryKey: ["admin", "settings", "backends", kind],
        queryFn: () => listStorageBackends(kind),
        retry: false,
    });
    const activeQ = useQuery({
        queryKey: ["admin", "settings", "backends", "active", kind],
        queryFn: () => getActiveBackend(kind),
        retry: false,
    });

    const backends = listQ.data ?? [];
    const active = activeQ.data;
    const isPending = listQ.isLoading || activeQ.isLoading;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    {title}
                    <Badge
                        variant="outline"
                        className="text-[10px] font-normal text-muted-foreground"
                    >
                        read-only
                    </Badge>
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
                {isPending && <Skeleton className="h-12 w-1/2" />}

                {!isPending && active && <ActiveRow backend={active} />}
                {!isPending && !active && (
                    <div className="text-xs text-muted-foreground">
                        Configured via environment at boot — no provider is registered in
                        the runtime registry for this backend.
                    </div>
                )}

                {/* Only show the list when there's more than the active one to show. */}
                {!isPending && backends.length > 1 && (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {backends.map((b) => (
                            <BackendRow
                                key={b.id}
                                backend={b}
                                isActive={b.id === active?.id}
                            />
                        ))}
                    </ul>
                )}

                {notes && (
                    <div className="text-[11px] text-muted-foreground border-l-2 border-[var(--admin-accent)] pl-3">
                        {notes}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ActiveRow({ backend }: { backend: StorageBackend }) {
    return (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span>{backend.label || backend.provider}</span>
                <Badge
                    variant="outline"
                    className="text-[10px] border-emerald-300 text-emerald-700"
                >
                    live
                </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
                {backend.provider} · {backend.id}
            </div>
            {backend.config && Object.keys(backend.config).length > 0 && (
                <details className="mt-2">
                    <summary className="text-[11px] text-muted-foreground cursor-pointer">
                        Configuration
                    </summary>
                    <pre className="mt-1 text-[11px] bg-background border border-border rounded p-2 overflow-auto font-mono">
                        {JSON.stringify(redactSecrets(backend.config), null, 2)}
                    </pre>
                </details>
            )}
        </div>
    );
}

function BackendRow({ backend, isActive }: { backend: StorageBackend; isActive: boolean }) {
    return (
        <li className="py-2.5 px-3 flex items-center gap-3">
            <span
                className={`size-2 rounded-full ${
                    isActive ? "bg-emerald-500" : "bg-zinc-300"
                }`}
            />
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                    {backend.label || backend.provider}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">
                    {backend.provider} · {backend.id}
                </div>
            </div>
            {isActive ? (
                <Badge className="bg-emerald-600 text-[10px]">live</Badge>
            ) : (
                <Badge variant="outline" className="text-[10px]">
                    standby
                </Badge>
            )}
        </li>
    );
}

// Best-effort secret redaction for display. The registry shouldn't return raw
// secrets to the UI in the first place, but if it does we don't paint them
// on-screen verbatim.
function redactSecrets(cfg: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(cfg)) {
        if (/key|secret|password|token/i.test(k) && typeof v === "string") {
            out[k] = v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-2)}` : "***";
        } else {
            out[k] = v;
        }
    }
    return out;
}
