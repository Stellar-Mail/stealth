import React from "react";
import { FileText, Users, Clock, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SharedDraftEntryProps {
  id: string;
  title: string;
  lastModified: string;
  collaborators: number;
  subject?: string;
  isActive?: boolean;
  onEdit: (id: string) => void;
}

/**
 * SharedDraftEntry
 * Individual draft entry with keyboard/focus support
 *
 * Accessibility considerations:
 * - Semantic HTML with proper heading hierarchy
 * - Keyboard accessible edit button
 * - Focus indicator on interactive elements
 * - aria-label for icon-only buttons
 * - Logical tab order
 */
export const SharedDraftEntry: React.FC<SharedDraftEntryProps> = ({
  id,
  title,
  lastModified,
  collaborators,
  subject,
  isActive = false,
  onEdit,
}) => {
  return (
    <div
      className={`flex items-start gap-4 p-4 bg-white rounded-lg border transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 ${
        isActive ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:border-slate-300"
      }`}
      role="article"
      aria-label={`Draft: ${title}`}
    >
      <FileText className="h-5 w-5 text-slate-400 mt-1 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-slate-900 break-words">{title}</h3>
        {subject && <p className="text-sm text-slate-600 break-words">{subject}</p>}
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {new Date(lastModified).toLocaleDateString()}{" "}
            {new Date(lastModified).toLocaleTimeString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden="true" />
            {collaborators} collaborator{collaborators !== 1 ? "s" : ""}
          </span>
          {isActive && (
            <Badge variant="outline" className="text-blue-600">
              Active
            </Badge>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEdit(id)}
        className="text-slate-400 hover:text-blue-600 flex-shrink-0"
        aria-label={`Edit draft: ${title}`}
      >
        <Edit2 className="h-4 w-4" />
      </Button>
    </div>
  );
};
