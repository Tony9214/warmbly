// OAuth apps dashboard. Developers register third-party OAuth 2.1 clients here
// (client id + one-time secret, redirect URIs, requested scopes) and review the
// apps the workspace's members have authorized. The flow itself (consent +
// token exchange) lives on the standalone /oauth/authorize page + the API.

"use client";

import React from "react";
import toast from "react-hot-toast";
import { CheckIcon, CopyIcon, PlusIcon, RefreshCwIcon, Trash2Icon, XIcon } from "lucide-react";

import { NoAccess } from "@/components/layout/NoAccess";
import { usePermission } from "@/hooks/usePermission";
import { Page, PageBody, PageTopbar, TopbarAction, EmptyBlock } from "@/components/layout/Page";
import { Label, TextInput } from "@/components/ui/field";
import { useConfirm } from "@/hooks/context/confirm";
import useAPIPermissions from "@/lib/api/hooks/app/api-keys/useAPIPermissions";
import type APIPermission from "@/lib/api/models/app/apikeys/APIPermission";
import {
    useOAuthApps,
    useCreateOAuthApp,
    useDeleteOAuthApp,
    useRotateOAuthAppSecret,
} from "@/lib/api/hooks/app/oauth/useOAuthApps";
import { useAuthorizedApps, useRevokeAuthorizedApp } from "@/lib/api/hooks/app/oauth/useAuthorizedApps";
import type { OAuthApplication, OAuthApplicationWithSecret } from "@/lib/api/models/app/oauth/OAuthApp";

function CopyButton({ value, label }: { value: string; label?: string }) {
    const [copied, setCopied] = React.useState(false);
    return (
        <button
            type="button"
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(value);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                } catch {
                    /* clipboard blocked */
                }
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 h-7 text-[11.5px] text-slate-600 hover:bg-slate-50"
        >
            {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-600" /> : <CopyIcon className="w-3.5 h-3.5" />}
            {copied ? "Copied" : (label ?? "Copy")}
        </button>
    );
}

// ScopePicker is a checkbox grid over the API permissions, toggling bits in the
// scope bitmask. Reuses the same permission catalogue as API keys.
function ScopePicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const perms = useAPIPermissions();
    const grouped = React.useMemo(() => {
        const g: Record<string, APIPermission[]> = {};
        for (const p of perms.data?.permissions ?? []) {
            (g[p.category] ??= []).push(p);
        }
        return g;
    }, [perms.data]);
    const toggle = (bit: number) => onChange(value & bit ? value & ~bit : value | bit);
    return (
        <div className="space-y-3">
            {Object.entries(grouped).map(([cat, list]) => (
                <div key={cat}>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-1">{cat}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {list.map((p) => {
                            const on = (value & p.value) === p.value;
                            return (
                                <button
                                    key={p.name}
                                    type="button"
                                    onClick={() => toggle(p.value)}
                                    className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-left ${on ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:bg-slate-50"}`}
                                >
                                    <span
                                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded ${on ? "bg-sky-600 text-white" : "border border-slate-300"}`}
                                    >
                                        {on && <CheckIcon className="w-3 h-3" />}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-[12px] font-medium text-slate-700">
                                            {p.name.toLowerCase()}
                                        </span>
                                        <span className="block text-[11px] text-slate-400 leading-tight">{p.description}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

function RegisterModal({ onClose }: { onClose: () => void }) {
    const create = useCreateOAuthApp();
    const [name, setName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [website, setWebsite] = React.useState("");
    const [redirects, setRedirects] = React.useState("");
    const [confidential, setConfidential] = React.useState(true);
    const [scopes, setScopes] = React.useState(0);
    const [created, setCreated] = React.useState<OAuthApplicationWithSecret | null>(null);

    const submit = async () => {
        const redirect_uris = redirects
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
        if (!name.trim()) {
            toast.error("Give the app a name");
            return;
        }
        if (redirect_uris.length === 0) {
            toast.error("Add at least one redirect URI");
            return;
        }
        if (scopes === 0) {
            toast.error("Select at least one scope");
            return;
        }
        try {
            const app = await create.mutateAsync({
                name: name.trim(),
                description: description.trim(),
                website_url: website.trim(),
                redirect_uris,
                scopes,
                confidential,
            });
            setCreated(app);
            toast.success("App registered");
        } catch (e) {
            toast.error((e as { message?: string })?.message ?? "Could not register the app");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onMouseDown={onClose}>
            <div
                className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="flex items-center border-b border-slate-200 px-4 h-11">
                    <span className="text-[12.5px] font-medium text-slate-900">
                        {created ? "App credentials" : "Register an OAuth app"}
                    </span>
                    <button onClick={onClose} className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100">
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>

                {created ? (
                    <div className="p-4 space-y-3">
                        <p className="text-[12px] text-slate-500 leading-relaxed">
                            Save the client secret now. For security it is shown only once and cannot be retrieved later.
                        </p>
                        <div>
                            <Label>Client ID</Label>
                            <div className="flex items-center gap-1.5">
                                <code className="flex-1 truncate rounded-md border border-slate-200 bg-slate-50 px-2 h-7 inline-flex items-center text-[11.5px] font-mono text-slate-700">
                                    {created.client_id}
                                </code>
                                <CopyButton value={created.client_id} />
                            </div>
                        </div>
                        {created.client_secret ? (
                            <div>
                                <Label>Client secret</Label>
                                <div className="flex items-center gap-1.5">
                                    <code className="flex-1 truncate rounded-md border border-amber-200 bg-amber-50 px-2 h-7 inline-flex items-center text-[11.5px] font-mono text-amber-800">
                                        {created.client_secret}
                                    </code>
                                    <CopyButton value={created.client_secret} />
                                </div>
                            </div>
                        ) : (
                            <p className="text-[11.5px] text-slate-400">
                                This is a public client (PKCE only), so there is no client secret.
                            </p>
                        )}
                        <div className="pt-1">
                            <button
                                onClick={onClose}
                                className="h-8 px-3 rounded-md bg-sky-600 text-white text-[12.5px] font-medium hover:bg-sky-700"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 space-y-3">
                        <div>
                            <Label>Name</Label>
                            <TextInput value={name} onChange={setName} placeholder="Acme Integration" className="w-full" />
                        </div>
                        <div>
                            <Label>Description</Label>
                            <TextInput value={description} onChange={setDescription} placeholder="What the app does" className="w-full" />
                        </div>
                        <div>
                            <Label>Website</Label>
                            <TextInput value={website} onChange={setWebsite} placeholder="https://acme.com" className="w-full" />
                        </div>
                        <div>
                            <Label>Redirect URIs</Label>
                            <textarea
                                value={redirects}
                                onChange={(e) => setRedirects(e.target.value)}
                                placeholder={"https://acme.com/oauth/callback"}
                                rows={2}
                                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-mono text-slate-900 placeholder:text-slate-400 outline-none resize-y focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                            />
                            <p className="mt-1 text-[11px] text-slate-400">One per line. Must be HTTPS (or a loopback URL), matched exactly.</p>
                        </div>
                        <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
                            <input
                                type="checkbox"
                                checked={confidential}
                                onChange={(e) => setConfidential(e.target.checked)}
                                className="h-4 w-4 accent-sky-600"
                            />
                            Confidential client (issue a client secret)
                        </label>
                        <p className="-mt-1.5 text-[11px] text-slate-400">
                            Turn this off for mobile / single-page apps that can't keep a secret; they use PKCE alone.
                        </p>
                        <div>
                            <Label>Scopes</Label>
                            <ScopePicker value={scopes} onChange={setScopes} />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button onClick={onClose} className="h-8 px-3 rounded-md border border-slate-200 text-[12.5px] text-slate-600 hover:bg-slate-50">
                                Cancel
                            </button>
                            <button
                                onClick={submit}
                                disabled={create.isPending}
                                className="h-8 px-3 rounded-md bg-sky-600 text-white text-[12.5px] font-medium hover:bg-sky-700 disabled:opacity-60"
                            >
                                {create.isPending ? "Registering…" : "Register app"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function AppRow({ app }: { app: OAuthApplication }) {
    const del = useDeleteOAuthApp();
    const rotate = useRotateOAuthAppSecret();
    const confirm = useConfirm();
    const [secret, setSecret] = React.useState<string | null>(null);

    const onRotate = () =>
        confirm.show("Rotate this app's client secret? The current secret stops working immediately.", async () => {
            const res = await rotate.mutateAsync(app.id);
            setSecret(res.client_secret);
        });
    const onDelete = () =>
        confirm.show(`Delete "${app.name}"? Every token issued to it is revoked.`, async () => {
            await del.mutateAsync(app.id);
        });

    return (
        <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-slate-800 truncate">{app.name}</div>
                    {app.description && <div className="text-[11.5px] text-slate-400 truncate">{app.description}</div>}
                    <div className="mt-1.5 flex items-center gap-1.5">
                        <code className="truncate rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-mono text-slate-600">
                            {app.client_id}
                        </code>
                        <CopyButton value={app.client_id} label="ID" />
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        onClick={onRotate}
                        title="Rotate secret"
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                        <RefreshCwIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={onDelete}
                        title="Delete app"
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                        <Trash2Icon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
                {app.redirect_uris.map((u) => (
                    <span key={u} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-mono text-slate-500">
                        {u}
                    </span>
                ))}
            </div>
            {secret && (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                    <div className="text-[10.5px] uppercase tracking-[0.12em] text-amber-700 mb-1">New client secret (shown once)</div>
                    <div className="flex items-center gap-1.5">
                        <code className="flex-1 truncate text-[11.5px] font-mono text-amber-800">{secret}</code>
                        <CopyButton value={secret} />
                    </div>
                </div>
            )}
        </div>
    );
}

function AuthorizedTab() {
    const authorized = useAuthorizedApps();
    const revoke = useRevokeAuthorizedApp();
    const confirm = useConfirm();
    const apps = authorized.data?.authorized_apps ?? [];

    if (apps.length === 0) {
        return <EmptyBlock title="No authorized apps" body="Apps your workspace connects to via OAuth will appear here." />;
    }
    return (
        <div className="space-y-2">
            {apps.map((a) => (
                <div key={a.application_id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-slate-800 truncate">{a.name}</div>
                        <div className="text-[11.5px] text-slate-400">
                            Authorized {new Date(a.authorized_at).toLocaleDateString()}
                        </div>
                    </div>
                    <button
                        onClick={() =>
                            confirm.show(`Revoke "${a.name}"? Its tokens stop working immediately.`, async () => {
                                await revoke.mutateAsync(a.application_id);
                            })
                        }
                        className="h-7 px-2.5 rounded-md border border-slate-200 text-[12px] text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                    >
                        Revoke
                    </button>
                </div>
            ))}
        </div>
    );
}

export default function OAuthAppsPage() {
    const canManage = usePermission("MANAGE_API_KEYS");
    const apps = useOAuthApps();
    const [tab, setTab] = React.useState<"apps" | "authorized">("apps");
    const [createOpen, setCreateOpen] = React.useState(false);

    if (!canManage) return <NoAccess feature="OAuth apps" permissionLabel="Manage API keys" />;

    const list = apps.data?.applications ?? [];

    return (
        <Page>
            <PageTopbar eyebrow="OAuth apps" subtitle="Third-party apps that connect via OAuth 2.1">
                {tab === "apps" && (
                    <TopbarAction onClick={() => setCreateOpen(true)} icon={<PlusIcon className="w-3.5 h-3.5" />}>
                        Register app
                    </TopbarAction>
                )}
            </PageTopbar>
            <PageBody>
                <div className="mb-3 flex items-center gap-1 border-b border-slate-200">
                    {(
                        [
                            ["apps", "Your apps"],
                            ["authorized", "Authorized apps"],
                        ] as const
                    ).map(([k, label]) => (
                        <button
                            key={k}
                            onClick={() => setTab(k)}
                            className={`relative h-9 px-2.5 text-[12.5px] ${tab === k ? "text-slate-900 font-medium" : "text-slate-500"}`}
                        >
                            {label}
                            {tab === k && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded bg-sky-600" />}
                        </button>
                    ))}
                </div>

                {tab === "apps" ? (
                    list.length === 0 ? (
                        <EmptyBlock
                            title="No OAuth apps yet"
                            body="Register an app to let it request scoped access to Warmbly accounts via OAuth 2.1."
                        />
                    ) : (
                        <div className="space-y-2">
                            {list.map((app) => (
                                <AppRow key={app.id} app={app} />
                            ))}
                        </div>
                    )
                ) : (
                    <AuthorizedTab />
                )}
            </PageBody>

            {createOpen && <RegisterModal onClose={() => setCreateOpen(false)} />}
        </Page>
    );
}
