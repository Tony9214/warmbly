// User rate-limit override editor. Same "0 = inherit, positive = explicit
// override" convention as the org limit overrides — leaving a field
// blank means "don't touch it" on the PATCH, and the GET endpoint
// already returns null for any unset value.

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserRateLimits } from "@/lib/api/client/admin/users";
import type {
    AdminUserRateLimits,
    UpdateUserRateLimitsRequest,
} from "@/lib/api/models/admin";

type FieldKey =
    | "daily_email_limit"
    | "max_connections"
    | "limit_ws_message_pm"
    | "limit_ws_join_pm"
    | "limit_ws_event_pm";

const FIELDS: { key: FieldKey; label: string; hint: string }[] = [
    { key: "daily_email_limit", label: "Daily emails", hint: "Outbound mail per day" },
    { key: "max_connections", label: "Max connections", hint: "Concurrent websocket sessions" },
    { key: "limit_ws_message_pm", label: "WS messages / min", hint: "Realtime messages per minute" },
    { key: "limit_ws_join_pm", label: "WS joins / min", hint: "Realtime channel joins per minute" },
    { key: "limit_ws_event_pm", label: "WS events / min", hint: "Realtime broadcast events per minute" },
];

export function UserRateLimitsDialog({
    userId,
    userEmail,
    current,
    open,
    onOpenChange,
}: {
    userId: string;
    userEmail: string;
    current: AdminUserRateLimits | null | undefined;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const qc = useQueryClient();
    const [form, setForm] = useState<Record<FieldKey, string>>(() => seedForm(current));

    useEffect(() => {
        if (open) setForm(seedForm(current));
    }, [open, current]);

    const mutation = useMutation({
        mutationFn: (req: UpdateUserRateLimitsRequest) => updateUserRateLimits(userId, req),
        onSuccess: () => {
            toast.success("Rate limits updated");
            qc.invalidateQueries({ queryKey: ["admin", "users", userId] });
            qc.invalidateQueries({ queryKey: ["admin", "users", userId, "rate-limits"] });
            onOpenChange(false);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to update rate limits");
        },
    });

    function submit() {
        const req: UpdateUserRateLimitsRequest = {};
        for (const f of FIELDS) {
            const raw = form[f.key].trim();
            if (raw === "") continue;
            const n = Number(raw);
            if (!Number.isInteger(n) || n < 0) {
                toast.error(`${f.label}: must be a non-negative integer`);
                return;
            }
            req[f.key] = n;
        }
        if (Object.keys(req).length === 0) {
            toast.error("Nothing changed");
            return;
        }
        mutation.mutate(req);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Rate limit overrides</DialogTitle>
                    <DialogDescription>
                        Per-user overrides for{" "}
                        <span className="font-mono">{userEmail}</span>. Leave blank
                        to keep the current value, set to <strong>0</strong> to
                        clear the override (back to plan default).
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3">
                    {FIELDS.map((f) => {
                        const cur = current?.[f.key];
                        return (
                            <div key={f.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm">
                                <div>
                                    <Label htmlFor={f.key} className="text-xs font-medium">
                                        {f.label}
                                    </Label>
                                    <div className="text-[10px] text-muted-foreground">
                                        {f.hint}
                                    </div>
                                </div>
                                <div className="text-[10px] text-muted-foreground text-right">
                                    <div>current</div>
                                    <div className="tabular-nums">
                                        {cur != null ? cur : "—"}
                                    </div>
                                </div>
                                <Input
                                    id={f.key}
                                    inputMode="numeric"
                                    placeholder="—"
                                    value={form[f.key]}
                                    onChange={(e) =>
                                        setForm((s) => ({ ...s, [f.key]: e.target.value }))
                                    }
                                    className="w-28 text-right tabular-nums"
                                />
                            </div>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={mutation.isPending}
                        className="bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-strong)] text-white"
                    >
                        {mutation.isPending ? "Saving…" : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function seedForm(current: AdminUserRateLimits | null | undefined): Record<FieldKey, string> {
    const blank: Record<FieldKey, string> = {
        daily_email_limit: "",
        max_connections: "",
        limit_ws_message_pm: "",
        limit_ws_join_pm: "",
        limit_ws_event_pm: "",
    };
    if (!current) return blank;
    return {
        daily_email_limit: current.daily_email_limit != null ? String(current.daily_email_limit) : "",
        max_connections: current.max_connections != null ? String(current.max_connections) : "",
        limit_ws_message_pm: current.limit_ws_message_pm != null ? String(current.limit_ws_message_pm) : "",
        limit_ws_join_pm: current.limit_ws_join_pm != null ? String(current.limit_ws_join_pm) : "",
        limit_ws_event_pm: current.limit_ws_event_pm != null ? String(current.limit_ws_event_pm) : "",
    };
}
