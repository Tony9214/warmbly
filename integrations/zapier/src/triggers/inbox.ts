import { pollList } from '../lib/poll';

export const newInboundEmail = {
  key: 'newInboundEmail',
  noun: 'Email',
  display: {
    label: 'New Email Received',
    description:
      'Triggers on a new incoming email in the unified inbox, including replies to your campaigns. Requires Unibox (active trial or paid plan).',
  },
  operation: {
    perform: pollList('/unibox'),
    sample: {
      id: 'em1f2a3b-0000-0000-0000-000000000000',
      email_id: '00000000-0000-0000-0000-000000000000',
      thread_id: 'thread_abc',
      from_addr: ['lead@example.com'],
      to_addr: ['jane@acme.com'],
      subject: 'Re: quick question',
      snippet: 'Yes, let us set up a call...',
      internal_date: '2026-06-28T12:00:00Z',
      seen: false,
      message_count: 2,
      has_unread: true,
      labels: [],
    },
    outputFields: [
      { key: 'id', label: 'Message ID' },
      { key: 'email_id', label: 'Mailbox ID' },
      { key: 'thread_id', label: 'Thread ID' },
      { key: 'subject', label: 'Subject' },
      { key: 'snippet', label: 'Snippet' },
      { key: 'internal_date', label: 'Received at' },
      { key: 'seen', type: 'boolean', label: 'Seen' },
    ],
  },
};
