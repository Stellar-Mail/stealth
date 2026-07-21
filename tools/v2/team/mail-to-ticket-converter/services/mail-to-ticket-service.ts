import type {
  Email,
  Ticket,
  TeamMember,
  TicketMetrics,
  CreateTicketInput,
  TicketStatus,
  MailToTicketServiceConfig,
  IMailToTicketService,
} from "../types";

import sampleEmails from "../fixtures/sample-emails.json";
import sampleTickets from "../fixtures/sample-tickets.json";
import teamMembers from "../fixtures/team-members.json";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function computeMetrics(tickets: Ticket[]): TicketMetrics {
  const openTickets = tickets.filter((t) => t.status === "open").length;
  const inProgressTickets = tickets.filter((t) => t.status === "in-progress").length;
  const resolvedTickets = tickets.filter((t) => t.status === "resolved").length;
  const closedTickets = tickets.filter((t) => t.status === "closed").length;

  const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  const byCategory: Record<string, number> = {
    bug: 0,
    "feature-request": 0,
    support: 0,
    billing: 0,
    other: 0,
  };

  for (const t of tickets) {
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
  }

  const resolvedWithTime = tickets
    .filter((t) => t.status === "resolved" || t.status === "closed")
    .map((t) => {
      const created = new Date(t.createdAt).getTime();
      const updated = new Date(t.updatedAt).getTime();
      return (updated - created) / (1000 * 60 * 60);
    });

  const averageResolutionTimeHours =
    resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, v) => sum + v, 0) / resolvedWithTime.length
      : null;

  return {
    totalTickets: tickets.length,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    closedTickets,
    byPriority,
    byCategory,
    averageResolutionTimeHours,
  };
}

export function createMailToTicketService(
  config: MailToTicketServiceConfig = {},
): IMailToTicketService {
  const { simulateDelay = false, delayMs = 300, failureRate = 0 } = config;

  let emails: Email[] = [...(sampleEmails as Email[])];
  let tickets: Ticket[] = [...(sampleTickets as Ticket[])];
  const members: TeamMember[] = [...(teamMembers as TeamMember[])];

  async function maybeSimulate(): Promise<void> {
    if (simulateDelay) await delay(delayMs);
    if (Math.random() < failureRate) throw new Error("Simulated service failure");
  }

  return {
    async getEmails(): Promise<Email[]> {
      await maybeSimulate();
      return emails;
    },

    async getTickets(): Promise<Ticket[]> {
      await maybeSimulate();
      return tickets;
    },

    async getTeamMembers(): Promise<TeamMember[]> {
      await maybeSimulate();
      return members;
    },

    async convertEmailToTicket(emailId: string, input: CreateTicketInput): Promise<Ticket> {
      await maybeSimulate();

      const email = emails.find((e) => e.id === emailId);
      if (!email) throw new Error(`Email not found: ${emailId}`);

      const newTicket: Ticket = {
        id: generateId("ticket"),
        emailId,
        subject: input.subject,
        description: input.description,
        priority: input.priority,
        status: "open",
        category: input.category,
        assignedTo: input.assignedTo ?? null,
        createdBy: input.createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolution: null,
      };

      tickets = [...tickets, newTicket];
      emails = emails.filter((e) => e.id !== emailId);
      return newTicket;
    },

    async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<Ticket> {
      await maybeSimulate();

      const index = tickets.findIndex((t) => t.id === ticketId);
      if (index === -1) throw new Error(`Ticket not found: ${ticketId}`);

      const updated: Ticket = {
        ...tickets[index],
        status,
        updatedAt: new Date().toISOString(),
      };

      tickets = [...tickets.slice(0, index), updated, ...tickets.slice(index + 1)];
      return updated;
    },

    async assignTicket(ticketId: string, memberId: string): Promise<Ticket> {
      await maybeSimulate();

      const ticketIndex = tickets.findIndex((t) => t.id === ticketId);
      if (ticketIndex === -1) throw new Error(`Ticket not found: ${ticketId}`);

      const memberExists = members.some((m) => m.id === memberId);
      if (!memberExists) throw new Error(`Team member not found: ${memberId}`);

      const updated: Ticket = {
        ...tickets[ticketIndex],
        assignedTo: memberId,
        updatedAt: new Date().toISOString(),
      };

      tickets = [...tickets.slice(0, ticketIndex), updated, ...tickets.slice(ticketIndex + 1)];
      return updated;
    },

    async getMetrics(): Promise<TicketMetrics> {
      await maybeSimulate();
      return computeMetrics(tickets);
    },
  };
}

export { computeMetrics };
