import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SendIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import sendReply from '@/lib/api/client/app/unibox/sendReply'
import type UniboxEmail from '@/lib/api/models/app/unibox/UniboxEmail'

interface ReplyComposerProps {
  threadId: string
  threadEmails: UniboxEmail[]
}

export function ReplyComposer({ threadId, threadEmails }: ReplyComposerProps) {
  const [reply, setReply] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSend = async () => {
    if (!reply.trim()) return

    const latestEmail = threadEmails[threadEmails.length - 1]
    if (!latestEmail?.account_id) {
      toast.error('Cannot determine sender account for this thread')
      return
    }

    const replyTo = latestEmail.from?.trim()
    if (!replyTo) {
      toast.error('Cannot determine recipient for this reply')
      return
    }

    const subjectBase = latestEmail.subject?.trim() || 'Re:'
    const subject = /^re:/i.test(subjectBase) ? subjectBase : `Re: ${subjectBase}`

    setIsSending(true)
    try {
      await sendReply({
        email_account_id: latestEmail.account_id,
        to: [replyTo],
        subject,
        body_plain: reply.trim(),
        body_html: reply.trim().replace(/\n/g, '<br />'),
        thread_id: threadId,
        send_mode: 'instant',
      })
      setReply('')
      toast.success('Reply queued')
    } catch {
      toast.error('Failed to send reply')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="p-4 border-t-2">
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Type your reply..."
        className="w-full min-h-[80px] border-2 border-input bg-transparent p-3 text-sm resize-none focus:outline-none focus:border-ring"
      />
      <div className="flex justify-end mt-2">
        <Button size="sm" onClick={handleSend} disabled={!reply.trim() || isSending}>
          <SendIcon className="size-3.5" />
          {isSending ? 'Sending...' : 'Send Reply'}
        </Button>
      </div>
    </div>
  )
}
