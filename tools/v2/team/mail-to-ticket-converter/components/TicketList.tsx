import type { Ticket, TeamMember, FetchState, TicketStatus } from "../types";
import { TicketItem } from "./TicketItem";
import { FetchStateHandler } from "./FetchStateHandler";

interface TicketListProps {
  tickets: FetchState<Ticket[]>;
  teamMembers: FetchState<TeamMember[]>;
  onUpdateStatus: (ticketId: string, status: TicketStatus) => Promise<unknown>;
  onAssign: (ticketId: string, memberId: string) => Promise<unknown>;
  onRetry: () => void;
}

export function TicketList({
  tickets,
  teamMembers,
  onUpdateStatus,
  onAssign,
  onRetry,
}: TicketListProps) {
  const members = teamMembers.status === "success" ? teamMembers.data : [];

  return (
    <FetchStateHandler
      state={tickets}
      onRetry={onRetry}
      loadingMessage="Loading tickets..."
      emptyMessage="No tickets created yet."
      errorMessage="Failed to load tickets."
    >
      {(ticketList) => (
        <ul className="flex flex-col gap-2" role="list" aria-label="Ticket list">
          {ticketList.map((ticket) => (
            <li key={ticket.id} role="listitem">
              <TicketItem
                ticket={ticket}
                teamMembers={members}
                onUpdateStatus={onUpdateStatus}
                onAssign={onAssign}
              />
            </li>
          ))}
        </ul>
      )}
    </FetchStateHandler>
  );
}
