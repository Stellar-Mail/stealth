import { Plus } from "lucide-react";
import { Button } from "../../../../../src/components/ui/button";
import { ContactNoteEntry } from "./ContactNoteEntry";
import type { Note } from "../types";

interface ContactNotesListProps {
  notes: Note[];
  onCreateNote: () => void;
  onEdit: (note: Note) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ContactNotesList({
  notes,
  onCreateNote,
  onEdit,
  onArchive,
  onDelete,
}: ContactNotesListProps) {
  const activeNotes = notes.filter((n) => n.archivedAt === null);
  const archivedNotes = notes.filter((n) => n.archivedAt !== null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Notes
            {notes.length > 0 && (
              <span className="text-sm font-normal text-slate-500 ml-2">({notes.length})</span>
            )}
          </h2>
          <p className="text-sm text-slate-500 mt-1">Shared context visible to all team members</p>
        </div>
        <Button onClick={onCreateNote} aria-label="Add a new note">
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          Add Note
        </Button>
      </div>

      {activeNotes.length > 0 && (
        <div className="space-y-2" role="list" aria-label="Active notes">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active</h3>
          {activeNotes.map((note) => (
            <div key={note.id} role="listitem">
              <ContactNoteEntry
                note={note}
                onEdit={onEdit}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      )}

      {archivedNotes.length > 0 && (
        <div className="space-y-2" role="list" aria-label="Archived notes">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider pt-2 border-t border-slate-100">
            Archived
          </h3>
          {archivedNotes.map((note) => (
            <div key={note.id} role="listitem">
              <ContactNoteEntry
                note={note}
                onEdit={onEdit}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
