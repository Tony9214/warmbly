// /admin/workers/* — the SSH-managed-worker control plane.

import { Request } from "@/lib/api/client";
import type {
    AdminWorkerEmailsResult,
    ManagedWorker,
    WorkerLiveStatus,
} from "@/lib/api/models/admin";

// getWorkerEmails returns the mailboxes assigned to a worker (paginated), with
// per-mailbox risk band + warmup health so the detail page can show how healthy
// the inboxes on this worker are.
export function getWorkerEmails(
    id: string,
    cursor?: string,
): Promise<AdminWorkerEmailsResult> {
    const q = cursor ? `?cursor=${cursor}` : "";
    return Request({
        method: "GET",
        url: `/admin/workers/${id}/emails${q}`,
        authorization: true,
    });
}

export function listManagedWorkers(): Promise<{ data: ManagedWorker[] }> {
    return Request({
        method: "GET",
        url: "/admin/workers/managed",
        authorization: true,
    });
}

export function getManagedWorker(id: string): Promise<ManagedWorker> {
    return Request({
        method: "GET",
        url: `/admin/workers/${id}/managed`,
        authorization: true,
    });
}

export function testWorker(id: string): Promise<{ ok: boolean; error?: string }> {
    return Request({
        method: "POST",
        url: `/admin/workers/${id}/test`,
        authorization: true,
    });
}

export function installWorker(id: string): Promise<{ ok: boolean }> {
    return Request({
        method: "POST",
        url: `/admin/workers/${id}/install`,
        authorization: true,
    });
}

export function restartWorker(id: string): Promise<{ ok: boolean }> {
    return Request({
        method: "POST",
        url: `/admin/workers/${id}/restart`,
        authorization: true,
    });
}

export function uninstallWorker(id: string): Promise<{ ok: boolean }> {
    return Request({
        method: "POST",
        url: `/admin/workers/${id}/uninstall`,
        authorization: true,
    });
}

export function getWorkerLiveStatus(id: string): Promise<WorkerLiveStatus> {
    return Request({
        method: "GET",
        url: `/admin/workers/${id}/live-status`,
        authorization: true,
    });
}

export function getWorkerLogs(id: string, lines = 200): Promise<{ logs: string }> {
    return Request({
        method: "GET",
        url: `/admin/workers/${id}/logs?lines=${lines}`,
        authorization: true,
    });
}
