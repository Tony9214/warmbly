// /admin/worker-profiles/* — worker runtime config templates. A profile
// holds the env a worker machine runs with (image, Kafka, schema registry,
// Redis, AWS creds). Applying a profile re-writes worker.env on every
// assigned machine and restarts the service. Secrets are write-only: the
// backend never returns them, only has_* booleans.

import { Request } from "@/lib/api/client";

export type WorkerProfileReleaseChannel = "pinned" | "stable" | "dev";

export interface WorkerProfile {
    id: string;
    name: string;
    description: string;
    app_env: string;
    worker_image: string;
    kafka_bootstrap_servers: string;
    kafka_sasl_username: string;
    has_kafka_password: boolean;
    schema_registry_url: string;
    schema_registry_key: string;
    has_schema_secret: boolean;
    has_redis_url: boolean;
    aws_credential_id: string | null;
    release_channel: WorkerProfileReleaseChannel;
    auto_update: boolean;
    resolved_image_tag: string;
    last_release_check_at: string | null;
    created_at: string;
    updated_at: string;
}

// Create/update body. On update, empty secret fields mean "keep the
// stored value".
export interface WorkerProfileBody {
    name: string;
    description: string;
    app_env: string;
    worker_image: string;
    kafka_bootstrap_servers: string;
    kafka_sasl_username: string;
    kafka_sasl_password: string;
    schema_registry_url: string;
    schema_registry_key: string;
    schema_registry_secret: string;
    redis_url: string;
    aws_credential_id: string | null;
}

export interface WorkerProfileWorker {
    id: string;
    name?: string;
    install_state?: string;
}

export interface WorkerProfileApplyResult {
    worker_id: string;
    ok: boolean;
    skipped?: boolean;
    error?: string;
}

export async function listWorkerProfiles(): Promise<WorkerProfile[]> {
    const res = await Request<{ data: WorkerProfile[] }>({
        method: "GET",
        url: "/admin/worker-profiles",
        authorization: true,
    });
    return res.data ?? [];
}

export function getWorkerProfile(id: string): Promise<WorkerProfile> {
    return Request({
        method: "GET",
        url: `/admin/worker-profiles/${id}`,
        authorization: true,
    });
}

export function createWorkerProfile(
    body: WorkerProfileBody,
): Promise<{ id: string }> {
    return Request({
        method: "POST",
        url: "/admin/worker-profiles",
        data: body,
        authorization: true,
    });
}

export function updateWorkerProfile(
    id: string,
    body: WorkerProfileBody,
): Promise<{ ok: boolean }> {
    return Request({
        method: "PATCH",
        url: `/admin/worker-profiles/${id}`,
        data: body,
        authorization: true,
    });
}

export function deleteWorkerProfile(id: string): Promise<{ ok: boolean }> {
    return Request({
        method: "DELETE",
        url: `/admin/worker-profiles/${id}`,
        authorization: true,
    });
}

export async function listWorkerProfileWorkers(
    id: string,
): Promise<WorkerProfileWorker[]> {
    const res = await Request<{ data: WorkerProfileWorker[] }>({
        method: "GET",
        url: `/admin/worker-profiles/${id}/workers`,
        authorization: true,
    });
    return res.data ?? [];
}

export async function applyWorkerProfile(
    id: string,
): Promise<WorkerProfileApplyResult[]> {
    const res = await Request<{ results: WorkerProfileApplyResult[] }>({
        method: "POST",
        url: `/admin/worker-profiles/${id}/apply`,
        authorization: true,
    });
    return res.results ?? [];
}

export function setWorkerProfileRelease(
    id: string,
    body: { channel: WorkerProfileReleaseChannel; auto_update: boolean },
): Promise<{ ok: boolean }> {
    return Request({
        method: "PUT",
        url: `/admin/worker-profiles/${id}/release`,
        data: body,
        authorization: true,
    });
}
