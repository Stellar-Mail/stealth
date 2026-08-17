export type Priority = "low" | "medium" | "high" | "critical";

export type TicketStatus = "open" | "in-progress" | "resolved" | "closed";

export type TicketCategory = "bug" | "feature-request" | "support" | "billing" | "other";

export interface EmailSender {
  name: string;
  email: string;
}

export interface Email {
  id: string;
  threadId: string;
  from: EmailSender;
  to: EmailSender;
  subject: string;
  body: string;
  receivedAt: string;
  hasAttachments: boolean;
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  priority: Priority;
  category: TicketCategory;
  assignedTo?: string;
  createdBy: string;
}

export interface Ticket {
  id: string;
  emailId: string;
  subject: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  category: TicketCategory;
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  resolution: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface TicketMetrics {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  byPriority: Record<Priority, number>;
  byCategory: Record<TicketCategory, number>;
  averageResolutionTimeHours: number | null;
}

export interface MailToTicketServiceConfig {
  simulateDelay?: boolean;
  delayMs?: number;
  failureRate?: number;
}

export type FetchState<T> =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };

export interface IMailToTicketService {
  getEmails(): Promise<Email[]>;
  getTickets(): Promise<Ticket[]>;
  getTeamMembers(): Promise<TeamMember[]>;
  convertEmailToTicket(emailId: string, input: CreateTicketInput): Promise<Ticket>;
  updateTicketStatus(ticketId: string, status: TicketStatus): Promise<Ticket>;
  assignTicket(ticketId: string, memberId: string): Promise<Ticket>;
  getMetrics(): Promise<TicketMetrics>;
}
