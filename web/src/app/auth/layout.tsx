import React from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { APP_URL, WEBSITE_URL } from "@/lib/information";
import getToken from "@/lib/helper/getToken";
import { Logo } from "@/components/svg";
import { Github } from "lucide-react";
import AuthShowcase from "./_components/AuthShowcase";

/* ═══════════════════════════════════════════
   Auth layout — a box, with a header above it and a footer below it.

   The header (logo left · link right) and footer (copyright left · legal
   right) share the box's exact width, so the whole thing reads as one
   aligned column. The box itself is two panes: a rotating showcase on an
   airy sky (left, desktop) and the form (right).
   ═══════════════════════════════════════════ */

export default function AuthLayout({
    redirectIfAuthenticated = true,
}: { redirectIfAuthenticated?: boolean } = {}) {
    const navigate = useNavigate();

    React.useEffect(() => {
        const receiveMessage = (event: MessageEvent) => {
            if (event.origin !== APP_URL) return;
            if (event.data?.type === "auth") navigate("/app/emails");
        };
        window.addEventListener("message", receiveMessage);
        return () => window.removeEventListener("message", receiveMessage);
    }, [navigate]);

    if (redirectIfAuthenticated && getToken()) {
        return <Navigate to="/app/emails" replace />;
    }

    return (
        <div className="flex min-h-dvh w-full items-center justify-center bg-slate-50 px-5 py-10 text-slate-900">
            <div className="w-full max-w-[400px] lg:max-w-[900px]">
                {/* Header — above the box, full box width */}
                <div className="mb-4 flex items-center justify-between px-1">
                    <a href={WEBSITE_URL} className="flex items-center gap-2.5">
                        <Logo className="w-7 text-slate-900" />
                        <span className="font-extrabold text-[18px] tracking-tight text-slate-900">Warmbly</span>
                    </a>
                    <a
                        href="https://github.com/warmbly/warmbly"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-400 hover:text-slate-700 transition-colors"
                    >
                        <Github className="w-4 h-4" /> Star on GitHub
                    </a>
                </div>

                {/* The box */}
                <div className="animate-card-float grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_30px_70px_-32px_rgba(15,23,42,0.32)] lg:grid-cols-2 lg:min-h-[560px]">
                    <div className="hidden lg:block">
                        <AuthShowcase />
                    </div>
                    <div className="flex items-center justify-center px-6 py-10 sm:px-10">
                        <div className="w-full max-w-[360px]">
                            <Outlet />
                        </div>
                    </div>
                </div>

                {/* Footer — below the box, full box width */}
                <div className="mt-4 flex items-center justify-between px-1 text-[12px] text-slate-400">
                    <span>© {new Date().getFullYear()} Warmbly</span>
                    <div className="flex items-center gap-3">
                        <a href={`${WEBSITE_URL}/terms`} target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 transition-colors">Terms</a>
                        <a href={`${WEBSITE_URL}/privacy`} target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 transition-colors">Privacy</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
