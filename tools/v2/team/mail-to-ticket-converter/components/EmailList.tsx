import { useState } from "react";
import type { Email, FetchState, TeamMember, CreateTicketInput } from "../types";
import { TicketForm } from "./TicketForm";
import { FetchStateHandler } from "./FetchStateHandler";

interface EmailListProps {
  emails: FetchState<Email[]>;
  teamMembers: FetchState<TeamMember[]>;
  onConvert: (emailId: string, input: CreateTicketInput) => Promise<unknown>;
  onRetry: () => void;
}

export function EmailList({ emails, teamMembers, onConvert, onRetry }: EmailListProps) {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  if (selectedEmail) {
    return (
      <TicketForm
        email={selectedEmail}
        teamMembers={teamMembers}
        onSubmit={async (input) => {
          await onConvert(selectedEmail.id, input);
          setSelectedEmail(null);
        }}
        onCancel={() => setSelectedEmail(null)}
      />
    );
  }

  return (
    <FetchStateHandler
      state={emails}
      onRetry={onRetry}
      loadingMessage="Loading emails..."
      emptyMessage="No unconverted emails found."
      errorMessage="Failed to load emails."
    >
      {(emailList) => (
        <ul className="flex flex-col gap-2" role="list" aria-label="Email inbox">
          {emailList.map((email) => (
            <li
              key={email.id}
              role="listitem"
              className="rounded-lg border border-[--border-subtle] bg-[--surface-primary] p-3 transition-colors hover:border-[--accent]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[--text-primary]">
                    {email.subject}
                  </p>
                  <p className="text-xs text-[--text-secondary]">
                    {email.from.name} &lt;{email.from.email}&gt;
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-[--text-tertiary]">{email.body}</p>
                  <p className="mt-1 text-xs text-[--text-muted]">
                    {new Date(email.receivedAt).toLocaleString()}
                    {email.hasAttachments && <span className="ml-2 text-[--accent]">📎</span>}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEmail(email)}
                  className="shrink-0 rounded-md bg-[--accent] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
                  aria-label={`Convert ${email.subject} to ticket`}
                >
                  Convert
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </FetchStateHandler>
  );
}
