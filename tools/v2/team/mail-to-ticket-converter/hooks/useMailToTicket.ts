import { useReducer, useCallback, useRef, useEffect } from "react";
import type {
  Email,
  Ticket,
  TeamMember,
  TicketMetrics,
  CreateTicketInput,
  TicketStatus,
  FetchState,
} from "../types";
import type { IMailToTicketService } from "../types";
import { createMailToTicketService } from "../services/mail-to-ticket-service";

interface MailToTicketState {
  emails: FetchState<Email[]>;
  tickets: FetchState<Ticket[]>;
  teamMembers: FetchState<TeamMember[]>;
  metrics: FetchState<TicketMetrics>;
}

type Action =
  | { type: "LOAD_EMAILS_START" }
  | { type: "LOAD_EMAILS_SUCCESS"; data: Email[] }
  | { type: "LOAD_EMAILS_ERROR"; message: string }
  | { type: "LOAD_TICKETS_START" }
  | { type: "LOAD_TICKETS_SUCCESS"; data: Ticket[] }
  | { type: "LOAD_TICKETS_ERROR"; message: string }
  | { type: "LOAD_MEMBERS_START" }
  | { type: "LOAD_MEMBERS_SUCCESS"; data: TeamMember[] }
  | { type: "LOAD_MEMBERS_ERROR"; message: string }
  | { type: "LOAD_METRICS_START" }
  | { type: "LOAD_METRICS_SUCCESS"; data: TicketMetrics }
  | { type: "LOAD_METRICS_ERROR"; message: string };

const initialState: MailToTicketState = {
  emails: { status: "loading" },
  tickets: { status: "loading" },
  teamMembers: { status: "loading" },
  metrics: { status: "loading" },
};

function reducer(state: MailToTicketState, action: Action): MailToTicketState {
  switch (action.type) {
    case "LOAD_EMAILS_START":
      return { ...state, emails: { status: "loading" } };
    case "LOAD_EMAILS_SUCCESS":
      return {
        ...state,
        emails:
          action.data.length === 0 ? { status: "empty" } : { status: "success", data: action.data },
      };
    case "LOAD_EMAILS_ERROR":
      return { ...state, emails: { status: "error", message: action.message } };
    case "LOAD_TICKETS_START":
      return { ...state, tickets: { status: "loading" } };
    case "LOAD_TICKETS_SUCCESS":
      return {
        ...state,
        tickets:
          action.data.length === 0 ? { status: "empty" } : { status: "success", data: action.data },
      };
    case "LOAD_TICKETS_ERROR":
      return { ...state, tickets: { status: "error", message: action.message } };
    case "LOAD_MEMBERS_START":
      return { ...state, teamMembers: { status: "loading" } };
    case "LOAD_MEMBERS_SUCCESS":
      return {
        ...state,
        teamMembers:
          action.data.length === 0 ? { status: "empty" } : { status: "success", data: action.data },
      };
    case "LOAD_MEMBERS_ERROR":
      return { ...state, teamMembers: { status: "error", message: action.message } };
    case "LOAD_METRICS_START":
      return { ...state, metrics: { status: "loading" } };
    case "LOAD_METRICS_SUCCESS":
      return { ...state, metrics: { status: "success", data: action.data } };
    case "LOAD_METRICS_ERROR":
      return { ...state, metrics: { status: "error", message: action.message } };
    default:
      return state;
  }
}

export interface UseMailToTicketReturn {
  emails: FetchState<Email[]>;
  tickets: FetchState<Ticket[]>;
  teamMembers: FetchState<TeamMember[]>;
  metrics: FetchState<TicketMetrics>;
  load: () => Promise<void>;
  convertEmail: (emailId: string, input: CreateTicketInput) => Promise<Ticket>;
  updateStatus: (ticketId: string, status: TicketStatus) => Promise<Ticket>;
  assignTicket: (ticketId: string, memberId: string) => Promise<Ticket>;
  retry: () => void;
}

export function useMailToTicket(
  service: IMailToTicketService = createMailToTicketService(),
): UseMailToTicketReturn {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef(false);

  const load = useCallback(async () => {
    abortRef.current = false;

    dispatch({ type: "LOAD_EMAILS_START" });
    dispatch({ type: "LOAD_TICKETS_START" });
    dispatch({ type: "LOAD_MEMBERS_START" });
    dispatch({ type: "LOAD_METRICS_START" });

    try {
      const emailsResult = service.getEmails();
      const ticketsResult = service.getTickets();
      const membersResult = service.getTeamMembers();
      const metricsResult = service.getMetrics();

      const [emails, tickets, members, metrics] = await Promise.all([
        emailsResult,
        ticketsResult,
        membersResult,
        metricsResult,
      ]);

      if (abortRef.current) return;

      dispatch({ type: "LOAD_EMAILS_SUCCESS", data: emails });
      dispatch({ type: "LOAD_TICKETS_SUCCESS", data: tickets });
      dispatch({ type: "LOAD_MEMBERS_SUCCESS", data: members });
      dispatch({ type: "LOAD_METRICS_SUCCESS", data: metrics });
    } catch (err) {
      if (abortRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load data";
      dispatch({ type: "LOAD_EMAILS_ERROR", message });
      dispatch({ type: "LOAD_TICKETS_ERROR", message });
      dispatch({ type: "LOAD_MEMBERS_ERROR", message });
      dispatch({ type: "LOAD_METRICS_ERROR", message });
    }
  }, [service]);

  const convertEmail = useCallback(
    async (emailId: string, input: CreateTicketInput): Promise<Ticket> => {
      const ticket = await service.convertEmailToTicket(emailId, input);
      await load();
      return ticket;
    },
    [service, load],
  );

  const updateStatus = useCallback(
    async (ticketId: string, status: TicketStatus): Promise<Ticket> => {
      const ticket = await service.updateTicketStatus(ticketId, status);
      await load();
      return ticket;
    },
    [service, load],
  );

  const assignTicket = useCallback(
    async (ticketId: string, memberId: string): Promise<Ticket> => {
      const ticket = await service.assignTicket(ticketId, memberId);
      await load();
      return ticket;
    },
    [service, load],
  );

  useEffect(() => {
    load();
    return () => {
      abortRef.current = true;
    };
  }, [load]);

  return {
    emails: state.emails,
    tickets: state.tickets,
    teamMembers: state.teamMembers,
    metrics: state.metrics,
    load,
    convertEmail,
    updateStatus,
    assignTicket,
    retry: load,
  };
}
