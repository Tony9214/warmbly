// Admin sign-in — two-step, matching the backend's email-code login.
//
// Step 1: email + password (+ Turnstile) -> /auth/login, which emails a
//   one-time code and returns a short-lived session.
// Step 2: the emailed code -> /auth/login/confirm, which returns the real
//   access/refresh token pair.
//
// In dev the captcha is bypassed and the code lands in mailpit (:18025).
// Clean and in-theme (light shadcn surface, red admin accent), deliberately
// distinct from the consumer dashboard's two-pane marketing login.

import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { ShieldCheck, Eye, EyeOff, Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { EnvPill } from "@/components/layout/EnvPill";
import { TurnstileModal } from "@/components/captcha/TurnstileModal";
import { login, loginConfirm } from "@/lib/api/client/auth";
import { setToken } from "@/lib/auth/storage";
import { APIError } from "@/lib/api/client";
import { DASHBOARD_URL } from "@/lib/env";
import { cn } from "@/lib/utils";

// Admin accent — red-600, the theme's --admin-danger token ("restricted access").
const ACCENT = "var(--admin-danger)";
const FOCUS_RED = "focus-visible:border-red-400 focus-visible:ring-red-100";

function errorMessage(err: unknown): string {
    return err instanceof APIError
        ? err.message
        : "Sign-in failed. Check your credentials or contact an admin.";
}

export default function LoginPage() {
    const nav = useNavigate();
    const loc = useLocation();
    const [phase, setPhase] = useState<"credentials" | "code">("credentials");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [session, setSession] = useState("");
    const [code, setCode] = useState("");
    const [captcha, setCaptcha] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const busy = submitting || captcha;

    // Step 1 — kick off the captcha; the token comes back via onToken.
    function onCredentials(e: FormEvent) {
        e.preventDefault();
        setError(null);
        if (!busy) setCaptcha(true);
    }

    async function onToken(token: string) {
        setCaptcha(false);
        setSubmitting(true);
        try {
            const res = await login({ email, password, turnstile: token });
            setSession(res.session);
            setCode("");
            setPhase("code");
        } catch (err) {
            const msg = errorMessage(err);
            setError(msg);
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    }

    // Step 2 — exchange the emailed code for the token pair.
    async function onConfirm(e: FormEvent) {
        e.preventDefault();
        setError(null);
        if (busy) return;
        setSubmitting(true);
        try {
            const tok = await loginConfirm({ session, code });
            setToken(tok);
            const dest = (loc.state as { from?: string } | null)?.from ?? "/";
            nav(dest, { replace: true });
        } catch (err) {
            const msg = errorMessage(err);
            setError(msg);
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    }

    function backToCredentials() {
        setPhase("credentials");
        setSession("");
        setCode("");
        setError(null);
    }

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
            <div className="w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Brand */}
                <div className="mb-6 flex items-center justify-center gap-2.5">
                    <Logo className="h-7 w-7 text-foreground" />
                    <span className="text-[18px] font-bold tracking-tight">Warmbly</span>
                </div>

                {/* Card — a thin red top edge is the only "admin" flourish. */}
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="h-1" style={{ backgroundColor: ACCENT }} />

                    <div className="px-7 pt-6 pb-7">
                        <div className="flex items-center justify-between">
                            <span
                                className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
                                style={{ color: ACCENT }}
                            >
                                <ShieldCheck className="size-3.5" />
                                Admin access
                            </span>
                            <EnvPill />
                        </div>

                        {phase === "credentials" ? (
                            <>
                                <h1 className="mt-4 text-[20px] font-semibold tracking-tight">Sign in</h1>
                                <p className="mt-1 text-[13px] text-muted-foreground">
                                    Restricted to Warmbly staff with admin permissions.
                                </p>

                                <form className="mt-6 space-y-4" onSubmit={onCredentials}>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            autoComplete="email"
                                            autoFocus
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            onInput={() => error && setError(null)}
                                            required
                                            placeholder="you@warmbly.com"
                                            aria-invalid={Boolean(error)}
                                            className={cn("h-10", FOCUS_RED)}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="password">Password</Label>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                autoComplete="current-password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                onInput={() => error && setError(null)}
                                                required
                                                placeholder="••••••••••••"
                                                aria-invalid={Boolean(error)}
                                                className={cn("h-10 pr-10", FOCUS_RED)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                aria-label={showPassword ? "Hide password" : "Show password"}
                                                className="absolute right-0.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {error && (
                                        <p className="flex items-start gap-1.5 text-[12.5px] text-red-600">
                                            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-red-500" />
                                            {error}
                                        </p>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={busy}
                                        className="h-10 w-full text-white hover:opacity-90"
                                        style={{ backgroundColor: ACCENT }}
                                    >
                                        {busy ? (
                                            <>
                                                <Loader2 className="size-4 animate-spin" />
                                                Signing in…
                                            </>
                                        ) : (
                                            "Sign in"
                                        )}
                                    </Button>

                                    <TurnstileModal visible={captcha} onToken={onToken} />
                                </form>
                            </>
                        ) : (
                            <>
                                <h1 className="mt-4 flex items-center gap-2 text-[20px] font-semibold tracking-tight">
                                    <MailCheck className="size-5" style={{ color: ACCENT }} />
                                    Check your email
                                </h1>
                                <p className="mt-1 text-[13px] text-muted-foreground">
                                    We sent a one-time code to <span className="font-medium text-foreground">{email}</span>.
                                </p>

                                <form className="mt-6 space-y-4" onSubmit={onConfirm}>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="code">Login code</Label>
                                        <Input
                                            id="code"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            autoFocus
                                            maxLength={8}
                                            value={code}
                                            onChange={(e) => {
                                                setCode(e.target.value.replace(/\D/g, ""));
                                                if (error) setError(null);
                                            }}
                                            required
                                            placeholder="000000"
                                            aria-invalid={Boolean(error)}
                                            className={cn("h-11 text-center font-mono text-[18px] tracking-[0.4em]", FOCUS_RED)}
                                        />
                                    </div>

                                    {import.meta.env.DEV && (
                                        <p className="text-[11px] text-muted-foreground">
                                            Dev: the code is in mailpit →{" "}
                                            <a
                                                href="http://localhost:18025"
                                                target="_blank"
                                                rel="noreferrer"
                                                className="underline underline-offset-2 hover:text-foreground"
                                            >
                                                localhost:18025
                                            </a>
                                        </p>
                                    )}

                                    {error && (
                                        <p className="flex items-start gap-1.5 text-[12.5px] text-red-600">
                                            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-red-500" />
                                            {error}
                                        </p>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={busy || code.length === 0}
                                        className="h-10 w-full text-white hover:opacity-90"
                                        style={{ backgroundColor: ACCENT }}
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="size-4 animate-spin" />
                                                Verifying…
                                            </>
                                        ) : (
                                            "Verify & sign in"
                                        )}
                                    </Button>

                                    <button
                                        type="button"
                                        onClick={backToCredentials}
                                        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                                    >
                                        <ArrowLeft className="size-3" />
                                        Use a different account
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-5 space-y-2 text-center">
                    <p className="text-[11px] text-muted-foreground">
                        Every admin action is logged to{" "}
                        <code className="font-mono">admin_audit_logs</code>.
                    </p>
                    <a
                        href={DASHBOARD_URL}
                        className="inline-block text-[11px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                        ← Back to the Warmbly dashboard
                    </a>
                </div>
            </div>
        </div>
    );
}
