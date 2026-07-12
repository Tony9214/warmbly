// /admin/releases/* — worker image release state per channel (resolved from
// GitHub releases) and the manual "check now" trigger.

import { Request } from "@/lib/api/client";

export interface ReleaseChannelState {
    channel: string;
    tag: string;
    image: string;
    published_at?: string;
    html_url?: string;
}

export interface ReleasesState {
    last_checked_at: string;
    last_error?: string;
    channels: Record<string, ReleaseChannelState | undefined>;
    github_repo: string;
    image_repo: string;
    enabled: boolean;
}

export interface ReleasesCheckResult {
    state: ReleasesState;
    changed?: unknown[];
}

export function getReleasesState(): Promise<ReleasesState> {
    return Request({
        method: "GET",
        url: "/admin/releases/state",
        authorization: true,
    });
}

export function checkReleases(): Promise<ReleasesCheckResult> {
    return Request({
        method: "POST",
        url: "/admin/releases/check",
        authorization: true,
    });
}
