import type { Inbox } from "@/lib/types/inbox";
import { createContext, useContext } from "react";

interface InboxContextType {
    emails: Inbox[] | null;
    search: string;
    setSearch: (value: string) => void;
    setView: (value: string) => void;
    GetAddresses: (query: string, page: number) => Promise<void>;
    changeAddress: (email: Inbox) => void;
}

export const InboxContext = createContext<InboxContextType | undefined>(undefined);

export function useInbox() {
    return useContext(InboxContext);
}
