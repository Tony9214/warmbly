import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listManagedWorkers } from "@/lib/api/client/app/admin/workers";
import type { ManagedWorker, WorkerInstallState } from "@/lib/api/models/app/admin/Worker";

const stateStyle: Record<WorkerInstallState, string> = {
    pending: "bg-slate-100 text-slate-600",
    provisioning: "bg-amber-100 text-amber-700",
    installed: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
    uninstalling: "bg-orange-100 text-orange-700",
    uninstalled: "bg-slate-100 text-slate-500",
};

function liveness(w: ManagedWorker): { label: string; cls: string } {
    if (!w.last_seen_at) return { label: "no heartbeat", cls: "text-slate-400" };
    const ageMs = Date.now() - new Date(w.last_seen_at).getTime();
    if (ageMs < 90_000) return { label: "online", cls: "text-green-600" };
    if (ageMs < 10 * 60_000) return { label: "stale", cls: "text-amber-600" };
    return { label: "offline", cls: "text-red-600" };
}

export default function AdminWorkersPage() {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["admin", "workers", "managed"],
        queryFn: listManagedWorkers,
        refetchInterval: 15_000,
    });

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-slate-700 font-semibold text-lg">Managed Workers</h2>
                    <p className="text-slate-400 text-sm">
                        VPSes added here are managed over SSH from this control plane.
                    </p>
                </div>
                <Link
                    to="/app/admin/workers/new"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                    + Add Worker
                </Link>
            </div>

            {isLoading && <p className="text-slate-400 text-sm">Loading…</p>}
            {error && (
                <p className="text-red-600 text-sm">
                    Failed to load workers.{" "}
                    <button onClick={() => refetch()} className="underline">retry</button>
                </p>
            )}

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                        <tr>
                            <th className="text-left px-3 py-2">Name</th>
                            <th className="text-left px-3 py-2">Host</th>
                            <th className="text-left px-3 py-2">Tier</th>
                            <th className="text-left px-3 py-2">Install</th>
                            <th className="text-left px-3 py-2">Version</th>
                            <th className="text-left px-3 py-2">Live</th>
                            <th className="text-left px-3 py-2">Accounts</th>
                            <th className="text-left px-3 py-2">Last seen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data?.data?.map((w) => {
                            const live = liveness(w);
                            return (
                                <tr key={w.id} className="border-t hover:bg-slate-50">
                                    <td className="px-3 py-2">
                                        <Link to={`/app/admin/workers/${w.id}`} className="text-blue-600 hover:underline">
                                            {w.name || w.id.slice(0, 8)}
                                        </Link>
                                        <div className="text-slate-400 text-xs">{w.id}</div>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">
                                        {w.ssh_user}@{w.ssh_host || w.ip_addr}:{w.ssh_port}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-slate-600">
                                            {w.worker_type}
                                            {w.worker_type === "shared" && (w.free_tier ? " · free" : " · premium")}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs ${stateStyle[w.install_state]}`}>
                                            {w.install_state}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs font-mono">
                                        {w.image_version || <span className="text-slate-400">—</span>}
                                    </td>
                                    <td className={`px-3 py-2 text-xs font-medium ${live.cls}`}>
                                        {live.label}
                                    </td>
                                    <td className="px-3 py-2">{w.account_count}</td>
                                    <td className="px-3 py-2 text-slate-500 text-xs">
                                        {w.last_seen_at
                                            ? new Date(w.last_seen_at).toLocaleString()
                                            : "—"}
                                    </td>
                                </tr>
                            );
                        })}
                        {data && data.data?.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-3 py-8 text-center text-slate-400 text-sm">
                                    No workers yet. Add one to get started.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
