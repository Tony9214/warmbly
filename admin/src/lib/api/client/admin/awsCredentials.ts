// /admin/aws-credentials — AWS access key pairs used by worker
// infrastructure for KMS envelope encryption and S3 storage.
//
// The secret access key is write-only: it is stored encrypted server-side
// and never returned. Responses carry a has_secret flag instead, and an
// empty secret_access_key on update keeps the stored secret (filling it
// rotates the secret).

import { Request } from "@/lib/api/client";

export interface AWSCredentials {
    id: string;
    name: string;
    description: string;
    region: string;
    access_key_id: string;
    has_secret: boolean;
    created_at: string;
    updated_at: string;
}

export interface AWSCredentialsInput {
    name: string;
    description: string;
    region: string;
    access_key_id: string;
    // Empty on update keeps the stored secret; a value rotates it.
    secret_access_key: string;
}

export async function listAwsCredentials(): Promise<AWSCredentials[]> {
    const res = await Request<{ data: AWSCredentials[] }>({
        method: "GET",
        url: "/admin/aws-credentials",
        authorization: true,
    });
    return res.data ?? [];
}

export function getAwsCredential(id: string): Promise<AWSCredentials> {
    return Request({
        method: "GET",
        url: `/admin/aws-credentials/${id}`,
        authorization: true,
    });
}

export function createAwsCredential(
    body: AWSCredentialsInput,
): Promise<{ id: string }> {
    return Request({
        method: "POST",
        url: "/admin/aws-credentials",
        data: body,
        authorization: true,
    });
}

export function updateAwsCredential(
    id: string,
    body: AWSCredentialsInput,
): Promise<{ ok: boolean }> {
    return Request({
        method: "PATCH",
        url: `/admin/aws-credentials/${id}`,
        data: body,
        authorization: true,
    });
}

export function deleteAwsCredential(id: string): Promise<{ ok: boolean }> {
    return Request({
        method: "DELETE",
        url: `/admin/aws-credentials/${id}`,
        authorization: true,
    });
}
