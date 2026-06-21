export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface MailToTicketInput {
  subject: string;
  body: string;
  from: string;
  to?: string[];
  cc?: string[];
  attachmentNames?: string[];
  teamId?: string;
  requestedPriority?: TicketPriority;
}

export interface SanitizedMailToTicketInput {
  subject: string;
  body: string;
  from: string;
  to: string[];
  cc: string[];
  attachmentNames: string[];
  teamId: string | null;
  requestedPriority: TicketPriority;
  warnings: string[];
}

export interface MailToTicketGuardOptions {
  maxSubjectLength: number;
  maxBodyLength: number;
  maxRecipients: number;
  maxAttachments: number;
  maxAttachmentNameLength: number;
}

export interface MailToTicketGuardResult {
  ok: boolean;
  value?: SanitizedMailToTicketInput;
  errors: string[];
}
