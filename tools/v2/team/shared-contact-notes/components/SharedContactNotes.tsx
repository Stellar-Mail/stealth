import { useState, useCallback } from "react";
import { NoteService } from "../service";
import { seedNotes } from "../fixtures/notes";
import { ContactNotesLoadingState } from "./ContactNotesLoadingState";
import { ContactNotesErrorState } from "./ContactNotesErrorState";
import { ContactNotesEmptyState } from "./ContactNotesEmptyState";
import { ContactNotesList } from "./ContactNotesList";
import { ContactNoteForm } from "./ContactNoteForm";
import { useContactNotes } from "../hooks/useContactNotes";
import type { Note } from "../types";

interface SharedContactNotesProps {
  contactId: string;
  authorId?: string;
  service?: NoteService;
}

type ViewMode = "list" | "create" | "edit";

export function SharedContactNotes({
  contactId,
  authorId = "user-current",
  service: externalService,
}: SharedContactNotesProps) {
  const [service] = useState(() => externalService ?? new NoteService(seedNotes, { delayMs: 600 }));
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { status, notes, error, loadNotes, createNote, updateNote, deleteNote, archiveNote } =
    useContactNotes(contactId, service, true);

  const handleCreateNote = useCallback(() => {
    setViewMode("create");
    setEditingNote(null);
  }, []);

  const handleEditNote = useCallback((note: Note) => {
    setEditingNote(note);
    setViewMode("edit");
  }, []);

  const handleCancelForm = useCallback(() => {
    setViewMode("list");
    setEditingNote(null);
  }, []);

  const handleSubmitForm = useCallback(
    async (content: string) => {
      setIsSubmitting(true);
      try {
        if (viewMode === "edit" && editingNote) {
          await updateNote(editingNote.id, { content });
        } else {
          await createNote({ content, authorId });
        }
        setViewMode("list");
        setEditingNote(null);
      } finally {
        setIsSubmitting(false);
      }
    },
    [viewMode, editingNote, updateNote, createNote, authorId],
  );

  const handleArchive = useCallback(
    async (id: string) => {
      await archiveNote(id);
    },
    [archiveNote],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteNote(id);
    },
    [deleteNote],
  );

  const handleRetry = useCallback(() => {
    loadNotes();
  }, [loadNotes]);

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-white rounded-lg">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Shared Contact Notes</h1>
        <p className="text-slate-600 text-sm mt-1">Add and manage shared notes for this contact</p>
      </header>

      <main role="main" className="space-y-4">
        {viewMode !== "list" && (
          <ContactNoteForm
            initialContent={editingNote?.content ?? ""}
            onSubmit={handleSubmitForm}
            onCancel={handleCancelForm}
            isSubmitting={isSubmitting}
          />
        )}

        {status === "loading" && <ContactNotesLoadingState />}
        {status === "error" && (
          <ContactNotesErrorState
            message={error?.message ?? "An unexpected error occurred"}
            onRetry={handleRetry}
          />
        )}
        {status === "success" && notes.length === 0 && viewMode === "list" && (
          <ContactNotesEmptyState onCreateNote={handleCreateNote} />
        )}
        {status === "success" && notes.length > 0 && (
          <ContactNotesList
            notes={notes}
            onCreateNote={handleCreateNote}
            onEdit={handleEditNote}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        )}
      </main>
    </div>
  );
}
