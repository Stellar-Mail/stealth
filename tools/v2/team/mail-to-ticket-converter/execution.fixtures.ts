import type { MailToTicketInput } from './execution';

export const successfulInput: MailToTicketInput = {
  emailId: 'email-001',
  subject: 'Login page not loading',
  description: 'Users report that the login page shows a white screen after entering credentials.',
  priority: 'high',
  category: 'bug',
  assignedTo: 'member-1',
  createdBy: 'support@example.com',
};

export const missingEmailIdInput: MailToTicketInput = {
  emailId: '',
  subject: 'Test ticket',
  description: 'Description',
  priority: 'medium',
  category: 'support',
  createdBy: 'user@example.com',
};

export const invalidPriorityInput: MailToTicketInput = {
  emailId: 'email-002',
  subject: 'Feature request',
  description: 'Add dark mode support',
  priority: 'urgent' as any,
  category: 'feature-request',
  createdBy: 'user@example.com',
};

export const missingCreatedByInput: MailToTicketInput = {
  emailId: 'email-003',
  subject: 'Billing question',
  description: 'Need invoice clarification',
  priority: 'low',
  category: 'billing',
  createdBy: '',
};

export const unassignedInput: MailToTicketInput = {
  emailId: 'email-004',
  subject: 'General inquiry',
  description: 'How do I reset my password?',
  priority: 'low',
  category: 'support',
  createdBy: 'user@example.com',
};

export const criticalBugInput: MailToTicketInput = {
  emailId: 'email-005',
  subject: 'Payment gateway down',
  description: 'All payments are failing with 500 errors since 10:00 AM UTC.',
  priority: 'critical',
  category: 'bug',
  assignedTo: 'member-2',
  createdBy: 'ops@example.com',
};
