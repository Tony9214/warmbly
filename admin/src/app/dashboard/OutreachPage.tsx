// Admin outreach composer. Send platform email from noreply@warmbly.com
// with a configurable Reply-To so customer replies route to a real
// inbox. Every send is recorded in admin_outreach_messages — the log
// below the composer surfaces the last 50 messages with status and
// any error.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { listOutreach, sendOutreach } from "@/lib/api/client/admin/outreach";
import type {
    AdminOutreachMessage,
    AdminOutreachStatus,
    SendAdminOutreachRequest,
} from "@/lib/api/models/admin";

const STATUS_TONE: Record<AdminOutreachStatus, string> = {
    queued: "border-amber-300 text-amber-700 bg-amber-50",
    sent: "border-emerald-300 text-emerald-700 bg-emerald-50",
    failed: "border-red-300 text-red-700 bg-red-50",
};

type Mode = "user_id" | "org_id" | "email";

export default function OutreachPage() {
    const qc = useQueryClient();
    const [mode, setMode] = useState<Mode>("email");
    const [target, setTarget] = useState("");
    const [replyTo, setReplyTo] = useState("support@warmbly.com");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");

    const { data, isLoading } = useQuery({
        queryKey: ["admin", "outreach"],
        queryFn: () => listOutreach(),
        refetchInterval: 30_000,
    });

    const send = useMutation({
        mutationFn: () => {
            const req: SendAdminOutreachRequest = { subject, body };
            if (replyTo.trim()) req.reply_to = replyTo.trim();
            if (mode === "email") req.to_email = target.trim();
            if (mode === "user_id") req.to_user_id = target.trim();
            if (mode === "org_id") req.to_org_id = target.trim();
            return sendOutreach(req);
        },
        onSuccess: () => {
            toast.success("Outreach sent");
            qc.invalidateQueries({ queryKey: ["admin", "outreach"] });
            setSubject("");
            setBody("");
            setTarget("");
        },
        onError: (err: Error) => toast.error(err.message || "Send failed"),
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!target.trim()) {
            toast.error("Recipient is required");
            return;
        }
        if (!subject.trim()) {
            toast.error("Subject is required");
            return;
        }
        if (!body.trim()) {
            toast.error("Body is required");
            return;
        }
        send.mutate();
    }

    return (
        <div>
            <PageHeader
                title="Outreach"
                description="Send platform email from the Warmbly noreply address with a configurable Reply-To. Every message is audit-logged below."
            />

            <section className="border border-border rounded-lg bg-card p-4 mb-6">
                <form onSubmit={submit} className="space-y-3">
                    <div>
                        <Label className="text-xs font-medium">Recipient</Label>
                        <div className="flex items-center gap-2 mt-1">
                            <select
                                value={mode}
                                onChange={(e) => setMode(e.target.value as Mode)}
                                className="text-sm px-2 py-1.5 rounded-md border border-border bg-background"
                            >
                                <option value="email">Email address</option>
                                <option value="user_id">User ID</option>
                                <option value="org_id">Org ID (sends to owner)</option>
                            </select>
                            <Input
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                placeholder={
                                    mode === "email"
                                        ? "support-customer@example.com"
                                        : "uuid"
                                }
                                className="font-mono text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="reply_to" className="text-xs font-medium">
                            Reply-To
                        </Label>
                        <Input
                            id="reply_to"
                            value={replyTo}
                            onChange={(e) => setReplyTo(e.target.value)}
                            placeholder="support@warmbly.com (replies will land here)"
                            className="font-mono text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            From: defaults to the platform noreply address. Leave blank
                            to also have replies bounce against noreply.
                        </p>
                    </div>

                    <div>
                        <Label htmlFor="subject" className="text-xs font-medium">
                            Subject
                        </Label>
                        <Input
                            id="subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="One-line subject"
                        />
                    </div>

                    <div>
                        <Label htmlFor="body" className="text-xs font-medium">
                            Body (HTML)
                        </Label>
                        <textarea
                            id="body"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={10}
                            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                            placeholder="<p>Hi…</p>"
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={send.isPending}
                        className="bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-strong)] text-white"
                    >
                        <Send className="size-3.5" />
                        {send.isPending ? "Sending…" : "Send"}
                    </Button>
                </form>
            </section>

            <h2 className="text-sm font-semibold mb-2">Recent outreach</h2>
            {isLoading ? (
                <Skeleton className="h-40" />
            ) : (
                <OutreachLog rows={data?.data ?? []} />
            )}
        </div>
    );
}

function OutreachLog({ rows }: { rows: AdminOutreachMessage[] }) {
    if (rows.length === 0) {
        return (
            <div className="text-sm text-muted-foreground border border-border rounded-md p-4 bg-card">
                No outreach sent yet.
            </div>
        );
    }
    return (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
            <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                    <tr>
                        <th className="text-left px-3 py-2 font-medium">When</th>
                        <th className="text-left px-3 py-2 font-medium">Sender</th>
                        <th className="text-left px-3 py-2 font-medium">To</th>
                        <th className="text-left px-3 py-2 font-medium">Subject</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((m) => (
                        <tr key={m.id} className="border-t border-border align-top">
                            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(m.created_at).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-xs">
                                {m.sent_by_user?.email ?? m.sent_by.slice(0, 8)}
                            </td>
                            <td className="px-3 py-2 text-xs">
                                <div className="font-mono">{m.to_email}</div>
                                {m.reply_to && (
                                    <div className="text-[10px] text-muted-foreground">
                                        reply-to: {m.reply_to}
                                    </div>
                                )}
                            </td>
                            <td className="px-3 py-2 text-xs max-w-md truncate" title={m.subject}>
                                {m.subject}
                            </td>
                            <td className="px-3 py-2">
                                <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[m.status]}`}>
                                    {m.status}
                                </Badge>
                                {m.error && (
                                    <div className="text-[10px] text-red-600 mt-1 max-w-xs truncate" title={m.error}>
                                        {m.error}
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
