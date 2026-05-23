// Settings — full-width two-pane sheet.
//
//   ┌────────────┬─────────────────────────────────────────────────────┐
//   │ rail (220) │ section panel (fills the rest of the page)          │
//   └────────────┴─────────────────────────────────────────────────────┘
//
// Each section is its own component below. Sections use the full
// content width — no max-w-xl cap — so dense bits (members table,
// workspace fields, notification grid) actually breathe.
//
// Section in URL hash so /app/settings#members deep-links.

import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    AlertOctagonIcon,
    BellIcon,
    BriefcaseIcon,
    Loader2Icon,
    MailIcon,
    ShieldIcon,
    TrashIcon,
    UserIcon,
    UsersIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { Page, PageTopbar, TopbarAction } from "@/components/layout/Page";
import { Label, TextInput } from "@/components/ui/field";
import { useUserProfile } from "@/hooks/context/user";
import { useAppStore } from "@/stores";
import { useConfirm } from "@/hooks/context/confirm";
import { comingSoon } from "@/lib/helper/comingSoon";
import useMembers from "@/lib/api/hooks/app/organizations/useMembers";
import usePendingInvitations from "@/lib/api/hooks/app/organizations/usePendingInvitations";
import useInviteMember from "@/lib/api/hooks/app/organizations/useInviteMember";
import useRemoveMember from "@/lib/api/hooks/app/organizations/useRemoveMember";
import useCancelInvitation from "@/lib/api/hooks/app/organizations/useCancelInvitation";
import useFeatureAccess from "@/hooks/useFeatureAccess";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";

type SectionId =
    | "profile"
    | "notifications"
    | "security"
    | "members"
    | "workspace"
    | "danger";

interface SectionDef {
    id: SectionId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    ownerOnly?: boolean;
}

const SECTIONS: SectionDef[] = [
    { id: "profile",       label: "Profile",       icon: UserIcon,         description: "Personal information." },
    { id: "notifications", label: "Notifications", icon: BellIcon,         description: "What you get notified about." },
    { id: "security",      label: "Security",      icon: ShieldIcon,       description: "Password, 2FA, active sessions." },
    { id: "members",       label: "Members",       icon: UsersIcon,        description: "Team and invitations." },
    { id: "workspace",     label: "Workspace",     icon: BriefcaseIcon,    description: "Org-wide settings.", ownerOnly: true },
    { id: "danger",        label: "Danger zone",   icon: AlertOctagonIcon, description: "Irreversible actions." },
];

// Defensive helpers for raw-data quirks. The backend has shipped rows
// without an `email` populated in the past; the UI shouldn't crash on
// that and shouldn't surface "" silently either.
function safeEmail(s: string | undefined | null): string {
    return (s ?? "").trim();
}
function initials(email: string | undefined | null, fallback = "?") {
    const e = safeEmail(email);
    if (!e) return fallback.slice(0, 2).toUpperCase();
    return e.slice(0, 2).toUpperCase();
}

export default function SettingsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const access = useFeatureAccess();

    const sectionFromHash = (location.hash.replace("#", "") || "profile") as SectionId;
    const activeSection: SectionId =
        SECTIONS.some((s) => s.id === sectionFromHash) ? sectionFromHash : "profile";

    const visibleSections = SECTIONS.filter((s) => !s.ownerOnly || access.isOwner);
    const current = visibleSections.find((s) => s.id === activeSection) ?? visibleSections[0];

    return (
        <Page>
            <PageTopbar
                eyebrow="Settings"
                subtitle={current?.description ?? "Account and workspace"}
            />

            <div className="flex-1 min-h-0 flex">
                {/* Left rail */}
                <nav className="w-[220px] shrink-0 border-r border-slate-200/70 py-2 overflow-y-auto">
                    {visibleSections.map((s) => {
                        const active = current?.id === s.id;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => navigate(`#${s.id}`, { replace: true })}
                                className={`group block w-[calc(100%-0.75rem)] mx-1.5 my-px flex items-center gap-2 px-2 h-7 rounded text-[12.5px] text-left transition-colors ${
                                    active
                                        ? "bg-slate-200/70 text-slate-900 font-medium"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/40"
                                }`}
                            >
                                <s.icon
                                    className={`w-[14px] h-[14px] shrink-0 ${
                                        active ? "text-slate-700" : "text-slate-400 group-hover:text-slate-600"
                                    }`}
                                />
                                <span className="truncate">{s.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Right panel — full width within the content column. */}
                <div className="flex-1 min-w-0 overflow-y-auto">
                    {current?.id === "profile" && <ProfileSection />}
                    {current?.id === "notifications" && <NotificationsSection />}
                    {current?.id === "security" && <SecuritySection />}
                    {current?.id === "members" && <MembersSection />}
                    {current?.id === "workspace" && <WorkspaceSection />}
                    {current?.id === "danger" && <DangerSection />}
                </div>
            </div>
        </Page>
    );
}

// ─── Layout primitives used by every section ─────────────────────────

function SectionShell({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="px-8 py-7">
            <div className="mb-6">
                <h2 className="text-[16px] font-semibold text-slate-900 tracking-tight">
                    {title}
                </h2>
                {description && (
                    <p className="text-[12.5px] text-slate-500 mt-0.5 leading-relaxed">
                        {description}
                    </p>
                )}
            </div>
            {children}
        </div>
    );
}

function Card({
    title,
    description,
    children,
    footer,
}: {
    title?: string;
    description?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (
        <div className="rounded-md border border-slate-200 bg-white overflow-hidden mb-4">
            {(title || description) && (
                <div className="px-4 py-3 border-b border-slate-200">
                    {title && (
                        <div className="text-[12.5px] font-semibold text-slate-900">
                            {title}
                        </div>
                    )}
                    {description && (
                        <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>
            )}
            <div className="px-4 py-4">{children}</div>
            {footer && (
                <div className="px-3 h-12 border-t border-slate-200 bg-slate-50/40 flex items-center gap-1.5">
                    {footer}
                </div>
            )}
        </div>
    );
}

// ─── Sections ────────────────────────────────────────────────────────

function ProfileSection() {
    const { user } = useUserProfile();
    const [firstName, setFirstName] = React.useState(user.first_name ?? "");
    const [lastName, setLastName] = React.useState(user.last_name ?? "");
    const dirty = firstName !== (user.first_name ?? "") || lastName !== (user.last_name ?? "");

    return (
        <SectionShell
            title="Profile"
            description="Used across invitations, emails sent on your behalf, and your sidebar avatar."
        >
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
                <Card
                    footer={
                        <button
                            type="button"
                            onClick={() => comingSoon("Profile editing")}
                            disabled={!dirty}
                            className="ml-auto h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium transition-colors disabled:opacity-50"
                        >
                            Save profile
                        </button>
                    }
                >
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label>First name</Label>
                                <TextInput value={firstName} onChange={setFirstName} className="w-full" />
                            </div>
                            <div>
                                <Label>Last name</Label>
                                <TextInput value={lastName} onChange={setLastName} className="w-full" />
                            </div>
                        </div>
                        <div>
                            <Label>Email</Label>
                            <input
                                type="email"
                                value={user.email}
                                disabled
                                className="w-full h-7 px-2.5 rounded-md border border-slate-200 bg-slate-50 text-[12.5px] text-slate-500"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                                Email changes go through support for now.
                            </p>
                        </div>
                    </div>
                </Card>

                <div>
                    <div className="rounded-md border border-slate-200 bg-white p-4 flex items-center gap-3">
                        <div className="size-12 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                            <span className="text-[15px] font-semibold">
                                {initials(user.email)}
                            </span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-medium text-slate-900 truncate">
                                {(firstName || lastName) ? `${firstName} ${lastName}`.trim() : user.email}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate font-mono">
                                {user.email}
                            </div>
                        </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                        Avatar uploads coming soon — for now we generate one from your initials.
                    </p>
                </div>
            </div>
        </SectionShell>
    );
}

const NOTIFICATION_GROUPS: Array<{
    title: string;
    description: string;
    items: Array<{ label: string; hint: string; defaultOn?: boolean }>;
}> = [
    {
        title: "Inbound activity",
        description: "Get notified when something happens on a campaign you're running.",
        items: [
            { label: "Reply received", hint: "A recipient replied to a cold email." },
            { label: "Out-of-office detected", hint: "An auto-responder hit one of your sends." },
            { label: "Click on tracked link", hint: "Useful for high-intent campaigns. Off by default to reduce noise." },
        ],
    },
    {
        title: "Health",
        description: "Deliverability and infrastructure alerts. Recommend leaving these on.",
        items: [
            { label: "Bounce detected", hint: "A mailbox starts bouncing hard." },
            { label: "Spam complaint", hint: "Immediate alert on any complaint event.", defaultOn: true },
            { label: "Worker downtime", hint: "One of your sender workers stops responding.", defaultOn: true },
        ],
    },
    {
        title: "Reports",
        description: "Scheduled rollups so you don't have to pull them yourself.",
        items: [
            { label: "Weekly digest", hint: "Monday summary of last week's volume and replies.", defaultOn: true },
            { label: "Monthly billing summary", hint: "Sent on the 1st of every month." },
        ],
    },
];

function NotificationsSection() {
    return (
        <SectionShell
            title="Notifications"
            description="Email + in-app alerts. Toggle by category — defaults reflect the recommendation."
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {NOTIFICATION_GROUPS.map((g) => (
                    <Card key={g.title} title={g.title} description={g.description}>
                        <div className="space-y-1">
                            {g.items.map((it) => (
                                <ToggleRow
                                    key={it.label}
                                    label={it.label}
                                    description={it.hint}
                                    defaultOn={it.defaultOn}
                                />
                            ))}
                        </div>
                    </Card>
                ))}
            </div>
        </SectionShell>
    );
}

function SecuritySection() {
    return (
        <SectionShell title="Security" description="Sign-in protection for your account.">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Authentication">
                    <RowLink
                        title="Two-factor authentication"
                        description="Add a one-time code to every sign-in."
                        cta="Enable 2FA"
                        statusLabel="Off"
                        statusTone="muted"
                    />
                    <RowLink
                        title="Change password"
                        description="Use 12+ characters with mixed case and a number."
                        cta="Change"
                    />
                </Card>

                <Card title="Sessions">
                    <RowLink
                        title="Active sessions"
                        description="Devices currently signed in to your account."
                        cta="View sessions"
                    />
                    <RowLink
                        title="Sign out everywhere"
                        description="Revoke every session except this one."
                        cta="Sign out"
                    />
                </Card>

                <Card title="Authorized apps">
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                        Third-party apps connected via OAuth show up here. No apps connected yet.
                    </p>
                </Card>

                <Card title="Email security">
                    <RowLink
                        title="DKIM, SPF, DMARC"
                        description="Authenticate sending domains for deliverability."
                        cta="Open mailboxes"
                    />
                </Card>
            </div>
        </SectionShell>
    );
}

function MembersSection() {
    const confirm = useConfirm();
    const access = useFeatureAccess();
    const members = useMembers();
    const invites = usePendingInvitations();
    const invite = useInviteMember();
    const removeMember = useRemoveMember();
    const cancelInvite = useCancelInvitation();

    const memberList = members.data ?? [];
    const inviteList = invites.data ?? [];

    const [email, setEmail] = React.useState("");
    const [role, setRole] = React.useState<"admin" | "member">("member");

    async function submit() {
        const e = safeEmail(email);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
            toast.error("Enter a valid email");
            return;
        }
        try {
            await toast.promise(invite.mutateAsync({ email: e, role }), {
                loading: "Sending invite…",
                success: "Invitation sent",
                error: (err: AppError) => buildError(err),
            });
            setEmail("");
        } catch {
            /* surfaced */
        }
    }

    function doRemove(id: string, label: string) {
        confirm?.show(`Remove ${label}?`, async () => {
            try {
                await toast.promise(removeMember.mutateAsync(id), {
                    loading: "Removing…",
                    success: "Member removed",
                    error: (e: AppError) => buildError(e),
                });
            } catch {
                /* surfaced */
            }
        });
    }
    function doCancelInvite(id: string) {
        confirm?.show(`Cancel this invitation?`, async () => {
            try {
                await toast.promise(cancelInvite.mutateAsync(id), {
                    loading: "Cancelling…",
                    success: "Invitation cancelled",
                    error: (e: AppError) => buildError(e),
                });
            } catch {
                /* surfaced */
            }
        });
    }

    return (
        <SectionShell
            title="Members"
            description="Everyone with access to this workspace. Owners can invite and change roles."
        >
            {access.isOwner && (
                <Card title="Invite teammates" description="Send a one-click join link to their email.">
                    <div className="flex items-center gap-2">
                        <TextInput
                            value={email}
                            onChange={setEmail}
                            placeholder="teammate@company.com"
                            type="email"
                            className="flex-1"
                        />
                        <div className="inline-flex items-center rounded-md border border-slate-200 bg-white p-0.5 shrink-0">
                            {(["admin", "member"] as const).map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r)}
                                    className={`h-6 px-2.5 rounded text-[11.5px] font-medium transition-colors capitalize ${
                                        role === r
                                            ? "bg-slate-900 text-white"
                                            : "text-slate-500 hover:text-slate-900"
                                    }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={submit}
                            disabled={invite.isPending}
                            className="h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60 shrink-0"
                        >
                            {invite.isPending && <Loader2Icon className="w-3 h-3 animate-spin" />}
                            Invite
                        </button>
                    </div>
                </Card>
            )}

            <Card
                title="Members"
                description={`${memberList.length} ${memberList.length === 1 ? "member" : "members"} in this workspace.`}
            >
                {members.isPending ? (
                    <p className="text-[11.5px] text-slate-400 py-2">Loading…</p>
                ) : memberList.length === 0 ? (
                    <p className="text-[11.5px] text-slate-400 py-2">No members yet.</p>
                ) : (
                    <div className="-mx-4 -my-4">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <Th>Member</Th>
                                    <Th className="w-32">Role</Th>
                                    <Th className="w-40">Joined</Th>
                                    <th className="w-12 px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {memberList.map((m) => {
                                    const e = safeEmail(m.email) || `(user ${m.user_id.slice(0, 8)})`;
                                    return (
                                        <tr key={m.user_id} className="group h-11 border-b border-slate-200/60 last:border-0 hover:bg-slate-50/80 transition-colors">
                                            <td className="px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="size-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                                        <span className="text-[10px] font-semibold text-slate-600">
                                                            {initials(m.email, m.user_id)}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-[12.5px] text-slate-900 truncate leading-tight">
                                                            {e}
                                                        </div>
                                                        <div className="text-[10.5px] text-slate-400 truncate font-mono leading-tight">
                                                            {m.user_id.slice(0, 8)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3">
                                                <RolePill role={m.role} />
                                            </td>
                                            <td className="px-3 font-mono text-[11px] text-slate-500 tabular-nums">
                                                {m.joined_at
                                                    ? new Date(m.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                                    : "—"}
                                            </td>
                                            <td className="px-3">
                                                {access.isOwner && m.role !== "owner" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => doRemove(m.user_id, e)}
                                                        aria-label="Remove member"
                                                        className="size-6 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <TrashIcon className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Card
                title="Pending invitations"
                description={`${inviteList.length} awaiting acceptance.`}
            >
                {invites.isPending ? (
                    <p className="text-[11.5px] text-slate-400 py-2">Loading…</p>
                ) : inviteList.length === 0 ? (
                    <p className="text-[11.5px] text-slate-400 py-2">None.</p>
                ) : (
                    <div className="-mx-4 -my-4">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <Th>Email</Th>
                                    <Th className="w-32">Role</Th>
                                    <Th className="w-40">Expires</Th>
                                    <th className="w-12 px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {inviteList.map((inv) => (
                                    <tr key={inv.id} className="group h-11 border-b border-slate-200/60 last:border-0 hover:bg-slate-50/80 transition-colors">
                                        <td className="px-4">
                                            <div className="flex items-center gap-2.5">
                                                <MailIcon className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-[12.5px] text-slate-900 truncate">
                                                    {inv.email}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3">
                                            <RolePill role={inv.role} />
                                        </td>
                                        <td className="px-3 font-mono text-[11px] text-slate-500 tabular-nums">
                                            {new Date(inv.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                        </td>
                                        <td className="px-3">
                                            {access.isOwner && (
                                                <button
                                                    type="button"
                                                    onClick={() => doCancelInvite(inv.id)}
                                                    aria-label="Cancel invitation"
                                                    className="size-6 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <TrashIcon className="w-3 h-3" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <p className="text-[11px] text-slate-400">
                Looking for the standalone view?{" "}
                <Link to="/app/team" className="text-slate-700 underline-offset-2 hover:underline">
                    Open the team page
                </Link>
                .
            </p>
        </SectionShell>
    );
}

function WorkspaceSection() {
    const currentOrg = useAppStore((s) => s.currentOrganization);
    const [name, setName] = React.useState(currentOrg?.name ?? "");
    const [domain, setDomain] = React.useState("");
    const [slug, setSlug] = React.useState(
        currentOrg?.name?.toLowerCase().replace(/\s+/g, "-") ?? "",
    );

    return (
        <SectionShell title="Workspace" description="Org-wide settings. Visible only to the owner.">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Identity" description="How this workspace is named and addressed.">
                    <div className="space-y-3">
                        <div>
                            <Label>Workspace name</Label>
                            <TextInput value={name} onChange={setName} className="w-full" />
                        </div>
                        <div>
                            <Label>Workspace handle</Label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[12px] text-slate-400 font-mono">warmbly.com/</span>
                                <TextInput value={slug} onChange={setSlug} className="flex-1" placeholder="acme" />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                                Shows up in invitation links and shared report URLs.
                            </p>
                        </div>
                    </div>
                </Card>

                <Card title="Sending defaults" description="Used by new campaigns unless overridden.">
                    <div className="space-y-3">
                        <div>
                            <Label>Default sender domain</Label>
                            <TextInput value={domain} onChange={setDomain} placeholder="company.com" className="w-full" />
                        </div>
                        <div>
                            <Label>Default daily cap per mailbox</Label>
                            <TextInput value="50" onChange={() => undefined} type="number" className="w-full" />
                            <p className="text-[11px] text-slate-400 mt-1">
                                Built-in safety: 50/day per cold mailbox. Raise per-campaign if needed.
                            </p>
                        </div>
                    </div>
                </Card>

                <Card title="Privacy & compliance" description="Headers and identifiers attached to every send.">
                    <div className="space-y-1">
                        <ToggleRow
                            label="Include List-Unsubscribe header"
                            description="Required by Gmail/Outlook for bulk senders. Strongly recommended."
                            defaultOn
                        />
                        <ToggleRow
                            label="Append unsubscribe link"
                            description="Plain-text footer link respecting the suppression list."
                            defaultOn
                        />
                        <ToggleRow
                            label="Track opens by default"
                            description="Inserts a 1×1 pixel. Disable for the highest deliverability."
                        />
                    </div>
                </Card>

                <Card title="Workspace stats" description="Snapshot of how this workspace is being used.">
                    <div className="grid grid-cols-3 gap-3">
                        <Stat label="Members" value={1} />
                        <Stat label="Mailboxes" value={0} />
                        <Stat label="Campaigns" value={0} />
                    </div>
                </Card>
            </div>

            <div className="mt-4 flex justify-end">
                <TopbarAction onClick={() => comingSoon("Workspace settings")}>
                    Save workspace
                </TopbarAction>
            </div>
        </SectionShell>
    );
}

function DangerSection() {
    return (
        <SectionShell title="Danger zone" description="Irreversible actions. Read carefully.">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DangerCard
                    title="Delete account"
                    body="Permanently delete your account and every workspace you own. This can't be undone."
                    cta="Delete account…"
                    onClick={() => comingSoon("Account deletion")}
                />
                <DangerCard
                    title="Leave workspace"
                    body="Remove yourself from this workspace. You'll lose access to its data immediately."
                    cta="Leave workspace…"
                    onClick={() => comingSoon("Leave workspace")}
                />
                <DangerCard
                    title="Transfer ownership"
                    body="Hand ownership of this workspace to another member. You'll become an admin."
                    cta="Transfer…"
                    onClick={() => comingSoon("Ownership transfer")}
                />
                <DangerCard
                    title="Delete workspace"
                    body="Permanently delete this workspace and every campaign, contact and mailbox it contains."
                    cta="Delete workspace…"
                    onClick={() => comingSoon("Workspace deletion")}
                />
            </div>
        </SectionShell>
    );
}

// ─── Building blocks ─────────────────────────────────────────────────

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <th className={`px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] ${className ?? ""}`}>
            {children}
        </th>
    );
}

function RolePill({ role }: { role: "owner" | "admin" | "member" }) {
    const cls =
        role === "owner"
            ? "bg-sky-50 text-sky-700 border-sky-100"
            : role === "admin"
                ? "bg-violet-50 text-violet-700 border-violet-100"
                : "bg-slate-50 text-slate-600 border-slate-200";
    return (
        <span
            className={`inline-flex items-center text-[10px] uppercase tracking-[0.08em] font-semibold rounded-sm px-1.5 py-0.5 border ${cls}`}
        >
            {role}
        </span>
    );
}

function Stat({ label, value }: { label: string; value: string | number }) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">{label}</div>
            <div className="text-[18px] font-semibold text-slate-900 tabular-nums leading-tight mt-0.5">
                {value}
            </div>
        </div>
    );
}

function ToggleRow({
    label,
    description,
    defaultOn,
}: {
    label: string;
    description: string;
    defaultOn?: boolean;
}) {
    const [on, setOn] = React.useState(!!defaultOn);
    return (
        <div className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
                <div className="text-[12.5px] text-slate-900 font-medium leading-tight">{label}</div>
                <div className="text-[11.5px] text-slate-500 leading-tight mt-0.5">{description}</div>
            </div>
            <button
                type="button"
                onClick={() => setOn(!on)}
                role="switch"
                aria-checked={on}
                className={`relative h-4 w-7 rounded-full transition-colors shrink-0 ${
                    on ? "bg-slate-900" : "bg-slate-200"
                }`}
            >
                <span
                    className={`absolute top-0.5 left-0.5 size-3 rounded-full bg-white transition-transform ${
                        on ? "translate-x-3" : "translate-x-0"
                    }`}
                />
            </button>
        </div>
    );
}

function RowLink({
    title,
    description,
    cta,
    statusLabel,
    statusTone = "muted",
}: {
    title: string;
    description: string;
    cta: string;
    statusLabel?: string;
    statusTone?: "muted" | "ok" | "warn";
}) {
    return (
        <div className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
                <div className="text-[12.5px] text-slate-900 font-medium leading-tight flex items-center gap-2">
                    {title}
                    {statusLabel && (
                        <span
                            className={`text-[10px] uppercase tracking-[0.08em] font-medium rounded-sm px-1 ${
                                statusTone === "ok"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : statusTone === "warn"
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-slate-100 text-slate-500"
                            }`}
                        >
                            {statusLabel}
                        </span>
                    )}
                </div>
                <div className="text-[11.5px] text-slate-500 leading-tight mt-0.5">{description}</div>
            </div>
            <button
                type="button"
                onClick={() => comingSoon(title)}
                className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 transition-colors shrink-0"
            >
                {cta}
            </button>
        </div>
    );
}

function DangerCard({
    title,
    body,
    cta,
    onClick,
}: {
    title: string;
    body: string;
    cta: string;
    onClick: () => void;
}) {
    return (
        <div className="rounded-md border border-red-200 bg-red-50/30 p-4 flex flex-col">
            <div className="text-[13px] font-semibold text-red-700 mb-1 flex items-center gap-1.5">
                <TrashIcon className="w-3.5 h-3.5" />
                {title}
            </div>
            <p className="text-[11.5px] text-red-700/80 mb-3 leading-relaxed flex-1">{body}</p>
            <button
                type="button"
                onClick={onClick}
                className="self-start h-7 px-2.5 rounded-md border border-red-300 hover:border-red-400 text-red-700 hover:text-red-800 hover:bg-red-100/60 text-[12px] font-medium transition-colors"
            >
                {cta}
            </button>
        </div>
    );
}
