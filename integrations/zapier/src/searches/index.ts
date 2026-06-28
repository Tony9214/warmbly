import type { Bundle, ZObject } from '../types';
import { api, listData } from '../lib/client';

export const findContact = {
  key: 'findContact',
  noun: 'Contact',
  display: {
    label: 'Find Contact',
    description: 'Finds a contact by exact email address.',
  },
  operation: {
    inputFields: [
      { key: 'email', label: 'Email', type: 'string', required: true },
    ],
    perform: async (z: ZObject, bundle: Bundle): Promise<any[]> => {
      const response = await z.request({
        url: api('/contacts/lookup'),
        params: { email: bundle.inputData.email },
      });
      // Returns { contact: <Contact|null> }; normalize to a Zapier array.
      const contact = response.data && response.data.contact;
      return contact ? [contact] : [];
    },
    sample: {
      id: '7b6c1f2a-0000-0000-0000-000000000000',
      email: 'lead@example.com',
      first_name: 'Sam',
      last_name: 'Rivera',
      company: 'Example Co',
      subscribed: true,
      created_at: '2026-06-28T12:00:00Z',
    },
  },
};

export const findCampaign = {
  key: 'findCampaign',
  noun: 'Campaign',
  display: {
    label: 'Find Campaign',
    description: 'Finds a campaign by name.',
  },
  operation: {
    inputFields: [
      { key: 'query', label: 'Name contains', type: 'string', required: true },
    ],
    perform: async (z: ZObject, bundle: Bundle): Promise<any[]> => {
      const response = await z.request({
        url: api('/campaigns'),
        params: { q: bundle.inputData.query, limit: 25 },
      });
      return listData(response);
    },
    sample: {
      id: 'ca1b2c3d-0000-0000-0000-000000000000',
      name: 'Q3 Outbound',
      status: 'active',
      created_at: '2026-06-28T12:00:00Z',
    },
  },
};

export const findMailbox = {
  key: 'findMailbox',
  noun: 'Mailbox',
  display: {
    label: 'Find Mailbox',
    description: 'Finds a connected mailbox by email or name.',
  },
  operation: {
    inputFields: [
      { key: 'query', label: 'Email or name contains', type: 'string', required: true },
    ],
    perform: async (z: ZObject, bundle: Bundle): Promise<any[]> => {
      const response = await z.request({
        url: api('/emails'),
        params: { q: bundle.inputData.query, limit: 25 },
      });
      return listData(response);
    },
    sample: {
      id: 'eb1a2c3d-0000-0000-0000-000000000000',
      email: 'jane@acme.com',
      name: 'Jane Doe',
      provider: 'gmail',
      status: 'active',
    },
  },
};

export const findTemplate = {
  key: 'findTemplate',
  noun: 'Template',
  display: {
    label: 'Find Reply Template',
    description: 'Finds a reply template by name or subject.',
  },
  operation: {
    inputFields: [
      { key: 'query', label: 'Name or subject contains', type: 'string', required: true },
    ],
    perform: async (z: ZObject, bundle: Bundle): Promise<any[]> => {
      const response = await z.request({
        url: api('/templates'),
        params: { q: bundle.inputData.query },
      });
      return listData(response);
    },
    sample: {
      id: 'tp1a2b3c-0000-0000-0000-000000000000',
      name: 'Follow up',
      subject: 'Following up',
      position: 1,
    },
  },
};
