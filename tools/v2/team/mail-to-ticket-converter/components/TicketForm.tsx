import { useState } from "react";
import type {
  Email,
  TeamMember,
  FetchState,
  CreateTicketInput,
  Priority,
  TicketCategory,
} from "../types";

interface TicketFormProps {
  email: Email;
  teamMembers: FetchState<TeamMember[]>;
  onSubmit: (input: CreateTicketInput) => Promise<void>;
  onCancel: () => void;
}

const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];
const CATEGORIES: TicketCategory[] = ["bug", "feature-request", "support", "billing", "other"];

export function TicketForm({ email, teamMembers, onSubmit, onCancel }: TicketFormProps) {
  const [subject, setSubject] = useState(email.subject);
  const [description, setDescription] = useState(email.body);
  const [priority, setPriority] = useState<Priority>("medium");
  const [category, setCategory] = useState<TicketCategory>("support");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const membersData = teamMembers.status === "success" ? teamMembers.data : [];

      await onSubmit({
        subject,
        description,
        priority,
        category,
        assignedTo: assignedTo || undefined,
        createdBy: membersData[0]?.id ?? "unknown",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-[--border-subtle] bg-[--surface-primary] p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[--text-primary]">New Ticket</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[--text-secondary] hover:text-[--text-primary]"
          aria-label="Cancel ticket creation"
        >
          Back
        </button>
      </div>

      <p className="text-xs text-[--text-muted]">
        From: {email.from.name} &lt;{email.from.email}&gt;
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[--text-secondary]">Subject</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className="rounded-md border border-[--border-subtle] bg-[--surface-secondary] px-3 py-2 text-sm text-[--text-primary] outline-none focus:border-[--accent]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[--text-secondary]">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          className="rounded-md border border-[--border-subtle] bg-[--surface-secondary] px-3 py-2 text-sm text-[--text-primary] outline-none focus:border-[--accent] resize-y"
        />
      </label>

      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-[--text-secondary]">Priority</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="rounded-md border border-[--border-subtle] bg-[--surface-secondary] px-3 py-2 text-sm text-[--text-primary] outline-none focus:border-[--accent]"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-[--text-secondary]">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
            className="rounded-md border border-[--border-subtle] bg-[--surface-secondary] px-3 py-2 text-sm text-[--text-primary] outline-none focus:border-[--accent]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1).replace("-", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[--text-secondary]">Assign to (optional)</span>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="rounded-md border border-[--border-subtle] bg-[--surface-secondary] px-3 py-2 text-sm text-[--text-primary] outline-none focus:border-[--accent]"
        >
          <option value="">Unassigned</option>
          {teamMembers.status === "success" &&
            teamMembers.data.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
      </label>

      {error && (
        <div role="alert" className="rounded-md bg-red-900/20 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[--border-subtle] px-4 py-2 text-sm text-[--text-secondary] hover:text-[--text-primary]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-[--accent] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          aria-busy={submitting}
        >
          {submitting ? "Creating..." : "Create Ticket"}
        </button>
      </div>
    </form>
  );
}
