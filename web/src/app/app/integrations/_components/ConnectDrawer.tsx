// Drawer that handles per-provider connect inputs. Each provider has a
// slightly different set of required fields:
//   - webhook providers (Calendly, Cal.com, DMARC): just a label
//   - oauth providers (Google Sheets, Postmaster): launch OAuth — for
//     now we accept a manual token paste, OAuth wiring lands in the
//     mailbox onboarding sweep
//   - api-key providers (Cloudflare, SNDS, GoDaddy, Namecheap): paste
//     the token + zone/domain
//
// The drawer is a single component (not one per provider) because the
// shape variation is small and keeping it one file makes it easier to
// add new providers later.

"use client";

import React from "react";
import { XIcon } from "lucide-react";
import toast from "react-hot-toast";

import type {
    IntegrationCatalogEntry,
    IntegrationConnection,
} from "@/lib/api/models/app/integrations/Integration";
import useConnectIntegration from "@/lib/api/hooks/app/integrations/useConnectIntegration";
import { cn } from "@/lib/utils";

interface FieldDef {
    key: string;
    label: string;
    placeholder?: string;
    helper?: string;
    type?: "text" | "password";
    required?: boolean;
}

const FIELDS_BY_PROVIDER: Record<string, FieldDef[]> = {
    calendly: [],
    cal_com: [],
    dmarc: [],
    google_sheets: [
        { key: "sheet_id", label: "Sheet ID", placeholder: "1AbC...XyZ", required: true,
          helper: "The long ID in the sheet's URL between /d/ and /edit." },
        { key: "sheet_title", label: "Display label", placeholder: "Q2 outbound list" },
        { key: "access_token", label: "OAuth access token", type: "password",
          helper: "Paste a token with Sheets scope. OAuth wiring lands in onboarding." },
    ],
    google_postmaster: [
        { key: "domain", label: "Domain", placeholder: "yourdomain.com", required: true },
        { key: "access_token", label: "OAuth access token", type: "password", required: true,
          helper: "Token with the gmail.postmaster.readonly scope." },
    ],
    microsoft_snds: [
        { key: "ip", label: "IP address or range", placeholder: "1.2.3.4", required: true,
          helper: "The IP you registered with SNDS." },
        { key: "api_token", label: "SNDS data-access key", type: "password", required: true },
    ],
    cloudflare: [
        { key: "zone_name", label: "Zone name", placeholder: "yourdomain.com", required: true },
        { key: "api_token", label: "API token", type: "password", required: true,
          helper: "Needs Zone:DNS:Edit on the listed zone. We verify before saving." },
    ],
    godaddy: [
        { key: "domain", label: "Domain", placeholder: "yourdomain.com", required: true },
        { key: "api_token", label: "API key:secret", type: "password", required: true,
          helper: "Format: <key>:<secret> from GoDaddy developer portal." },
    ],
    namecheap: [
        { key: "domain", label: "Domain", placeholder: "yourdomain.com", required: true },
        { key: "api_token", label: "API token", type: "password", required: true },
    ],
};

export default function ConnectDrawer({
    entry,
    onClose,
    onConnected,
}: {
    entry: IntegrationCatalogEntry;
    onClose: () => void;
    onConnected: (c: IntegrationConnection) => void;
}) {
    const [label, setLabel] = React.useState("");
    const [config, setConfig] = React.useState<Record<string, string>>({});
    const connect = useConnectIntegration();

    const fields = FIELDS_BY_PROVIDER[entry.provider] ?? [];

    function update(key: string, value: string) {
        setConfig((c) => ({ ...c, [key]: value }));
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault();

        for (const f of fields) {
            if (f.required && !config[f.key]?.trim()) {
                toast.error(`${f.label} is required`);
                return;
            }
        }

        try {
            const conn = await connect.mutateAsync({
                provider: entry.provider,
                label: label.trim() || entry.name,
                config,
            });
            toast.success(`Connected to ${entry.name}`);
            onConnected(conn);
            onClose();
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } }; message?: string };
            toast.error(e.response?.data?.error ?? e.message ?? "Connect failed");
        }
    }

    return (
        <div className="fixed inset-0 z-40 flex">
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
            />
            <div className="ml-auto h-full w-[480px] bg-white shadow-xl flex flex-col z-10 relative">
                <div className="h-12 px-5 border-b border-slate-200 flex items-center gap-3 shrink-0">
                    <div className="w-7 h-7 rounded bg-sky-50 ring-1 ring-sky-100 text-sky-700 inline-flex items-center justify-center text-[12px] font-semibold uppercase">
                        {entry.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">Connect</div>
                        <div className="text-[12.5px] text-slate-900 font-medium truncate">{entry.name}</div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="h-7 w-7 rounded border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-900 inline-flex items-center justify-center transition-colors"
                    >
                        <XIcon className="w-3.5 h-3.5" />
                    </button>
                </div>

                <form onSubmit={submit} className="flex-1 overflow-auto flex flex-col">
                    <div className="px-5 py-5 space-y-4">
                        <p className="text-[12.5px] text-slate-600 leading-relaxed">{entry.tagline}</p>

                        <div>
                            <label className="text-[10.5px] uppercase tracking-[0.08em] text-slate-400 font-medium">
                                Label (optional)
                            </label>
                            <input
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder={entry.name}
                                className="mt-1 w-full h-8 px-2.5 rounded border border-slate-200 bg-white text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-400 transition-colors"
                            />
                            <p className="text-[10.5px] text-slate-400 mt-1">
                                Useful if you connect more than one of the same provider.
                            </p>
                        </div>

                        {fields.map((f) => (
                            <div key={f.key}>
                                <label className="text-[10.5px] uppercase tracking-[0.08em] text-slate-400 font-medium">
                                    {f.label}
                                    {f.required && <span className="text-rose-500 ml-0.5">*</span>}
                                </label>
                                <input
                                    type={f.type ?? "text"}
                                    value={config[f.key] ?? ""}
                                    onChange={(e) => update(f.key, e.target.value)}
                                    placeholder={f.placeholder}
                                    className="mt-1 w-full h-8 px-2.5 rounded border border-slate-200 bg-white text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-400 font-mono transition-colors"
                                />
                                {f.helper && (
                                    <p className="text-[10.5px] text-slate-400 mt-1 leading-relaxed">{f.helper}</p>
                                )}
                            </div>
                        ))}

                        {fields.length === 0 && (
                            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2.5">
                                <p className="text-[12px] text-slate-600 leading-relaxed">
                                    {entry.webhook_hint ?? "We'll mint a URL for you on the next screen. Paste it into the provider's webhook configuration."}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="mt-auto border-t border-slate-200 px-5 py-3 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-7 px-3 rounded border border-slate-200 text-[12px] text-slate-700 hover:border-slate-300 hover:text-slate-900 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={connect.isPending}
                            className={cn(
                                "h-7 px-3 rounded text-[12px] font-medium text-white transition-colors",
                                connect.isPending ? "bg-sky-400" : "bg-sky-600 hover:bg-sky-700",
                            )}
                        >
                            {connect.isPending ? "Connecting…" : "Connect"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
