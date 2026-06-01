// Shapes returned by /auth/*. Kept in lockstep with web/src/lib/api/models/auth/.

import type { AdminToken } from "@/lib/auth/storage";

export interface LoginRequest {
    email: string;
    password: string;
    // Cloudflare Turnstile token. The backend's /auth/login verifies this
    // (TURNSTILE_BYPASS_TOKEN short-circuits it in dev). See TurnstileModal.
    turnstile: string;
}

// Step 1 (/auth/login) verifies the password + captcha, emails a one-time
// code, and returns a short-lived session token — NOT the access token.
export interface LoginStartResponse {
    session: string;
}

// Step 2 (/auth/login/confirm) exchanges that session + the emailed code for
// the real access/refresh token pair.
export interface LoginConfirmRequest {
    session: string;
    code: string;
}

// The token pair, returned by /auth/login/confirm and /auth/refresh.
export type LoginResponse = AdminToken;

export interface AdminProfile {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    avatar?: string;
    is_admin?: boolean;
    admin_permissions?: string[];
    [k: string]: unknown;
}
