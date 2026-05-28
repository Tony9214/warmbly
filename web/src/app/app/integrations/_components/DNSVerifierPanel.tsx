// Inline DNS verifier widget. User types a domain, hits "Check" — the
// backend resolves SPF/DKIM/DMARC and the optional tracking CNAME and
// returns a verification row that we render below.

"use client";

import React from "react";
import { CheckIcon, GlobeIcon, RefreshCwIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";

import useVerifyDNS from "@/lib/api/hooks/app/integrations/useVerifyDNS";
import type { DNSVerification } from "@/lib/api/models/app/integrations/Integration";
import { cn } from "@/lib/utils";

export default function DNSVerifierPanel({ verifications }: { verifications: DNSVerification[] }) {
    const [domain, setDomain] = React.useState("");
    const [dkimSelector, setDkimSelector] = React.useState("");
    const [trackingCname, setTrackingCname] = React.useState("");
    const verify = useVerifyDNS();
    const [latest, setLatest] = React.useState<DNSVerification | null>(null);

    async function submit() {
        if (!domain.trim()) {
            toast.error("Domain is required");
            return;
        }
        try {
            const v = await verify.mutateAsync({
                domain: domain.trim(),
                dkim_selector: dkimSelector.trim() || undefined,
                tracking_cname: trackingCname.trim() || undefined,
            });
            setLatest(v);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } }; message?: string };
            toast.error(e.response?.data?.error ?? e.message ?? "Verification failed");
        }
    }

    const display = latest ?? verifications[0] ?? null;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-[10.5px] uppercase tracking-[0.08em] text-slate-400 font-medium">Domain</label>
                    <div className="mt-1 h-8 rounded border border-slate-200 bg-white flex items-center gap-1 px-2.5 focus-within:border-sky-400 transition-colors">
                        <GlobeIcon className="w-3.5 h-3.5 text-slate-400" />
                        <input
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            placeholder="yourdomain.com"
                            className="flex-1 bg-transparent text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none"
                        />
                    </div>
                </div>
                <div className="w-[160px]">
                    <label className="text-[10.5px] uppercase tracking-[0.08em] text-slate-400 font-medium">DKIM selector</label>
                    <input
                        value={dkimSelector}
                        onChange={(e) => setDkimSelector(e.target.value)}
                        placeholder="auto"
                        className="mt-1 w-full h-8 px-2.5 rounded border border-slate-200 bg-white text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-400 font-mono transition-colors"
                    />
                </div>
                <div className="w-[200px]">
                    <label className="text-[10.5px] uppercase tracking-[0.08em] text-slate-400 font-medium">Tracking CNAME</label>
                    <input
                        value={trackingCname}
                        onChange={(e) => setTrackingCname(e.target.value)}
                        placeholder="trk.yourdomain.com"
                        className="mt-1 w-full h-8 px-2.5 rounded border border-slate-200 bg-white text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-400 font-mono transition-colors"
                    />
                </div>
                <button
                    type="button"
                    onClick={submit}
                    disabled={verify.isPending}
                    className={cn(
                        "h-8 px-3 rounded text-[12px] font-medium text-white inline-flex items-center gap-1.5 transition-colors",
                        verify.isPending ? "bg-sky-400" : "bg-sky-600 hover:bg-sky-700",
                    )}
                >
                    <RefreshCwIcon className={cn("w-3 h-3", verify.isPending && "animate-spin")} />
                    {verify.isPending ? "Checking…" : "Check"}
                </button>
            </div>

            {display && (
                <div className="rounded border border-slate-200 overflow-hidden">
                    <div className="h-9 px-3 border-b border-slate-200 flex items-center gap-2 bg-slate-50">
                        <GlobeIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[12.5px] font-medium text-slate-900">{display.domain}</span>
                        <span className="ml-auto font-mono text-[10.5px] text-slate-400 tabular-nums">
                            checked {new Date(display.checked_at).toLocaleString()}
                        </span>
                    </div>
                    <div className="grid grid-cols-4 divide-x divide-slate-200/60">
                        <CheckCell label="SPF" ok={display.spf_ok} value={display.spf_record} />
                        <CheckCell
                            label={display.dkim_selector ? `DKIM · ${display.dkim_selector}` : "DKIM"}
                            ok={display.dkim_ok}
                            value={display.dkim_record}
                        />
                        <CheckCell label="DMARC" ok={display.dmarc_ok} value={display.dmarc_record} />
                        <CheckCell
                            label="Tracking"
                            ok={display.tracking_ok}
                            value={display.tracking_cname}
                            optional
                        />
                    </div>
                </div>
            )}

            {verifications.length > 1 && (
                <div className="text-[10.5px] text-slate-400 font-mono">
                    {verifications.length} domains verified · most recent shown above
                </div>
            )}
        </div>
    );
}

function CheckCell({
    label,
    ok,
    value,
    optional,
}: {
    label: string;
    ok: boolean;
    value?: string | null;
    optional?: boolean;
}) {
    return (
        <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5">
                {ok ? (
                    <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                ) : value || !optional ? (
                    <XIcon className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                    <span className="w-3.5 h-3.5 inline-block" />
                )}
                <span className="text-[10.5px] uppercase tracking-[0.08em] text-slate-500 font-medium">
                    {label}
                </span>
            </div>
            <div className="mt-1 font-mono text-[10.5px] text-slate-600 break-all line-clamp-2">
                {value ? value : optional && !ok ? "not checked" : "not found"}
            </div>
        </div>
    );
}
