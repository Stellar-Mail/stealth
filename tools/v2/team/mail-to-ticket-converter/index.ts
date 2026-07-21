export type {
  Email,
  EmailSender,
  Ticket,
  TicketMetrics,
  TeamMember,
  CreateTicketInput,
  FetchState,
  TicketStatus,
  TicketCategory,
  Priority,
  MailToTicketServiceConfig,
  IMailToTicketService,
} from "./types";

export { createMailToTicketService, computeMetrics } from "./services/mail-to-ticket-service";
export { useMailToTicket } from "./hooks/useMailToTicket";
export { MailToTicketConverter } from "./components/MailToTicketConverter";
