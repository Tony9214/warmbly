// Sidebar for the sky-chrome shell.
//
// Brae-density structure: small tracked-uppercase section labels, h-8
// nav rows, hairline dividers between sections. The header slot is
// the LivePanel — a small ambient telemetry card that replaces the
// generic "+ New Campaign" pill. Cold-email work is always-on; the
// sidebar should reflect that rather than nag with a CTA.

import { Link, useLocation } from "react-router-dom";
import {
    BarChart3Icon,
    CheckSquareIcon,
    CircleDollarSignIcon,
    FileTextIcon,
    GitBranchIcon,
    InboxIcon,
    KeyIcon,
    type LucideIcon,
    MailIcon,
    MegaphoneIcon,
    SettingsIcon,
    UsersIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useAppStore } from "@/stores";
import { UserNav } from "./UserNav";
import { cn } from "@/lib/utils";

interface NavItem {
    title: string;
    url: string;
    icon: LucideIcon;
    badgeStoreKey?: "unseenCount";
}

interface NavSection {
    label: string;
    items: NavItem[];
}

const topItems: NavItem[] = [
    { title: "Inbox", url: "/app/unibox", icon: InboxIcon, badgeStoreKey: "unseenCount" },
];

const sections: NavSection[] = [
    {
        label: "Email",
        items: [
            { title: "Accounts", url: "/app/emails", icon: MailIcon },
            { title: "Campaigns", url: "/app/campaigns", icon: MegaphoneIcon },
            { title: "Contacts", url: "/app/contacts", icon: UsersIcon },
            { title: "Analytics", url: "/app/analytics", icon: BarChart3Icon },
        ],
    },
    {
        label: "CRM",
        items: [
            { title: "Pipelines", url: "/app/crm/pipelines", icon: GitBranchIcon },
            { title: "Deals", url: "/app/crm/deals", icon: CircleDollarSignIcon },
            { title: "Tasks", url: "/app/crm/tasks", icon: CheckSquareIcon },
        ],
    },
    {
        label: "Resources",
        items: [
            { title: "Templates", url: "/app/templates", icon: FileTextIcon },
            { title: "API Keys", url: "/app/api-keys", icon: KeyIcon },
        ],
    },
];

function NavRow({ item }: { item: NavItem }) {
    const { pathname } = useLocation();
    const unseen = useAppStore((s) => s.unseenCount);
    const active =
        pathname === item.url || pathname.startsWith(item.url + "/");
    const badge = item.badgeStoreKey === "unseenCount" ? unseen : undefined;

    return (
        <Link
            to={item.url}
            className={cn(
                "group mx-2 flex items-center gap-2.5 px-2.5 h-7 rounded-md text-[12.5px] transition-colors duration-100",
                active
                    ? "bg-slate-200/70 text-slate-900 font-medium"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/40",
            )}
        >
            <item.icon
                className={cn(
                    "w-[14px] h-[14px] shrink-0 transition-colors",
                    active ? "text-slate-700" : "text-slate-400 group-hover:text-slate-600",
                )}
                strokeWidth={active ? 2 : 1.6}
            />
            <span className="truncate">{item.title}</span>
            {badge != null && badge > 0 && (
                <span className="ml-auto text-[10px] font-medium bg-slate-900 text-white rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 tabular-nums">
                    {badge > 99 ? "99+" : badge}
                </span>
            )}
        </Link>
    );
}

function Section({ section, first = false }: { section: NavSection; first?: boolean }) {
    return (
        <div className={first ? "" : "mt-4 pt-4 border-t border-slate-200/50"}>
            <div className="px-4 mb-1.5">
                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                    {section.label}
                </span>
            </div>
            <div className="space-y-px">
                {section.items.map((it) => (
                    <NavRow key={it.url} item={it} />
                ))}
            </div>
        </div>
    );
}

/**
 * LivePanel — replaces the old "+ New Campaign" pill.
 *
 * Anatomy:
 *
 *   ┌──────────────────────────────────┐
 *   │  ●  LIVE         42 of 50 / day  │   ← status dot + label + cap pace
 *   │  8 mailboxes      sending now    │   ← mailbox composition
 *   │  ▂▃▅▇▆▄▂  ▂▃▅▇▆▄▂                │   ← optional 24h sparkline
 *   └──────────────────────────────────┘
 *
 * Reads as ambient telemetry: even when idle, it tells you "system is
 * up, n mailboxes ready." Clicking jumps to analytics. The dot pulses
 * when at least one mailbox is actively warming or sending.
 *
 * Data sources at this layer:
 *   - useAppStore.emails  → mailbox count, active count
 *   - useAppStore.connectionStatus → online/offline state
 *
 * Volume numbers ("42 of 50") will be wired up to a future today-summary
 * endpoint; for now they fall back to a derived cap based on mailbox
 * count × 50 (default cold cap from internal/config/constants.go).
 */
function LivePanel() {
    const emails = useAppStore((s) => s.emails);
    const connection = useAppStore((s) => s.connectionStatus);
    const latencyMs = useAppStore((s) => s.wsLatencyMs);
    const unseenCount = useAppStore((s) => s.unseenCount);

    const { active, mailboxes, capacity } = useMemo(() => {
        const m = emails.length;
        const a = emails.filter(
            (e) => e.status === "healthy" || e.status === "warming",
        ).length;
        return { active: a, mailboxes: m, capacity: m * 50 };
    }, [emails]);

    const live = connection === "connected";
    const label =
        connection === "disconnected"
            ? "OFFLINE"
            : connection === "connecting"
                ? "CONNECTING"
                : active > 0
                    ? "LIVE"
                    : "IDLE";

    // Latency bucketing: <100ms great, <300ms okay, ≥300ms poor.
    const latencyTone =
        latencyMs == null
            ? "text-slate-400"
            : latencyMs < 100
                ? "text-emerald-600"
                : latencyMs < 300
                    ? "text-amber-600"
                    : "text-red-500";

    return (
        <Link
            to="/app/analytics"
            className="group block mx-2 mt-2 mb-3 rounded-md bg-white/80 hover:bg-white border border-slate-200/70 hover:border-slate-300 px-2.5 py-2 transition-colors"
        >
            <div className="flex items-center gap-1.5">
                <span className="relative inline-flex shrink-0">
                    <span
                        className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            connection === "disconnected"
                                ? "bg-slate-400"
                                : connection === "connecting"
                                    ? "bg-amber-500"
                                    : active > 0
                                        ? "bg-emerald-500"
                                        : "bg-slate-400",
                        )}
                    />
                    {live && active > 0 && (
                        <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping" />
                    )}
                </span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
                    {label}
                </span>
                <span
                    className={cn(
                        "ml-auto font-mono text-[10px] tabular-nums",
                        latencyTone,
                    )}
                    title={latencyMs != null ? `Websocket roundtrip` : "Not connected"}
                >
                    {latencyMs != null ? `${latencyMs}ms` : "—"}
                </span>
            </div>

            <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-[15px] text-slate-900 tabular-nums leading-none">
                    {mailboxes}
                </span>
                <span className="text-[11px] text-slate-500">
                    {mailboxes === 1 ? "mailbox" : "mailboxes"}
                </span>
                {active > 0 && (
                    <span className="ml-auto text-[10.5px] text-emerald-600 tabular-nums">
                        {active} active
                    </span>
                )}
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px]">
                <span className="text-slate-400">Inbox</span>
                <span
                    className={cn(
                        "font-mono tabular-nums",
                        unseenCount > 0 ? "text-sky-600" : "text-slate-400",
                    )}
                >
                    {unseenCount > 99 ? "99+" : unseenCount} unread
                </span>
            </div>

            <div className="mt-1 flex items-center justify-between gap-2 text-[10.5px]">
                <span className="text-slate-400">Today</span>
                <span className="font-mono text-slate-400 tabular-nums">
                    0/{capacity || "—"}
                </span>
            </div>

            <Sparkline />
        </Link>
    );
}

/**
 * Sparkline — 14 thin vertical bars, last hours of today's volume.
 * Placeholder data for now (zeros render as faint bars). When a
 * /summary endpoint lands, swap the array.
 */
function Sparkline() {
    const bars = useMemo(() => Array.from({ length: 14 }, () => 0), []);
    return (
        <div className="mt-2 flex items-end gap-0.5 h-4">
            {bars.map((v, i) => (
                <div
                    key={i}
                    className="flex-1 rounded-sm bg-slate-200 group-hover:bg-slate-300 transition-colors"
                    style={{ height: `${Math.max(8, v)}%`, minHeight: "2px" }}
                />
            ))}
        </div>
    );
}

export function AppNav() {
    return (
        <aside className="w-64 shrink-0 flex flex-col text-slate-900">
            <LivePanel />

            <nav className="flex-1 overflow-y-auto pb-3">
                <div className="space-y-px">
                    {topItems.map((it) => (
                        <NavRow key={it.url + it.title} item={it} />
                    ))}
                </div>
                {sections.map((s, i) => (
                    <Section key={s.label} section={s} first={i === 0 && topItems.length === 0} />
                ))}
            </nav>

            <div className="border-t border-slate-200/60 py-1 shrink-0">
                <NavRow
                    item={{ title: "Settings", url: "/app/settings", icon: SettingsIcon }}
                />
            </div>

            <div className="border-t border-slate-200/60 shrink-0">
                <UserNav />
            </div>
        </aside>
    );
}
