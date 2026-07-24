import React from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * SharedDraftEmptyState
 * Accessible empty state for when no drafts exist
 *
 * Accessibility considerations:
 * - Semantic heading for screen readers
 * - Descriptive aria-label on icon
 * - Clear CTA button with label
 * - Sufficient color contrast
 */
export const SharedDraftEmptyState: React.FC = () => {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-96 bg-slate-50 rounded-lg border border-slate-200 p-8"
      role="status"
      aria-live="polite"
      aria-label="No shared drafts"
    >
      <FileText className="w-12 h-12 text-slate-400 mb-4" aria-hidden="true" />
      <h2 className="text-lg font-semibold text-slate-900 mb-2">No shared drafts</h2>
      <p className="text-slate-600 text-center max-w-sm mb-6">
        Collaborate with your team by creating a new shared draft. Invite team members to edit
        together in real-time.
      </p>
      <Button aria-label="Create a new shared draft">New Draft</Button>
    </div>
  );
};
