import { useState, useRef, useEffect } from "react";
import { Send, X } from "lucide-react";
import { Button } from "../../../../../src/components/ui/button";

interface ContactNoteFormProps {
  initialContent?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function ContactNoteForm({
  initialContent = "",
  onSubmit,
  onCancel,
  isSubmitting,
}: ContactNoteFormProps) {
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();

    if (!trimmed) {
      setError("Note content cannot be empty");
      return;
    }

    setError("");
    onSubmit(trimmed).catch(() => {
      setError("Failed to save note. Please try again.");
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg border border-slate-200 p-4 space-y-3"
      aria-label="Add or edit note"
    >
      <div className="space-y-1">
        <label htmlFor="note-content" className="text-sm font-medium text-slate-700">
          Note
        </label>
        <textarea
          id="note-content"
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError("");
          }}
          placeholder="Add a note about this contact..."
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "note-error" : undefined}
          disabled={isSubmitting}
        />
        {error && (
          <p id="note-error" className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || !content.trim()}
          aria-label="Save note"
        >
          <Send className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
