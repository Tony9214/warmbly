import { pollList } from '../lib/poll';

const DEAL_SAMPLE = {
  id: 'd1a2b3c4-0000-0000-0000-000000000000',
  organization_id: '00000000-0000-0000-0000-000000000000',
  pipeline_id: '00000000-0000-0000-0000-000000000001',
  stage_id: '00000000-0000-0000-0000-000000000002',
  contact_id: '7b6c1f2a-0000-0000-0000-000000000000',
  name: 'Example Co — annual',
  value: 12000,
  currency: 'USD',
  status: 'open',
  created_at: '2026-06-28T12:00:00Z',
  updated_at: '2026-06-28T12:00:00Z',
};

const DEAL_OUTPUT = [
  { key: 'id', label: 'Deal ID' },
  { key: 'name', label: 'Name' },
  { key: 'value', type: 'number', label: 'Value' },
  { key: 'currency', label: 'Currency' },
  { key: 'status', label: 'Status' },
  { key: 'pipeline_id', label: 'Pipeline ID' },
  { key: 'stage_id', label: 'Stage ID' },
  { key: 'contact_id', label: 'Contact ID' },
  { key: 'created_at', label: 'Created at' },
];

export const newDeal = {
  key: 'newDeal',
  noun: 'Deal',
  display: {
    label: 'New Deal',
    description: 'Triggers when a CRM deal is created.',
  },
  operation: {
    perform: pollList('/crm/deals'),
    sample: DEAL_SAMPLE,
    outputFields: DEAL_OUTPUT,
  },
};

export const dealWon = {
  key: 'dealWon',
  noun: 'Deal',
  display: {
    label: 'Deal Won',
    description: 'Triggers when a CRM deal is in the won state.',
  },
  operation: {
    perform: pollList('/crm/deals', { query: () => ({ status: 'won' }) }),
    sample: { ...DEAL_SAMPLE, status: 'won', won_at: '2026-06-28T13:00:00Z' },
    outputFields: DEAL_OUTPUT,
  },
};

const TASK_SAMPLE = {
  id: 'ta5b6c7d-0000-0000-0000-000000000000',
  organization_id: '00000000-0000-0000-0000-000000000000',
  title: 'Call Example Co',
  description: 'Discuss pilot',
  status: 'pending',
  priority: 'medium',
  type: 'Call',
  contact_id: '7b6c1f2a-0000-0000-0000-000000000000',
  due_date: '2026-06-30T09:00:00Z',
  created_at: '2026-06-28T12:00:00Z',
};

export const newCrmTask = {
  key: 'newCrmTask',
  noun: 'Task',
  display: {
    label: 'New CRM Task',
    description: 'Triggers when a CRM task is created.',
  },
  operation: {
    perform: pollList('/crm/tasks'),
    sample: TASK_SAMPLE,
    outputFields: [
      { key: 'id', label: 'Task ID' },
      { key: 'title', label: 'Title' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'type', label: 'Type' },
      { key: 'contact_id', label: 'Contact ID' },
      { key: 'deal_id', label: 'Deal ID' },
      { key: 'due_date', label: 'Due date' },
      { key: 'created_at', label: 'Created at' },
    ],
  },
};
