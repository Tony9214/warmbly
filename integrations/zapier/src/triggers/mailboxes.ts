import { pollList } from '../lib/poll';

export const newMailbox = {
  key: 'newMailbox',
  noun: 'Mailbox',
  display: {
    label: 'New Mailbox Connected',
    description: 'Triggers when an email account (mailbox) is connected.',
  },
  operation: {
    perform: pollList('/emails'),
    sample: {
      id: 'eb1a2c3d-0000-0000-0000-000000000000',
      email: 'jane@acme.com',
      name: 'Jane Doe',
      provider: 'gmail',
      status: 'active',
      campaign_limit: 50,
      warmup_pool_type: 'premium',
      created_at: '2026-06-28T12:00:00Z',
    },
    outputFields: [
      { key: 'id', label: 'Mailbox ID' },
      { key: 'email', label: 'Email' },
      { key: 'name', label: 'Name' },
      { key: 'provider', label: 'Provider' },
      { key: 'status', label: 'Status' },
      { key: 'campaign_limit', type: 'integer', label: 'Daily campaign cap' },
      { key: 'created_at', label: 'Created at' },
    ],
  },
};
