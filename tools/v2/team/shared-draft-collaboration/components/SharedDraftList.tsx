import React from "react";
import { Button } from "../../../src/components/ui/button";
import { SharedDraftEntry } from "./SharedDraftEntry";

interface SharedDraftData {
  id: string;
  title: string;
  lastModified: string;
  collaborators: number;
  subject?: string;
  isActive?: boolean;
}

interface SharedDraftListProps {
  drafts: SharedDraftData[];
  onEdit: (id: string) => void;
  onCreateNew: () => void;
}

/**
 * SharedDraftList
 * Main list component displaying shared drafts (success state)
 *
 * Accessibility considerations:
 * - Semantic list structure
 * - aria-label for list context
 * - Proper heading hierarchy
 * - Keyboard navigation support through entries
 * - Summary info for screen readers
 */
export const SharedDraftList: React.FC<SharedDraftListProps> = ({
  drafts,
  onEdit,
  onCreateNew,
}) => {
  const activeDrafts = drafts.filter((d) => d.isActive).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Shared Drafts</h2>
          <p className="text-sm text-slate-600 mt-1">
            {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
            {activeDrafts > 0 && ` • ${activeDrafts} active`}
          </p>
        </div>
        <Button onClick={onCreateNew} aria-label="Create a new shared draft">
          New Draft
        </Button>
      </div>

      <ul className="space-y-3" role="list" aria-label="Shared email drafts">
        {drafts.map((draft) => (
          <li key={draft.id} role="listitem">
            <SharedDraftEntry {...draft} onEdit={onEdit} />
          </li>
        ))}
      </ul>
    </div>
  );
};
