// Integrations dashboard.
//
// One page covers the full integration surface: catalog of available
// providers (Calendly, Cal.com, Google Sheets, Google Postmaster,
// Microsoft SNDS, DMARC, Cloudflare, GoDaddy, Namecheap), per-org
// connection state, inbound webhook URLs, DMARC reports, Postmaster /
// SNDS snapshots, and a DNS verifier widget.
//
// Layout follows the Page primitives — stat strip across the top,
// section bars between zones, no max-width chrome. Connect / disconnect
// happens in inline drawers (ConnectDrawer) rather than separate routes
// so the page stays a single navigation target from the sidebar.

"use client";

import React from "react";
import {
    CableIcon,
    CalendarCheckIcon,
    CheckIcon,
    GlobeIcon,
    PlusIcon,
    RefreshCwIcon,
    ShieldCheckIcon,
    XIcon,
} from "lucide-react";
import toast from "react-hot-toast";

import {
    EmptyBlock,
    Page,
    PageBody,
    PageTopbar,
    SectionBar,
    Stat,
    StatStrip,
    TopbarAction,
} from "@/components/layout/Page";
import useIntegrationCatalog from "@/lib/api/hooks/app/integrations/useIntegrationCatalog";
import useIntegrationConnections from "@/lib/api/hooks/app/integrations/useIntegrationConnections";
import useDisconnectIntegration from "@/lib/api/hooks/app/integrations/useDisconnectIntegration";
import useDMARCReports from "@/lib/api/hooks/app/integrations/useDMARCReports";
import useMeetingBookings from "@/lib/api/hooks/app/integrations/useMeetingBookings";
import useDNSVerifications from "@/lib/api/hooks/app/integrations/useDNSVerifications";
import type {
    IntegrationCatalogEntry,
    IntegrationCategory,
    IntegrationConnection,
    IntegrationProvider,
} from "@/lib/api/models/app/integrations/Integration";
import { cn } from "@/lib/utils";

import ConnectDrawer from "./_components/ConnectDrawer";
import InboundUrlDialog from "./_components/InboundUrlDialog";
import DNSVerifierPanel from "./_components/DNSVerifierPanel";

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
    meetings: "Meetings",
    data: "Data",
    deliverability: "Deliverability",
    dns: "DNS",
};

const CATEGORY_ORDER: IntegrationCategory[] = ["deliverability", "dns", "meetings", "data"];

export default function IntegrationsPage() {
    const catalogQuery = useIntegrationCatalog();
    const connectionsQuery = useIntegrationConnections();
    const bookingsQuery = useMeetingBookings();
    const dmarcQuery = useDMARCReports();
    const dnsQuery = useDNSVerifications();

    const disconnect = useDisconnectIntegration();

    const [connectTarget, setConnectTarget] = React.useState<IntegrationCatalogEntry | null>(null);
    const [inboundUrl, setInboundUrl] = React.useState<{ provider: IntegrationProvider; url: string } | null>(null);

    const catalog = catalogQuery.data?.catalog ?? [];
    const connections = connectionsQuery.data?.connections ?? [];
    const bookings = bookingsQuery.data?.bookings ?? [];
    const dmarcReports = dmarcQuery.data?.reports ?? [];
    const dnsVerifications = dnsQuery.data?.verifications ?? [];

    // Index connections by provider so the catalog grid can paint each
    // provider's status without a per-card query.
    const byProvider = React.useMemo(() => {
        const m: Record<string, IntegrationConnection[]> = {};
        for (const c of connections) {
            (m[c.provider] ??= []).push(c);
        }
        return m;
    }, [connections]);

    const grouped = React.useMemo(() => {
        const map: Partial<Record<IntegrationCategory, IntegrationCatalogEntry[]>> = {};
        for (const entry of catalog) {
            (map[entry.category] ??= []).push(entry);
        }
        return map;
    }, [catalog]);

    const connectedCount = connections.filter((c) => c.status === "connected").length;
    const degradedCount = connections.filter((c) => c.status === "degraded").length;

    function refreshAll() {
        catalogQuery.refetch();
        connectionsQuery.refetch();
        bookingsQuery.refetch();
        dmarcQuery.refetch();
        dnsQuery.refetch();
    }

    async function handleDisconnect(connection: IntegrationConnection) {
        try {
            await disconnect.mutateAsync(connection.id);
            toast.success("Disconnected");
        } catch {
            toast.error("Disconnect failed");
        }
    }

    return (
        <Page>
            <PageTopbar eyebrow="Integrations" subtitle="Calendly, Cal.com, Google Sheets, Postmaster, SNDS, DMARC, Cloudflare, and more">
                <button
                    type="button"
                    onClick={refreshAll}
                    aria-label="Refresh"
                    className="h-7 w-7 rounded-md border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-900 inline-flex items-center justify-center transition-colors"
                >
                    <RefreshCwIcon className={cn("w-3 h-3", connectionsQuery.isFetching && "animate-spin")} />
                </button>
            </PageTopbar>

            <StatStrip cols={4}>
                <Stat
                    label="Catalog"
                    value={catalog.length}
                    sub="available providers"
                />
                <Stat
                    label="Connected"
                    value={connectedCount}
                    sub={`${connections.length} total`}
                    accent={connectedCount > 0}
                />
                <Stat
                    label="Degraded"
                    value={degradedCount}
                    sub={degradedCount > 0 ? "needs attention" : "all healthy"}
                />
                <Stat
                    label="Meetings · 30d"
                    value={bookings.length}
                    sub="from Calendly + Cal.com"
                    last
                />
            </StatStrip>

            <PageBody>
                {/* Catalog grid grouped by category. */}
                {CATEGORY_ORDER.map((category) => {
                    const entries = grouped[category] ?? [];
                    if (entries.length === 0) return null;
                    return (
                        <section key={category}>
                            <SectionBar label={CATEGORY_LABELS[category]} count={entries.length} />
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200/60 border-b border-slate-200/60">
                                {entries.map((entry) => (
                                    <CatalogCard
                                        key={entry.provider}
                                        entry={entry}
                                        connections={byProvider[entry.provider] ?? []}
                                        onConnect={() => setConnectTarget(entry)}
                                        onDisconnect={handleDisconnect}
                                        onShowInbound={(url) => setInboundUrl({ provider: entry.provider, url })}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })}

                {/* DNS verifier widget — independent of any connection. */}
                <SectionBar label="DNS verifier">
                    <span className="text-[10.5px] text-slate-400">SPF · DKIM · DMARC</span>
                </SectionBar>
                <div className="px-5 py-4 border-b border-slate-200/60">
                    <DNSVerifierPanel verifications={dnsVerifications} />
                </div>

                {/* DMARC reports — most recent first. */}
                <SectionBar label="DMARC reports" count={dmarcReports.length}>
                    <ShieldCheckIcon className="w-3 h-3 text-slate-400" />
                </SectionBar>
                {dmarcReports.length === 0 ? (
                    <EmptyBlock
                        title="No DMARC reports yet"
                        body="Connect DMARC, then forward your rua= reports to the URL we mint for you."
                    />
                ) : (
                    <div className="divide-y divide-slate-200/60 border-b border-slate-200/60">
                        {dmarcReports.slice(0, 10).map((r) => (
                            <div key={r.id} className="px-5 h-12 flex items-center gap-3 text-[12.5px]">
                                <GlobeIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-medium text-slate-900 w-48 truncate">{r.domain}</span>
                                <span className="text-slate-500 w-40 truncate">{r.reporter_org}</span>
                                <span className="ml-auto font-mono text-[11px] tabular-nums text-slate-500">
                                    {r.pass_messages.toLocaleString()} pass
                                </span>
                                <span className="font-mono text-[11px] tabular-nums text-rose-600">
                                    {r.fail_messages.toLocaleString()} fail
                                </span>
                                <span className="font-mono text-[10.5px] text-slate-400 tabular-nums w-32 text-right">
                                    {new Date(r.range_end).toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Meeting bookings — Calendly/Cal.com conversions. */}
                <SectionBar label="Meeting bookings" count={bookings.length}>
                    <CalendarCheckIcon className="w-3 h-3 text-slate-400" />
                </SectionBar>
                {bookings.length === 0 ? (
                    <EmptyBlock
                        title="No meetings booked yet"
                        body="Connect Calendly or Cal.com to track which campaigns lead to meetings."
                    />
                ) : (
                    <div className="divide-y divide-slate-200/60 border-b border-slate-200/60">
                        {bookings.slice(0, 10).map((b) => (
                            <div key={b.id} className="px-5 h-12 flex items-center gap-3 text-[12.5px]">
                                <SourceDot source={b.source} />
                                <span className="font-medium text-slate-900 truncate w-60">{b.invitee_email}</span>
                                <span className="text-slate-500 truncate flex-1">{b.event_name}</span>
                                <span className="font-mono text-[10.5px] text-slate-400 tabular-nums">
                                    {b.scheduled_for ? new Date(b.scheduled_for).toLocaleString() : "tbd"}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </PageBody>

            {connectTarget && (
                <ConnectDrawer
                    entry={connectTarget}
                    onClose={() => setConnectTarget(null)}
                    onConnected={(conn) => {
                        if (conn.inbound_webhook_url) {
                            setInboundUrl({ provider: conn.provider, url: conn.inbound_webhook_url });
                        }
                    }}
                />
            )}
            {inboundUrl && (
                <InboundUrlDialog
                    provider={inboundUrl.provider}
                    url={inboundUrl.url}
                    onClose={() => setInboundUrl(null)}
                />
            )}
        </Page>
    );
}

function CatalogCard({
    entry,
    connections,
    onConnect,
    onDisconnect,
    onShowInbound,
}: {
    entry: IntegrationCatalogEntry;
    connections: IntegrationConnection[];
    onConnect: () => void;
    onDisconnect: (c: IntegrationConnection) => void;
    onShowInbound: (url: string) => void;
}) {
    const connected = connections.length > 0;
    const status = connected ? connections[0].status : "disconnected";
    return (
        <div className="bg-white p-5 flex flex-col min-h-[140px]">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-sky-50 ring-1 ring-sky-100 text-sky-700 inline-flex items-center justify-center text-[13px] font-semibold uppercase">
                        {entry.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900 truncate">{entry.name}</div>
                        <div className="text-[10.5px] uppercase tracking-[0.08em] text-slate-400 font-mono">
                            {entry.auth_method}
                            {entry.beta && (
                                <span className="ml-1.5 text-amber-600">· beta</span>
                            )}
                        </div>
                    </div>
                </div>
                <StatusPill status={status} />
            </div>

            <p className="mt-3 text-[12px] text-slate-600 leading-relaxed line-clamp-3">
                {entry.tagline}
            </p>

            <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                {entry.docs_url ? (
                    <a
                        href={entry.docs_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-slate-500 hover:text-sky-700 underline decoration-dotted underline-offset-2"
                    >
                        Docs
                    </a>
                ) : <span />}
                <div className="flex items-center gap-1.5">
                    {connected && connections[0].id ? (
                        <>
                            <button
                                type="button"
                                onClick={() => onDisconnect(connections[0])}
                                className="h-6 px-2 rounded text-[11px] text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            >
                                Disconnect
                            </button>
                            {connections[0].display_fields && Object.keys(connections[0].display_fields).length > 0 && (
                                <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                                    {(connections[0].display_fields as Record<string, string>)["domain"] ??
                                        (connections[0].display_fields as Record<string, string>)["sheet_title"] ??
                                        (connections[0].display_fields as Record<string, string>)["zone_name"] ?? ""}
                                </span>
                            )}
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={onConnect}
                            className="h-7 px-2.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[11.5px] font-medium inline-flex items-center gap-1 transition-colors"
                        >
                            <PlusIcon className="w-3 h-3" />
                            Connect
                        </button>
                    )}
                </div>
            </div>

            {connected && entry.webhook_hint && (
                <button
                    type="button"
                    onClick={() => {
                        // Re-emit the inbound URL dialog so the user can re-copy
                        // it later. The connect mutation only returns the URL
                        // at create time, so we synthesize it from the
                        // connection ID — backend won't replay the secret.
                        onShowInbound("/api/v1/integrations/inbound/" + entry.provider.replace("_", "-") + "/<your-secret>");
                    }}
                    className="mt-2 text-[10.5px] text-sky-700 hover:underline self-start inline-flex items-center gap-1"
                >
                    <CableIcon className="w-3 h-3" />
                    Webhook URL
                </button>
            )}
        </div>
    );
}

function StatusPill({ status }: { status: string }) {
    const tone =
        status === "connected"
            ? { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" }
            : status === "degraded"
              ? { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" }
              : status === "pending"
                ? { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" }
                : { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" };
    const label = status === "disconnected" ? "not connected" : status;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 h-5 px-1.5 rounded text-[9.5px] uppercase tracking-[0.08em] font-medium",
                tone.bg,
                tone.text,
            )}
        >
            <span className={cn("size-1.5 rounded-full", tone.dot)} />
            {label}
        </span>
    );
}

function SourceDot({ source }: { source: string }) {
    const colour = source === "calendly" ? "bg-rose-400" : "bg-indigo-400";
    return (
        <span className="inline-flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full", colour)} />
            <span className="text-[10px] uppercase tracking-[0.08em] text-slate-400 font-mono">
                {source === "calendly" ? "calendly" : "cal.com"}
            </span>
        </span>
    );
}

// Lint shim — keep icons that may only render in branches.
void CheckIcon;
void XIcon;
