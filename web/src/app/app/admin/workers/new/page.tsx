import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createWorker } from "@/lib/api/client/app/admin/workers";
import { assignWorkerProfile, listWorkerProfiles } from "@/lib/api/client/app/admin/credentials";
import type { CreateWorkerResponse } from "@/lib/api/models/app/admin/Worker";

export default function AdminAddWorkerPage() {
    const nav = useNavigate();
    const [form, setForm] = useState({
        name: "",
        notes: "",
        worker_type: "shared" as "shared" | "dedicated",
        free_tier: false,
        ssh_host: "",
        ssh_port: 22,
        ssh_user: "root",
    });
    const [profileID, setProfileID] = useState<string>("");
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<CreateWorkerResponse | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const profiles = useQuery({ queryKey: ["admin", "profiles"], queryFn: listWorkerProfiles });

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setErr(null);
        setSubmitting(true);
        try {
            const r = await createWorker(form);
            if (profileID) {
                try {
                    await assignWorkerProfile(r.id, profileID);
                } catch (e: any) {
                    setErr("worker created but profile assignment failed: " + (e?.message || ""));
                }
            }
            setResult(r);
        } catch (e: any) {
            setErr(e?.message || "failed");
        } finally {
            setSubmitting(false);
        }
    }

    if (result) {
        return (
            <div className="max-w-2xl">
                <h2 className="text-slate-700 font-semibold text-lg mb-2">Worker created</h2>
                <p className="text-slate-500 text-sm mb-4">
                    Paste this public key into <code className="bg-slate-100 px-1 rounded">~/.ssh/authorized_keys</code> on
                    the target VPS, then run a connection test.
                </p>

                <label className="text-xs font-medium text-slate-500 uppercase">SSH public key</label>
                <textarea
                    readOnly
                    value={result.ssh_public_key}
                    rows={3}
                    className="w-full font-mono text-xs p-2 border rounded mb-4 bg-slate-50"
                    onFocus={(e) => e.currentTarget.select()}
                />

                <div className="flex gap-2">
                    <button
                        onClick={() => nav(`/app/admin/workers/${result.id}`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                        Continue →
                    </button>
                    <button
                        onClick={() => navigator.clipboard?.writeText(result.ssh_public_key)}
                        className="border px-4 py-2 rounded-lg text-sm"
                    >
                        Copy key
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="max-w-2xl space-y-4">
            <h2 className="text-slate-700 font-semibold text-lg">Add Worker</h2>
            <p className="text-slate-500 text-sm">
                After creating, you'll be shown a public key to paste into the VPS's
                <code className="bg-slate-100 px-1 mx-1 rounded">~/.ssh/authorized_keys</code>.
            </p>

            <Field label="Name">
                <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="hetzner-fra-1"
                    className="w-full border rounded px-3 py-2 text-sm"
                />
            </Field>

            <Field label="Notes">
                <input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                />
            </Field>

            <div className="grid grid-cols-3 gap-3">
                <Field label="SSH host / IP">
                    <input
                        required
                        value={form.ssh_host}
                        onChange={(e) => setForm({ ...form, ssh_host: e.target.value })}
                        placeholder="203.0.113.42"
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                </Field>
                <Field label="Port">
                    <input
                        type="number"
                        value={form.ssh_port}
                        onChange={(e) => setForm({ ...form, ssh_port: Number(e.target.value) })}
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                </Field>
                <Field label="User">
                    <input
                        value={form.ssh_user}
                        onChange={(e) => setForm({ ...form, ssh_user: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Worker type">
                    <select
                        value={form.worker_type}
                        onChange={(e) => setForm({ ...form, worker_type: e.target.value as any })}
                        className="w-full border rounded px-3 py-2 text-sm"
                    >
                        <option value="shared">shared</option>
                        <option value="dedicated">dedicated</option>
                    </select>
                </Field>
                <Field label="Tier">
                    <select
                        value={form.free_tier ? "free" : "premium"}
                        onChange={(e) => setForm({ ...form, free_tier: e.target.value === "free" })}
                        className="w-full border rounded px-3 py-2 text-sm"
                    >
                        <option value="premium">premium</option>
                        <option value="free">free</option>
                    </select>
                </Field>
            </div>

            <Field label="Worker profile">
                <select
                    value={profileID}
                    onChange={(e) => setProfileID(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                >
                    <option value="">(use backend env defaults)</option>
                    {profiles.data?.data?.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name} · {p.app_env}
                        </option>
                    ))}
                </select>
                <p className="text-slate-400 text-xs mt-0.5">
                    Profile supplies Kafka, Schema Registry, Redis, and AWS creds at install time.
                </p>
            </Field>

            {err && <p className="text-red-600 text-sm">{err}</p>}

            <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
                {submitting ? "Creating…" : "Create worker"}
            </button>
        </form>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs font-medium text-slate-500 uppercase block mb-1">{label}</label>
            {children}
        </div>
    );
}
