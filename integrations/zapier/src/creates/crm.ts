import type { Bundle, ZObject } from '../types';
import { api, pruneEmpty } from '../lib/client';

const DEAL_SAMPLE = {
  id: 'd1a2b3c4-0000-0000-0000-000000000000',
  pipeline_id: '00000000-0000-0000-0000-000000000001',
  stage_id: '00000000-0000-0000-0000-000000000002',
  name: 'Example Co — annual',
  value: 12000,
  currency: 'USD',
  status: 'open',
  created_at: '2026-06-28T12:00:00Z',
  updated_at: '2026-06-28T12:00:00Z',
};

export const createDeal = {
  key: 'createDeal',
  noun: 'Deal',
  display: {
    label: 'Create Deal',
    description: 'Creates a CRM deal in a pipeline stage.',
  },
  operation: {
    inputFields: [
      {
        key: 'pipeline_id',
        label: 'Pipeline',
        type: 'string',
        required: true,
        dynamic: 'pipelineList.id.name',
        altersDynamicFields: true,
      },
      {
        key: 'stage_id',
        label: 'Stage',
        type: 'string',
        required: true,
        dynamic: 'stageList.id.name',
      },
      { key: 'name', label: 'Name', type: 'string', required: true },
      { key: 'value', label: 'Value', type: 'number' },
      { key: 'currency', label: 'Currency', type: 'string', helpText: 'ISO code, e.g. USD.' },
      { key: 'contact_id', label: 'Contact ID', type: 'string' },
      { key: 'expected_close_date', label: 'Expected close date', type: 'datetime' },
      { key: 'assigned_to', label: 'Owner (user ID)', type: 'string' },
    ],
    perform: async (z: ZObject, bundle: Bundle) => {
      const body = pruneEmpty({
        pipeline_id: bundle.inputData.pipeline_id,
        stage_id: bundle.inputData.stage_id,
        name: bundle.inputData.name,
        value: bundle.inputData.value,
        currency: bundle.inputData.currency,
        contact_id: bundle.inputData.contact_id,
        expected_close_date: bundle.inputData.expected_close_date,
        assigned_to: bundle.inputData.assigned_to,
      });
      const response = await z.request({
        url: api('/crm/deals'),
        method: 'POST',
        body,
      });
      return response.data;
    },
    sample: DEAL_SAMPLE,
  },
};

export const updateDeal = {
  key: 'updateDeal',
  noun: 'Deal',
  display: {
    label: 'Update Deal',
    description:
      'Updates a CRM deal: move stages, change value, or mark it won/lost.',
  },
  operation: {
    inputFields: [
      { key: 'deal_id', label: 'Deal ID', type: 'string', required: true },
      {
        key: 'pipeline_id',
        label: 'Pipeline (for stage picker)',
        type: 'string',
        dynamic: 'pipelineList.id.name',
        altersDynamicFields: true,
        helpText: 'Optional: pick the pipeline to populate the stage dropdown.',
      },
      { key: 'stage_id', label: 'Stage', type: 'string', dynamic: 'stageList.id.name' },
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'value', label: 'Value', type: 'number' },
      { key: 'currency', label: 'Currency', type: 'string' },
      {
        key: 'status',
        label: 'Status',
        type: 'string',
        choices: { open: 'Open', won: 'Won', lost: 'Lost' },
      },
      { key: 'lost_reason', label: 'Lost reason', type: 'string' },
      { key: 'expected_close_date', label: 'Expected close date', type: 'datetime' },
      { key: 'assigned_to', label: 'Owner (user ID)', type: 'string' },
    ],
    perform: async (z: ZObject, bundle: Bundle) => {
      const body = pruneEmpty({
        stage_id: bundle.inputData.stage_id,
        name: bundle.inputData.name,
        value: bundle.inputData.value,
        currency: bundle.inputData.currency,
        status: bundle.inputData.status,
        lost_reason: bundle.inputData.lost_reason,
        expected_close_date: bundle.inputData.expected_close_date,
        assigned_to: bundle.inputData.assigned_to,
      });
      const response = await z.request({
        url: api(`/crm/deals/${bundle.inputData.deal_id}`),
        method: 'PATCH',
        body,
      });
      return response.data;
    },
    sample: DEAL_SAMPLE,
  },
};

export const createCrmTask = {
  key: 'createCrmTask',
  noun: 'Task',
  display: {
    label: 'Create CRM Task',
    description: 'Creates a CRM task, optionally linked to a contact or deal.',
  },
  operation: {
    inputFields: [
      { key: 'title', label: 'Title', type: 'string', required: true },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'contact_id', label: 'Contact ID', type: 'string' },
      { key: 'deal_id', label: 'Deal ID', type: 'string' },
      { key: 'assigned_to', label: 'Assignee (user ID)', type: 'string' },
      { key: 'due_date', label: 'Due date', type: 'datetime' },
      {
        key: 'priority',
        label: 'Priority',
        type: 'string',
        choices: { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' },
      },
      { key: 'type', label: 'Type', type: 'string', helpText: 'e.g. Call, Email, Meeting.' },
    ],
    perform: async (z: ZObject, bundle: Bundle) => {
      const body = pruneEmpty({
        title: bundle.inputData.title,
        description: bundle.inputData.description,
        contact_id: bundle.inputData.contact_id,
        deal_id: bundle.inputData.deal_id,
        assigned_to: bundle.inputData.assigned_to,
        due_date: bundle.inputData.due_date,
        priority: bundle.inputData.priority,
        type: bundle.inputData.type,
      });
      const response = await z.request({
        url: api('/crm/tasks'),
        method: 'POST',
        body,
      });
      return response.data;
    },
    sample: {
      id: 'ta5b6c7d-0000-0000-0000-000000000000',
      title: 'Call Example Co',
      status: 'pending',
      priority: 'medium',
      type: 'Call',
      created_at: '2026-06-28T12:00:00Z',
    },
  },
};
