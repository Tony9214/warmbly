import { pollList } from '../lib/poll';

const CAMPAIGN_SAMPLE = {
  id: 'ca1b2c3d-0000-0000-0000-000000000000',
  name: 'Q3 Outbound',
  description: '',
  status: 'active',
  daily_limit: 50,
  timezone: 'America/New_York',
  created_at: '2026-06-28T12:00:00Z',
  updated_at: '2026-06-28T12:00:00Z',
};

const CAMPAIGN_OUTPUT = [
  { key: 'id', label: 'Campaign ID' },
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'daily_limit', type: 'integer', label: 'Daily limit' },
  { key: 'created_at', label: 'Created at' },
];

export const newCampaign = {
  key: 'newCampaign',
  noun: 'Campaign',
  display: {
    label: 'New Campaign',
    description: 'Triggers when a campaign is created.',
  },
  operation: {
    perform: pollList('/campaigns'),
    sample: CAMPAIGN_SAMPLE,
    outputFields: CAMPAIGN_OUTPUT,
  },
};

export const campaignCompleted = {
  key: 'campaignCompleted',
  noun: 'Campaign',
  display: {
    label: 'Campaign Completed',
    description: 'Triggers when a campaign reaches the completed state.',
  },
  operation: {
    // No status filter on the list endpoint; filter client-side. A campaign
    // completes once, so dedupe by id fires exactly once.
    perform: pollList('/campaigns', {
      filter: (c: any) => c.status === 'completed',
    }),
    sample: { ...CAMPAIGN_SAMPLE, status: 'completed' },
    outputFields: CAMPAIGN_OUTPUT,
  },
};
