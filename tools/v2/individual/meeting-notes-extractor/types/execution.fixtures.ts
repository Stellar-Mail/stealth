import type { MeetingNotesInput } from './execution';

export const successfulInput: MeetingNotesInput = {
  transcript: 'Team discussed Q3 roadmap. Alice will lead the API redesign. Bob to investigate performance issues. Decision: use PostgreSQL for new service.',
  title: 'Q3 Planning Meeting',
  date: '2026-07-19',
  attendees: ['alice@example.com', 'bob@example.com', 'carol@example.com'],
  format: 'markdown',
  extractActionItems: true,
  extractDecisions: true,
};

export const emptyTranscriptInput: MeetingNotesInput = {
  transcript: '',
  title: 'Empty Meeting',
  date: '2026-07-19',
  attendees: ['user@example.com'],
  format: 'plain-text',
  extractActionItems: false,
  extractDecisions: false,
};

export const minimalInput: MeetingNotesInput = {
  transcript: 'Standup: all clear.',
  title: 'Daily Standup',
  date: '2026-07-19',
  attendees: ['dev@example.com'],
  format: 'json',
  extractActionItems: false,
  extractDecisions: false,
};

export const noActionItemsInput: MeetingNotesInput = {
  transcript: 'Informational session on new policies. No decisions made.',
  title: 'Policy Briefing',
  date: '2026-07-19',
  attendees: ['hr@example.com'],
  format: 'markdown',
  extractActionItems: true,
  extractDecisions: true,
};

export const longTranscriptInput: MeetingNotesInput = {
  transcript: Array(100).fill('Discussion point with detailed technical analysis.').join(' '),
  title: 'Technical Deep Dive',
  date: '2026-07-19',
  attendees: ['engineering@example.com'],
  format: 'json',
  extractActionItems: true,
  extractDecisions: true,
};
