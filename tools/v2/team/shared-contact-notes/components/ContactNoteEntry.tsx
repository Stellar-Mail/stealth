import { FileText, Clock, User, Archive, Trash2, Edit2 } from "lucide-react";
import { Button } from "../../../../../src/components/ui/button";
import { Badge } from "../../../../../src/components/ui/badge";
import type { Note } from "../types";

interface ContactNoteEntryProps {
  note: Note;
  onEdit: (note: Note) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ContactNoteEntry({ note, onEdit, onArchive, onDelete }: ContactNoteEntryProps) {
  const isArchived = note.archivedAt !== null;

  return (
    <article
      className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
        isArchived
          ? "bg-slate-50 border-slate-200 opacity-75"
          : "bg-white border-slate-200 hover:border-slate-300"
      }`}
      aria-label={`Note: ${note.content.slice(0, 60)}${note.content.length > 60 ? "..." : ""}`}
    >
      <FileText className="h-5 w-5 text-slate-400 mt-1 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-900 break-words leading-relaxed">{note.content}</p>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500 items-center">
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" aria-hidden="true" />
            {note.authorId}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <time dateTime={note.createdAt}>
              {new Date(note.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          </span>
          {isArchived && (
            <Badge variant="outline" className="text-slate-500 text-[10px]">
              Archived
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!isArchived && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(note)}
            className="text-slate-400 hover:text-blue-600 h-8 w-8 p-0"
            aria-label={`Edit note`}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {!isArchived && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onArchive(note.id)}
            className="text-slate-400 hover:text-amber-600 h-8 w-8 p-0"
            aria-label={`Archive note`}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(note.id)}
          className="text-slate-400 hover:text-red-600 h-8 w-8 p-0"
          aria-label={`Delete note`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </article>
  );
}
