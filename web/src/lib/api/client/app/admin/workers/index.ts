// All admin worker-management API calls. Each function is a thin axios wrapper
// over Request<T>; pages call these directly via react-query.

import Request from "../../../../Request";
import type {
    CreateWorkerInput,
    CreateWorkerResponse,
    ManagedWorker,
    WorkerLiveStatus,
} from "../../../../models/app/admin/Worker";

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

export function createWorker(input: CreateWorkerInput): Promise<CreateWorkerResponse> {
    return Request({
        method: "POST",
        url: "/admin/workers",
        data: input,
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

export function upgradeWorker(id: string): Promise<{ ok: boolean }> {
    return Request({
        method: "POST",
        url: `/admin/workers/${id}/upgrade`,
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

export function rotateWorkerKeys(id: string): Promise<{ ssh_public_key: string }> {
    return Request({
        method: "POST",
        url: `/admin/workers/${id}/rotate-keys`,
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

export function deleteWorker(id: string): Promise<{ ok: boolean }> {
    return Request({
        method: "DELETE",
        url: `/admin/workers/${id}`,
        authorization: true,
    });
}

export function systemUpdateWorker(id: string): Promise<{ output: string; reboot_required: boolean }> {
    return Request({
        method: "POST",
        url: `/admin/workers/${id}/system-update`,
        authorization: true,
    });
}

export function rebootWorker(id: string): Promise<{ ok: boolean }> {
    return Request({
        method: "POST",
        url: `/admin/workers/${id}/reboot`,
        authorization: true,
    });
}
