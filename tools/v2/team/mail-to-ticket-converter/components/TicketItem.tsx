import { useState } from "react";
import type { Ticket, TeamMember, TicketStatus } from "../types";

interface TicketItemProps {
  ticket: Ticket;
  teamMembers: TeamMember[];
  onUpdateStatus: (ticketId: string, status: TicketStatus) => Promise<unknown>;
  onAssign: (ticketId: string, memberId: string) => Promise<unknown>;
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: "bg-yellow-500/20 text-yellow-400",
  "in-progress": "bg-blue-500/20 text-blue-400",
  resolved: "bg-green-500/20 text-green-400",
  closed: "bg-gray-500/20 text-gray-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

const NEXT_STATUS: Record<TicketStatus, TicketStatus> = {
  open: "in-progress",
  "in-progress": "resolved",
  resolved: "closed",
  closed: "open",
};

export function TicketItem({ ticket, teamMembers, onUpdateStatus, onAssign }: TicketItemProps) {
  const [assigning, setAssigning] = useState(false);

  const assignedMember = ticket.assignedTo
    ? teamMembers.find((m) => m.id === ticket.assignedTo)
    : null;

  const handleStatusChange = async () => {
    const next = NEXT_STATUS[ticket.status];
    await onUpdateStatus(ticket.id, next);
  };

  const handleAssign = async (memberId: string) => {
    setAssigning(true);
    await onAssign(ticket.id, memberId);
    setAssigning(false);
  };

  return (
    <div className="rounded-lg border border-[--border-subtle] bg-[--surface-primary] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-[--text-primary]">{ticket.subject}</p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[ticket.status]}`}
            >
              {ticket.status}
            </span>
            <span
              className={`shrink-0 text-[10px] font-medium ${PRIORITY_COLORS[ticket.priority]}`}
            >
              {ticket.priority}
            </span>
          </div>

          <p className="mt-1 line-clamp-2 text-xs text-[--text-tertiary]">{ticket.description}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[--text-muted]">
            <span>Category: {ticket.category}</span>
            <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
            {ticket.resolution && (
              <span title={ticket.resolution}>
                Resolution:{" "}
                {ticket.resolution.length > 40
                  ? ticket.resolution.slice(0, 40) + "..."
                  : ticket.resolution}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          {ticket.status !== "closed" && (
            <button
              onClick={handleStatusChange}
              className="rounded-md border border-[--border-subtle] px-2.5 py-1 text-[10px] font-medium text-[--text-secondary] hover:text-[--text-primary] transition-colors"
              aria-label={`Move ticket to ${NEXT_STATUS[ticket.status]}`}
            >
              {NEXT_STATUS[ticket.status] === "closed"
                ? "Reopen"
                : `→ ${NEXT_STATUS[ticket.status]}`}
            </button>
          )}

          {teamMembers.length > 0 && (
            <>
              <label className="sr-only" htmlFor={`assign-${ticket.id}`}>
                Assign ticket
              </label>
              <select
                id={`assign-${ticket.id}`}
                value={ticket.assignedTo ?? ""}
                onChange={(e) => handleAssign(e.target.value)}
                disabled={assigning}
                className="rounded-md border border-[--border-subtle] bg-[--surface-secondary] px-2 py-1 text-[10px] text-[--text-primary] outline-none"
                aria-label="Assign to team member"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {assignedMember && (
        <p className="mt-2 text-[10px] text-[--accent]">Assigned to: {assignedMember.name}</p>
      )}
    </div>
  );
}
