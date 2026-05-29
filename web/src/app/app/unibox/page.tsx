// Unibox page — three-pane mail browser, locked behind any paid
// plan (Starter and above). When the org isn't on a paid tier we
// render the real layout behind a frosted "Upgrade to Starter"
// overlay so the user sees what they'd unlock.

import { ConversationList } from "@/components/app/unibox/ConversationList";
import { ThreadView } from "@/components/app/unibox/ThreadView";
import { useAppStore } from "@/stores";
import { ChevronLeftIcon, InboxIcon } from "lucide-react";
import useFeatureAccess from "@/hooks/useFeatureAccess";
import { LockedSurface } from "@/components/layout/LockedSurface";
import { cn } from "@/lib/utils";

export default function UniboxPage() {
    const selectedThreadId = useAppStore((s) => s.selectedThreadId);
    const setSelectedThreadId = useAppStore((s) => s.setSelectedThreadId);
    const access = useFeatureAccess();

    return (
        <LockedSurface
            locked={!access.hasInbox}
            feature="Unified inbox"
            blurb="Read and reply to every inbound message across every connected mailbox from one place — searchable, filterable, with realtime updates."
            minPlan="starter"
            bullets={[
                "Search by sender, subject, account, date range, and tag",
                "Three-pane reader with keyboard shortcuts",
                "Tag-based filtering for groups of mailboxes",
                "Realtime new-message updates over WebSocket",
            ]}
        >
            <div className="flex h-full bg-white">
                {/* Conversation list — full-width on mobile (the only pane shown
                    when nothing is selected); a fixed sidebar on >=md. Hidden on
                    mobile once a thread is open so the reader gets the screen. */}
                <div
                    className={cn(
                        "w-full md:w-[340px] shrink-0 border-r border-slate-200 overflow-hidden flex-col",
                        selectedThreadId ? "hidden md:flex" : "flex",
                    )}
                >
                    <ConversationList />
                </div>

                {/* Reader — hidden on mobile until a thread is picked, then
                    full-screen with a back bar; always visible on >=md. */}
                <div
                    className={cn(
                        "flex-1 min-w-0 overflow-hidden flex-col",
                        selectedThreadId ? "flex" : "hidden md:flex",
                    )}
                >
                    {selectedThreadId ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setSelectedThreadId(null)}
                                className="md:hidden flex items-center gap-1 px-3 h-10 shrink-0 border-b border-slate-200 text-[13px] font-medium text-slate-600 hover:text-slate-900 active:bg-slate-50"
                            >
                                <ChevronLeftIcon className="w-4 h-4" />
                                Inbox
                            </button>
                            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                <ThreadView threadId={selectedThreadId} />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center px-5">
                                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                                    <InboxIcon className="w-4 h-4" />
                                </div>
                                <p className="text-[12.5px] font-medium text-slate-700">
                                    Select a conversation
                                </p>
                                <p className="text-[11.5px] text-slate-400 mt-1 max-w-[34ch] leading-relaxed">
                                    Pick a thread from the list to read and reply.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </LockedSurface>
    );
}
