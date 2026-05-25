// Activity tab — the contact 360 timeline.
//
// One vertical feed, newest first. Each row carries an icon for the
// event type, a single-line summary ("Sent / Opened / Replied"), and
// secondary context: mailbox sender, campaign + sequence step,
// subject. Filter chips up top let the user narrow to a single
// event class.
//
// The backend already merges sources (campaign_contact_progress,
// reply_intents, deliverability_events, suppressed_recipients, notes)
// so this view just renders.

import React from "react";
import {
    AlertOctagonIcon,
    BanIcon,
    Loader2Icon,
    MailIcon,
    MailOpenIcon,
    MailWarningIcon,
    MessageSquareIcon,
    MousePointerClickIcon,
    ReplyIcon,
    StickyNoteIcon,
} from "lucide-react";
import useContactTimeline from "@/lib/api/hooks/app/contacts/useContactTimeline";
import type ContactTimelineEvent from "@/lib/api/models/app/contacts/ContactTimelineEvent";
import type { ContactTimelineEventType } from "@/lib/api/models/app/contacts/ContactTimelineEvent";
import { fmtAbsolute, fmtRelative } from "./format";

type FilterId = "all" | "emails" | "replies" | "deliv" | "notes";

const FILTERS: { id: FilterId; label: string }[] = [
    { id: "all", label: "All" },
    { id: "emails", label: "Emails" },
    { id: "replies", label: "Replies" },
    { id: "deliv", label: "Deliverability" },
    { id: "notes", label: "Notes" },
];

const EMAIL_TYPES: ContactTimelineEventType[] = [
    "email_sent",
    "email_opened",
    "email_clicked",
    "email_bounced",
];

export default function ActivityTab({ contactId }: { contactId: string }) {
    const { data, isLoading, error } = useContactTimeline(contactId);
    const [filter, setFilter] = React.useState<FilterId>("all");

    const events = React.useMemo(() => {
        const all = data?.data ?? [];
        if (filter === "all") return all;
        return all.filter((e) => {
            switch (filter) {
                case "emails":
                    return EMAIL_TYPES.includes(e.type);
                case "replies":
                    return e.type === "email_replied" || e.type === "reply_received";
                case "deliv":
                    return e.type === "deliverability" || e.type === "suppressed";
                case "notes":
                    return e.type === "note";
                default:
                    return true;
            }
        });
    }, [data, filter]);

    return (
        <div className="space-y-4">
            <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
                {FILTERS.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className={`h-6 px-2 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
                            filter === f.id
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                    <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                </div>
            ) : error ? (
                <div className="rounded-md border border-red-200 bg-red-50/50 px-3 py-2.5 text-[11.5px] text-red-700">
                    Failed to load activity.
                </div>
            ) : events.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 px-3 py-8 text-[11.5px] text-slate-400 text-center">
                    No activity yet for this filter.
                </div>
            ) : (
                <ol className="relative pl-5">
                    {/* Vertical rail */}
                    <span className="absolute left-2 top-1 bottom-1 w-px bg-slate-200" />
                    {events.map((e, i) => (
                        <li key={`${e.type}-${e.at}-${i}`} className="relative pb-3 last:pb-0">
                            <EventDot type={e.type} />
                            <EventRow event={e} />
                        </li>
                    ))}
                </ol>
            )}
            {data?.has_more && (
                <div className="text-[10.5px] text-slate-400 text-center">
                    Showing latest {events.length} events. Older history is
                    paginated; ask the team if you need the full export.
                </div>
            )}
        </div>
    );
}

function EventDot({ type }: { type: ContactTimelineEventType }) {
    const { color } = visualFor(type);
    return (
        <span
            className={`absolute -left-3 top-1 size-2 rounded-full border-2 border-white ${color}`}
        />
    );
}

function EventRow({ event }: { event: ContactTimelineEvent }) {
    const { Icon, label } = visualFor(event.type);
    return (
        <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
            <div className="flex items-start gap-2">
                <Icon className="w-3.5 h-3.5 text-slate-500 mt-px shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-[12px] font-medium text-slate-900">
                            {label}
                        </span>
                        {event.subject && (
                            <span className="text-[11.5px] text-slate-600 truncate">
                                · {event.subject}
                            </span>
                        )}
                    </div>
                    <EventMeta event={event} />
                </div>
                <span
                    className="text-[10.5px] text-slate-400 tabular-nums shrink-0"
                    title={fmtAbsolute(event.at)}
                >
                    {fmtRelative(event.at)}
                </span>
            </div>
            {event.content && (
                <div className="text-[11.5px] text-slate-700 mt-1.5 whitespace-pre-wrap break-words">
                    {event.content}
                </div>
            )}
        </div>
    );
}

function EventMeta({ event }: { event: ContactTimelineEvent }) {
    const parts: React.ReactNode[] = [];

    if (event.email_account_email) {
        parts.push(
            <span key="mailbox" className="font-mono">
                from {event.email_account_email}
            </span>,
        );
    }
    if (event.campaign_name) {
        parts.push(<span key="campaign">in {event.campaign_name}</span>);
    }
    if (event.sequence_name) {
        parts.push(<span key="sequence">step {event.sequence_name}</span>);
    }
    if (event.intent) {
        parts.push(<span key="intent">intent: {event.intent}</span>);
    }
    if (event.provider && event.provider !== "manual") {
        parts.push(<span key="provider">via {event.provider}</span>);
    }
    if (event.source) {
        parts.push(<span key="source">type: {event.source}</span>);
    }
    if (event.reason) {
        parts.push(
            <span key="reason" className="text-slate-700">
                {event.reason}
            </span>,
        );
    }

    if (parts.length === 0) return null;

    return (
        <div className="text-[11px] text-slate-500 mt-0.5 flex gap-1.5 flex-wrap">
            {parts.map((p, i) => (
                <React.Fragment key={i}>
                    {p}
                    {i < parts.length - 1 && <span className="text-slate-300">·</span>}
                </React.Fragment>
            ))}
        </div>
    );
}

function visualFor(type: ContactTimelineEventType): {
    Icon: typeof MailIcon;
    label: string;
    color: string;
} {
    switch (type) {
        case "email_sent":
            return { Icon: MailIcon, label: "Email sent", color: "bg-slate-400" };
        case "email_opened":
            return { Icon: MailOpenIcon, label: "Opened", color: "bg-sky-500" };
        case "email_clicked":
            return {
                Icon: MousePointerClickIcon,
                label: "Clicked link",
                color: "bg-indigo-500",
            };
        case "email_replied":
            return { Icon: ReplyIcon, label: "Replied (auto-detected)", color: "bg-emerald-500" };
        case "reply_received":
            return { Icon: MessageSquareIcon, label: "Reply received", color: "bg-emerald-500" };
        case "email_bounced":
            return { Icon: MailWarningIcon, label: "Bounced", color: "bg-amber-500" };
        case "deliverability":
            return {
                Icon: AlertOctagonIcon,
                label: "Deliverability event",
                color: "bg-red-500",
            };
        case "suppressed":
            return { Icon: BanIcon, label: "Suppressed", color: "bg-red-600" };
        case "note":
            return { Icon: StickyNoteIcon, label: "Note added", color: "bg-yellow-500" };
        default:
            return { Icon: MailIcon, label: type, color: "bg-slate-400" };
    }
}
