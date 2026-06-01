import warmupLifecycle, { type WarmupAction } from "@/lib/api/client/app/emails/warmupLifecycle";
import type GetEmails from "@/lib/api/models/app/emails/GetEmails";
import type Inbox from "@/lib/api/models/app/emails/Inbox";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";

// Drives the flame-icon dropdown + the warmup tab's enable/pause/resume
// control. Patches the mailbox into every emails list page and the single
// mailbox cache (mirrors useUpdateEmail) and invalidates the account-status
// query so the live warmup/health panel refreshes.
export default function useWarmupLifecycle(id: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (action: WarmupAction) => warmupLifecycle(id, action),
        onSuccess: (data) => {
            const allLists = queryClient.getQueriesData<InfiniteData<GetEmails>>({
                queryKey: ["emails", "list"],
            });

            for (const [key, oldData] of allLists) {
                if (!oldData) continue;

                queryClient.setQueryData(key, {
                    ...oldData,
                    pages: oldData.pages.map((page) => ({
                        ...page,
                        data: page.data.map((c) => (c.id === id ? data : c)),
                    })),
                });
            }

            queryClient.setQueryData<Inbox>(["emails", id], data);
            void queryClient.invalidateQueries({ queryKey: ["analytics", "accounts", id] });
        },
    });
}
