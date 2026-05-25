// Activity tab — the contact 360 timeline.
//
// Flat monochrome list, newest first. Each row shows an icon for the
// event type, a one-line summary, structured meta below, and an
// optional body (note text, reply snippet, bounce reason). A
// segmented filter strip up top narrows by event class.

import React from "react";
import { motion } from "framer-motion";
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
        <div className="space-y-3">
            <div className="inline-flex bg-slate-100 rounded-md p-0.5">
                {FILTERS.map((f) => {
                    const isActive = filter === f.id;
                    return (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setFilter(f.id)}
                            className="relative h-6 px-2.5 rounded text-[11px] font-medium outline-none whitespace-nowrap"
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="contact-activity-filter"
                                    className="absolute inset-0 rounded bg-white shadow-sm"
                                    transition={{
                                        type: "spring",
                                        duration: 0.3,
                                        bounce: 0.15,
                                    }}
                                />
                            )}
                            <span
                                className={`relative z-10 transition-colors ${
                                    isActive
                                        ? "text-slate-900"
                                        : "text-slate-500 hover:text-slate-800"
                                }`}
                            >
                                {f.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                    <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                </div>
            ) : error ? (
                <div className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2.5 text-[11.5px] text-red-700">
                    Failed to load activity.
                </div>
            ) : events.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 px-3 py-10 text-[11.5px] text-slate-400 text-center">
                    No activity yet for this filter.
                </div>
            ) : (
                <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
                    {events.map((e, i) => (
                        <EventRow key={`${e.type}-${e.at}-${i}`} event={e} />
                    ))}
                </div>
            )}
            {data?.has_more && (
                <div className="text-[10.5px] text-slate-400 text-center pt-1">
                    Showing latest {events.length} events.
                </div>
            )}
        </div>
    );
}

function EventRow({ event }: { event: ContactTimelineEvent }) {
    const { Icon, label } = visualFor(event.type);
    return (
        <div className="px-3 py-2 border-b last:border-b-0 border-slate-100">
            <div className="flex items-start gap-2.5">
                <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-[12px] font-medium text-slate-900 shrink-0">
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
                    className="text-[10.5px] text-slate-400 tabular-nums shrink-0 mt-0.5"
                    title={fmtAbsolute(event.at)}
                >
                    {fmtRelative(event.at)}
                </span>
            </div>
            {event.content && (
                <div className="text-[11.5px] text-slate-700 mt-1.5 ml-6 whitespace-pre-wrap break-words border-l-2 border-slate-100 pl-2">
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
                    {i < parts.length - 1 && (
                        <span className="text-slate-300">·</span>
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}

function visualFor(type: ContactTimelineEventType): {
    Icon: typeof MailIcon;
    label: string;
} {
    switch (type) {
        case "email_sent":
            return { Icon: MailIcon, label: "Email sent" };
        case "email_opened":
            return { Icon: MailOpenIcon, label: "Opened" };
        case "email_clicked":
            return { Icon: MousePointerClickIcon, label: "Clicked link" };
        case "email_replied":
            return { Icon: ReplyIcon, label: "Replied" };
        case "reply_received":
            return { Icon: MessageSquareIcon, label: "Reply received" };
        case "email_bounced":
            return { Icon: MailWarningIcon, label: "Bounced" };
        case "deliverability":
            return { Icon: AlertOctagonIcon, label: "Deliverability event" };
        case "suppressed":
            return { Icon: BanIcon, label: "Suppressed" };
        case "note":
            return { Icon: StickyNoteIcon, label: "Note added" };
        default:
            return { Icon: MailIcon, label: type };
    }
}
