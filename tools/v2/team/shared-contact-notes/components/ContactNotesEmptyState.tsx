import { FileText } from "lucide-react";
import { Button } from "../../../../../src/components/ui/button";

interface ContactNotesEmptyStateProps {
  onCreateNote: () => void;
}

export function ContactNotesEmptyState({ onCreateNote }: ContactNotesEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-64 bg-slate-50 rounded-lg border border-slate-200 p-8"
      role="status"
      aria-live="polite"
      aria-label="No contact notes"
    >
      <FileText className="w-12 h-12 text-slate-400 mb-4" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-slate-900 mb-2">No shared notes</h2>
      <p className="text-slate-600 text-center max-w-sm mb-6">
        No notes have been added for this contact yet. Create one to share context with your team.
      </p>
      <Button onClick={onCreateNote} aria-label="Add a new contact note">
        Add Note
      </Button>
    </div>
  );
}
