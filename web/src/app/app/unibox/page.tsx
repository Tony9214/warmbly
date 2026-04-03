import { ConversationList } from '@/components/app/unibox/ConversationList'
import { ThreadView } from '@/components/app/unibox/ThreadView'
import { useAppStore } from '@/stores'
import { InboxIcon } from 'lucide-react'

export default function UniboxPage() {
  const selectedThreadId = useAppStore((s) => s.selectedThreadId)

  return (
    <div className="flex h-[calc(100vh-theme(spacing.11))] gap-0">
      <div className="w-80 shrink-0 border-r border-zinc-200 overflow-hidden flex flex-col">
        <ConversationList />
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {selectedThreadId ? (
          <ThreadView threadId={selectedThreadId} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mx-auto mb-3">
                <InboxIcon className="w-4 h-4 text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-zinc-900">Select a conversation</p>
              <p className="text-xs text-zinc-400 mt-0.5">Choose a thread from the left to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
