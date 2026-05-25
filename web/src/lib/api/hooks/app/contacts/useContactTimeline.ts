import { useQuery } from "@tanstack/react-query";
import listContactTimeline from "@/lib/api/client/app/contacts/listContactTimeline";

export default function useContactTimeline(contactId: string, enabled = true) {
    return useQuery({
        queryKey: ["contacts", contactId, "timeline"],
        queryFn: () => listContactTimeline(contactId, { limit: 100 }),
        enabled: enabled && !!contactId,
        staleTime: 15_000,
    });
}
