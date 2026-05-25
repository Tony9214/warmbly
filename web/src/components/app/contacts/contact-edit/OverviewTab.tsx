// Overview tab — at-a-glance contact 360.
//
// Density rules match the rest of the slide-over: 32rem wide, slate
// palette, 12px body text. We render five stat tiles for the
// engagement breakdown, a suppression banner when present, and a
// compact "last touch" timeline strip.
//
// Data sources:
//   - ContactDetail (engagement counts + suppression)
//   - Contact (categories, campaigns, custom fields summary)

import {
    AlertOctagonIcon,
    BanIcon,
    MailIcon,
    MailOpenIcon,
    MailQuestionIcon,
    MailWarningIcon,
    MousePointerClickIcon,
    ReplyIcon,
} from "lucide-react";
import type ContactDetail from "@/lib/api/models/app/contacts/ContactDetail";
import type Contact from "@/lib/api/models/app/contacts/Contact";
import { fmtAbsolute, fmtRelative } from "./format";

export default function OverviewTab({
    contact,
    detail,
    detailLoading,
}: {
    contact: Contact;
    detail?: ContactDetail;
    detailLoading: boolean;
}) {
    const eng = detail?.engagement;
    const supp = detail?.suppression;

    return (
        <div className="space-y-6">
            {supp && (
                <div className="rounded-md border border-red-200 bg-red-50/50 px-3 py-2.5 flex items-start gap-2">
                    <BanIcon className="w-3.5 h-3.5 text-red-600 mt-px shrink-0" />
                    <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-red-900 leading-tight">
                            Suppressed ({supp.source})
                        </div>
                        <div className="text-[11px] text-red-700/90 mt-0.5">
                            {supp.reason || "No reason given"} · since{" "}
                            {fmtAbsolute(supp.created_at)}
                        </div>
                    </div>
                </div>
            )}

            <Section title="Engagement">
                <div className="grid grid-cols-3 gap-1.5">
                    <StatTile
                        icon={<MailIcon className="w-3 h-3" />}
                        label="Sent"
                        value={eng?.total_sent ?? 0}
                        loading={detailLoading}
                    />
                    <StatTile
                        icon={<MailOpenIcon className="w-3 h-3" />}
                        label="Opened"
                        value={eng?.total_opened ?? 0}
                        loading={detailLoading}
                        ratioOf={eng?.total_sent}
                    />
                    <StatTile
                        icon={<MousePointerClickIcon className="w-3 h-3" />}
                        label="Clicked"
                        value={eng?.total_clicked ?? 0}
                        loading={detailLoading}
                        ratioOf={eng?.total_sent}
                    />
                    <StatTile
                        icon={<ReplyIcon className="w-3 h-3" />}
                        label="Replied"
                        value={eng?.total_replied ?? 0}
                        loading={detailLoading}
                        accent={
                            eng && eng.total_replied > 0 ? "positive" : undefined
                        }
                    />
                    <StatTile
                        icon={<MailWarningIcon className="w-3 h-3" />}
                        label="Bounced"
                        value={eng?.total_bounced ?? 0}
                        loading={detailLoading}
                        accent={
                            eng && eng.total_bounced > 0 ? "negative" : undefined
                        }
                    />
                    <StatTile
                        icon={<AlertOctagonIcon className="w-3 h-3" />}
                        label="Complained"
                        value={eng?.total_complained ?? 0}
                        loading={detailLoading}
                        accent={
                            eng && eng.total_complained > 0
                                ? "negative"
                                : undefined
                        }
                    />
                </div>
            </Section>

            <Section title="Latest activity">
                <div className="rounded-md border border-slate-200 bg-white divide-y divide-slate-100">
                    <LatestRow
                        label="Last sent"
                        ts={eng?.last_sent_at}
                        icon={<MailIcon className="w-3 h-3 text-slate-400" />}
                    />
                    <LatestRow
                        label="Last opened"
                        ts={eng?.last_opened_at}
                        icon={<MailOpenIcon className="w-3 h-3 text-slate-400" />}
                    />
                    <LatestRow
                        label="Last clicked"
                        ts={eng?.last_clicked_at}
                        icon={
                            <MousePointerClickIcon className="w-3 h-3 text-slate-400" />
                        }
                    />
                    <LatestRow
                        label="Last replied"
                        ts={eng?.last_replied_at}
                        icon={<ReplyIcon className="w-3 h-3 text-slate-400" />}
                    />
                    <LatestRow
                        label="Last bounced"
                        ts={eng?.last_bounced_at}
                        icon={
                            <MailWarningIcon className="w-3 h-3 text-slate-400" />
                        }
                    />
                </div>
            </Section>

            <Section title="Profile">
                <div className="rounded-md border border-slate-200 bg-white">
                    <ProfileRow label="Email" value={contact.email} mono />
                    <ProfileRow
                        label="Company"
                        value={contact.company || "—"}
                    />
                    <ProfileRow label="Phone" value={contact.phone || "—"} />
                    <ProfileRow
                        label="Subscribed"
                        value={contact.subscribed ? "Yes" : "No"}
                        accent={contact.subscribed ? undefined : "negative"}
                    />
                    <ProfileRow
                        label="Categories"
                        value={
                            contact.categories.length > 0 ? (
                                <span className="flex flex-wrap gap-1 justify-end">
                                    {contact.categories.map((c) => (
                                        <span
                                            key={c.id}
                                            className="inline-flex h-4 items-center px-1.5 rounded text-[10.5px] font-medium"
                                            style={{
                                                backgroundColor: `${c.color}1a`,
                                                color: c.color,
                                            }}
                                        >
                                            {c.title}
                                        </span>
                                    ))}
                                </span>
                            ) : (
                                "None"
                            )
                        }
                    />
                    <ProfileRow
                        label="Campaigns"
                        value={
                            contact.campaigns.length > 0
                                ? `${contact.campaigns.length} active`
                                : "None"
                        }
                    />
                </div>
            </Section>

            {Object.keys(contact.custom_fields || {}).length > 0 && (
                <Section title="Custom fields">
                    <div className="rounded-md border border-slate-200 bg-white">
                        {Object.entries(contact.custom_fields).map(
                            ([k, v]) => (
                                <ProfileRow key={k} label={k} value={v} mono />
                            ),
                        )}
                    </div>
                </Section>
            )}
        </div>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section>
            <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">
                    {title}
                </h2>
                <div className="flex-1 h-px bg-slate-200" />
            </div>
            {children}
        </section>
    );
}

function StatTile({
    icon,
    label,
    value,
    loading,
    ratioOf,
    accent,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    loading: boolean;
    ratioOf?: number;
    accent?: "positive" | "negative";
}) {
    const pct =
        ratioOf && ratioOf > 0
            ? Math.round((value / ratioOf) * 100)
            : null;

    const accentClasses =
        accent === "positive"
            ? "text-emerald-700 bg-emerald-50/60 border-emerald-100"
            : accent === "negative"
              ? "text-red-700 bg-red-50/60 border-red-100"
              : "text-slate-900 bg-white border-slate-200";

    return (
        <div className={`rounded-md border px-2.5 py-2 ${accentClasses}`}>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-medium flex items-center gap-1">
                {icon}
                {label}
            </div>
            <div className="text-[16px] font-semibold tabular-nums mt-0.5 leading-tight">
                {loading ? (
                    <span className="inline-block w-6 h-3 rounded bg-slate-100 animate-pulse align-middle" />
                ) : (
                    value.toLocaleString()
                )}
            </div>
            {pct !== null && (
                <div className="text-[10px] text-slate-400 tabular-nums mt-0.5">
                    {pct}% of sent
                </div>
            )}
        </div>
    );
}

function LatestRow({
    label,
    ts,
    icon,
}: {
    label: string;
    ts?: string | null;
    icon: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5">
            {icon}
            <div className="text-[11.5px] text-slate-700 flex-1">{label}</div>
            <div className="text-[11.5px] text-slate-500 tabular-nums">
                {ts ? fmtRelative(ts) : "never"}
            </div>
        </div>
    );
}

function ProfileRow({
    label,
    value,
    mono,
    accent,
}: {
    label: string;
    value: React.ReactNode;
    mono?: boolean;
    accent?: "negative";
}) {
    return (
        <div className="flex items-start gap-2 px-3 py-1.5 border-b last:border-b-0 border-slate-100">
            <div className="text-[11px] text-slate-500 w-24 shrink-0">{label}</div>
            <div
                className={`text-[12px] flex-1 text-right break-words ${
                    accent === "negative" ? "text-red-700" : "text-slate-900"
                } ${mono ? "font-mono" : ""}`}
            >
                {value}
            </div>
        </div>
    );
}
