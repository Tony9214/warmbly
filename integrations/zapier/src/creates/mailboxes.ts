import type { Bundle, ZObject } from '../types';
import { api } from '../lib/client';

export const deleteMailbox = {
  key: 'deleteMailbox',
  noun: 'Mailbox',
  display: {
    label: 'Delete Mailbox',
    description:
      'Permanently disconnects and deletes an email account. This stops all warmup and campaign sending from it and is irreversible. Use with care.',
  },
  operation: {
    inputFields: [
      {
        key: 'email_account_id',
        label: 'Mailbox',
        type: 'string',
        required: true,
        dynamic: 'mailboxList.id.email',
      },
    ],
    perform: async (z: ZObject, bundle: Bundle) => {
      await z.request({
        url: api(`/emails/${bundle.inputData.email_account_id}`),
        method: 'DELETE',
      });
      return { id: bundle.inputData.email_account_id, success: true };
    },
    sample: { id: 'eb1a2c3d-0000-0000-0000-000000000000', success: true },
  },
};
