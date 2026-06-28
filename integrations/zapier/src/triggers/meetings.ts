import { pollList } from '../lib/poll';

export const newMeeting = {
  key: 'newMeeting',
  noun: 'Meeting',
  display: {
    label: 'New Meeting Booked',
    description:
      'Triggers when a meeting is booked through a connected scheduler (Calendly, Cal.com).',
  },
  operation: {
    perform: pollList('/meetings'),
    sample: {
      id: 'mb1c2d3e-0000-0000-0000-000000000000',
      organization_id: '00000000-0000-0000-0000-000000000000',
      source: 'calendly',
      status: 'booked',
      invitee_email: 'lead@example.com',
      invitee_name: 'Sam Rivera',
      event_name: 'Intro call',
      scheduled_for: '2026-07-01T15:00:00Z',
      join_url: 'https://meet.example.com/abc',
      contact_id: '7b6c1f2a-0000-0000-0000-000000000000',
      created_at: '2026-06-28T12:00:00Z',
    },
    outputFields: [
      { key: 'id', label: 'Booking ID' },
      { key: 'source', label: 'Source' },
      { key: 'status', label: 'Status' },
      { key: 'invitee_email', label: 'Invitee email' },
      { key: 'invitee_name', label: 'Invitee name' },
      { key: 'event_name', label: 'Event name' },
      { key: 'scheduled_for', label: 'Scheduled for' },
      { key: 'join_url', label: 'Join URL' },
      { key: 'contact_id', label: 'Contact ID' },
    ],
  },
};
