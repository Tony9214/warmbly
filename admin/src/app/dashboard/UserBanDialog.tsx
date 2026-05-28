// Ban / unban dialog. Same component handles both actions — the
// caller passes `mode` based on current ban status. Reason is required
// so the audit trail always carries it.

import { useState } from "react";
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
import { banUser, unbanUser } from "@/lib/api/client/admin/users";

export function UserBanDialog({
    userId,
    userEmail,
    mode,
    open,
    onOpenChange,
}: {
    userId: string;
    userEmail: string;
    mode: "ban" | "unban";
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const qc = useQueryClient();
    const [reason, setReason] = useState("");

    const mutation = useMutation({
        mutationFn: () =>
            mode === "ban"
                ? banUser(userId, { reason })
                : unbanUser(userId, { reason }),
        onSuccess: () => {
            toast.success(mode === "ban" ? "User banned" : "User unbanned");
            qc.invalidateQueries({ queryKey: ["admin", "users"] });
            qc.invalidateQueries({ queryKey: ["admin", "users", userId] });
            setReason("");
            onOpenChange(false);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Action failed");
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {mode === "ban" ? "Ban user" : "Unban user"}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === "ban" ? "Banning" : "Unbanning"}{" "}
                        <span className="font-mono">{userEmail}</span>. The reason
                        is written to the admin audit log and visible to other
                        admins.
                    </DialogDescription>
                </DialogHeader>

                <div>
                    <Label htmlFor="reason" className="text-xs font-medium">
                        Reason
                    </Label>
                    <Input
                        id="reason"
                        placeholder={
                            mode === "ban"
                                ? "e.g. repeated spam complaints, refused to honor unsubscribe"
                                : "e.g. resolved after appeal, false positive"
                        }
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        autoFocus
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            if (reason.trim() === "") {
                                toast.error("Reason is required");
                                return;
                            }
                            mutation.mutate();
                        }}
                        disabled={mutation.isPending}
                        className={
                            mode === "ban"
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }
                    >
                        {mutation.isPending
                            ? "Working…"
                            : mode === "ban"
                            ? "Ban user"
                            : "Unban user"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
